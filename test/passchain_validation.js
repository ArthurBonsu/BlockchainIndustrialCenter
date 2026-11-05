#!/usr/bin/env node
/**
 * pays_validation.js  (single self-contained file: circuit, contracts, ABIs, deployed addresses and all experiments are inside)
 *
 * Validates the five claims of the PAYS paper with real code, in the same style as run_ris_to_sepolia.js:
 *
 *   zk    Groth16 proof of the PAYS validity predicate (circom + snarkjs): proving/verification cost, soundness checks.
 *   rbf   Gaussian-RBF speculation accuracy on a LIVE Sepolia block series (read-only), against persistence,
 *         moving-average, linear-trend and the exact EIP-1559 rule.
 *   dual  Dual-transaction path vs wait-then-relay on two local EVM chains (ganache) with real zk proofs verified
 *         on chain; with --send the same contracts are also deployed to Sepolia and exercised there.
 *   bee   Bee-algorithm validator routing vs random / round-robin / stake-weighted / least-loaded (seeded simulation).
 *   conf  Proof-of-confidence filtering: the paper's formula on six transaction classes with real zk verdicts.
 *   chain The DEPLOYED Sepolia contracts (ConfidenceScoreCalculator, SpeculativeTransactionHandler, PacechainChannel,
 *         AssetTransferProcessor): bytecode present, read-only probes, and with --send real transactions.
 *   conn  Connection round-trip to Sepolia (and to a Polkadot WebSocket endpoint if @polkadot/api is installed).
 *
 * Every result carries an evidence tag:  M measured here   D recorded live network data   S seeded simulation
 *                                         C configured parameter   L literature
 *
 * Usage
 *   npm install ethers dotenv snarkjs circomlibjs circom2 circomlib solc ganache
 *   npm install @polkadot/api            (optional, only for the Polkadot connection test)
 *   node pays_validation.js                       everything that needs no transaction (reads Sepolia if an RPC is set)
 *   node pays_validation.js --send                also sends Sepolia transactions (needs a funded PRIVATE_KEY)
 *   node pays_validation.js --stages zk,rbf       only some stages  (or STAGES=zk,rbf)
 *   node pays_validation.js --offline             no network at all (RBF then uses a synthetic series tagged S)
 *   node pays_validation.js --quick               small sizes, for a smoke test (not for the paper)
 *   node pays_validation.js --env path\to\.env    use a specific env file
 *
 * Settings (environment or .env file; .env.local or .env is found automatically, same names as the N2N experiments)
 *   PRIVATE_KEY                       funded Sepolia account (64 hex characters), only needed with --send
 *   INFURA_PROJECT_ID                 or ETHEREUM_PROVIDER_URL / RPC_URL / SEPOLIA_RPC_URL ... for another provider
 *   POLKADOT_WS_URL                   optional (default wss://rococo-rpc.polkadot.io; set a live testnet endpoint if that one is retired)
 *   ASSET_TRANSFER_ADDRESS, CONFIDENCE_CALCULATOR_ADDRESS, PACCHAIN_CHANNEL_ADDRESS, SPECULATIVE_TX_ADDRESS
 *                                     override the deployed addresses embedded below
 *   OUTPUT_DIR (default ./pays_results)   ZK_N (30)  DUAL_N (30)  ONCHAIN_TRIALS (8)  BEE_SEEDS (20)
 *   SEPOLIA_BLOCKS (3000)  BLOCK_A (1)  BLOCK_B (1)  CONFIRMATIONS (2)  PTAU_POWER (11)
 *
 * Secrets are read from the local environment only. They are never printed or written to the results.
 */
'use strict';

// Node warns about circom's WASM file handles being closed by the garbage collector. It is harmless, so hide only that warning.
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (!/file descriptor|DEP0137/i.test(`${w.code} ${w.message}`)) console.warn(`${w.name}: ${w.message}`);
});

/*
 * HOW TO READ THIS FILE
 * 1. Configuration     loadConfig() reads .env and flags.
 * 2. Helpers           random numbers, statistics, the Recorder that saves results.
 * 3. zk                circuit + Groth16 proving and verifying (stageZk).
 * 4. rbf               RBF predictor and the live Sepolia block series (stageRbf).
 * 5-6. chains / dual   local test chains and the dual-transaction experiment (stageDual).
 * 7. conn              RPC round trips (stageConn).
 * 8. bee               validator routing simulation (stageBee).
 * 9. conf              proof-of-confidence filtering (stageConf).
 * 10. chain            probes of the deployed Sepolia contracts (stageChain).
 * 11-13. verdicts      claim verdicts, report files, main().
 * Every stage takes (config, rec) and stores its numbers with rec.set('<stage>', {...}).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

const SEPOLIA_CHAIN_ID = 11155111n;

// Deployed Sepolia contracts, as used by passchain_cloud/passchain_cloud_config.js and the earlier test scripts.
// Source: contracts/passchain/PacechainChannel.sol in the repository (four contracts in one file).
const DEFAULT_ADDRESSES = {
  AssetTransferProcessor: '0x10906193b9c3a0d5ea7251047c55f5398d6d4990',
  ConfidenceScoreCalculator: '0xea2b8197b9c1fb936cdfcf6633c1837fc9726e5c',
  PacechainChannel: '0xe75bfd5ba206ed5c059efeb0dd1c603f03c6553c',
  SpeculativeTransactionHandler: '0x9eaac685f82cfd9e9966a1819bc8206a6fe602ca',
};

// ABI fragments (human-readable) for the functions this script calls. They follow the repository source.
const ABI = {
  ConfidenceScoreCalculator: [
    'function HIGH_CONFIDENCE_THRESHOLD() view returns (uint256)',
    'function LOW_CONFIDENCE_THRESHOLD() view returns (uint256)',
    'function SENDER_REPUTATION_WEIGHT() view returns (uint256)',
    'function TRANSACTION_PATTERN_WEIGHT() view returns (uint256)',
    'function ZK_VERIFICATION_WEIGHT() view returns (uint256)',
    'function NETWORK_STATE_WEIGHT() view returns (uint256)',
    'function calculateConfidenceScore(address sender, uint256 txFrequency, bool zkProofValid, uint256 networkLoad) view returns (uint256)',
    'function scoreComponents(address) view returns (uint256 senderReputation, uint256 transactionPattern, uint256 zkVerification, uint256 networkState)',
    'function updateTransactionFrequency(uint256 frequency)',
  ],
  SpeculativeTransactionHandler: [
    'function calculateRBFInterpolation(bytes32 txId, bytes data, uint256 beta) returns (bytes)',
  ],
  PacechainChannel: [
    'function CHANNEL_OPERATOR() view returns (bytes32)',
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function grantRole(bytes32 role, address account)',
    'function createChannel(address sourceBridge, address targetBridge, uint256 confidenceThreshold) returns (bytes32)',
    'function channels(bytes32) view returns (bytes32 id, address sourceBridge, address targetBridge, uint256 creationTime, bool isActive, uint256 confidenceThreshold)',
    'event ChannelCreated(bytes32 indexed channelId, address sourceBridge, address targetBridge)',
  ],
  AssetTransferProcessor: [
    'function initiateAssetTransfer(bytes32 txId, address asset, uint256 amount, bytes32 hashLock)',
    'function assetTransfers(bytes32) view returns (bytes32 txId, address asset, uint256 amount, uint256 lockTime, bytes32 hashLock, bool isCompleted)',
    'event AssetLocked(bytes32 indexed txId, address asset, uint256 amount)',
  ],
  PaysRelay: [
    'function recordPlain(bytes32 id, uint256 val)',
    'function recordSpeculative(bytes32 id, uint256 val)',
    'function confirm(bytes32 id, uint256 val, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[2] pub)',
    'function value(bytes32) view returns (uint256)',
    'function finalized(bytes32) view returns (bool)',
  ],
  PaysSource: ['function submit(bytes32 id, uint256 value)'],
};

// Reference implementation of the dual-transaction commit (deployed by this script for the "dual" stage).
const PAYS_RELAY_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./Groth16Verifier.sol";
contract PaysSource { event Submitted(bytes32 id, uint256 value); function submit(bytes32 id, uint256 value) external { emit Submitted(id, value); } }
contract PaysRelay {
    Groth16Verifier public v;
    mapping(bytes32 => uint256) public value;
    mapping(bytes32 => bool) public finalized;
    constructor(address a) { v = Groth16Verifier(a); }
    function recordPlain(bytes32 id, uint256 val) external { value[id] = val; finalized[id] = true; }
    function recordSpeculative(bytes32 id, uint256 val) external { value[id] = val; }
    function confirm(bytes32 id, uint256 val, uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[2] calldata pub) external {
        require(v.verifyProof(a, b, c, pub), "bad proof");
        value[id] = val; finalized[id] = true;
    }
}
`;

// PAYS validity predicate: Hash(tx)=TxHash AND sender commitment AND balance>=amount AND nonce>0.
const CIRCUIT = `pragma circom 2.0.0;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
template PaysValidity() {
    signal input txHash; signal input senderComm;
    signal input sender; signal input receiver; signal input amount; signal input balance; signal input nonce; signal input salt;
    component h = Poseidon(4);
    h.inputs[0] <== sender; h.inputs[1] <== receiver; h.inputs[2] <== amount; h.inputs[3] <== nonce;
    h.out === txHash;
    component c = Poseidon(2);
    c.inputs[0] <== sender; c.inputs[1] <== salt;
    c.out === senderComm;
    component ge = GreaterEqThan(64);
    ge.in[0] <== balance; ge.in[1] <== amount;
    ge.out === 1;
    component nz = IsZero();
    nz.in <== nonce;
    nz.out === 0;
}
component main {public [txHash, senderComm]} = PaysValidity();
`;

// ---------------------------------------------------------------------------------------------
// 1. Configuration (same conventions as run_ris_to_sepolia.js)
// ---------------------------------------------------------------------------------------------

/** Read the value that follows a command-line flag, e.g. `--stages zk,rbf` gives 'zk,rbf'. */
function cliOption(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
/** True if a flag such as --send or --quick was passed. */
const hasFlag = (name) => process.argv.includes(name);

/** Locate the .env file: --env path, ENV_FILE, then .env.local / .env in this folder or up to 4 parent folders. */
function findEnvFile() {
  const explicit = cliOption('--env') || process.env.ENV_FILE;
  if (explicit) return explicit;
  let dir = process.cwd();
  for (let level = 0; level < 5; level++, dir = path.dirname(dir)) {
    for (const name of ['.env.local', '.env']) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
/** Return the first environment variable in `names` whose value passes `isValid` (lets us accept several names for the same setting). */
const firstValid = (names, isValid) =>
  names.map((n) => process.env[n]).find((v) => v && isValid(v));

/** Collect every setting (RPC URL, key, addresses, trial counts, flags) into one config object used by all stages. */
function loadConfig() {
  const envFile = findEnvFile();
  if (envFile) {
    dotenv.config({ path: envFile });
    console.log('Settings read from', envFile);
  }
  const isUrl = (v) => /^https?:\/\//.test(v),
    isKey = (v) => /^(0x)?[0-9a-fA-F]{64}$/.test(v);
  let rpcUrl = firstValid(
    [
      'RPC_URL',
      'SEPOLIA_RPC_URL',
      'ETHEREUM_PROVIDER_URL',
      'ETHEREUM_RPC_URL',
      'INFURA_URL',
      'ALCHEMY_URL',
      'TATUM_ETHEREUM_ENDPOINT',
      'WEB3_PROVIDER_URL',
      'CUSTOM_RPC_URL',
    ],
    isUrl,
  );
  if (!rpcUrl && process.env.INFURA_PROJECT_ID)
    rpcUrl = `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
  const privateKey = firstValid(
    ['PRIVATE_KEY', 'ETHEREUM_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'SEPOLIA_PRIVATE_KEY'],
    isKey,
  );
  const number = (name, fallback) => Number(process.env[name] || fallback);
  const quick = hasFlag('--quick');
  const stagesArg = cliOption('--stages') || process.env.STAGES;
  const all = ['conn', 'zk', 'rbf', 'dual', 'bee', 'conf', 'chain'];
  const addr = (envNames, def) => firstValid(envNames, (v) => /^0x[0-9a-fA-F]{40}$/.test(v)) || def;
  return {
    rpcUrl,
    quick,
    offline: hasFlag('--offline'),
    send: hasFlag('--send'),
    refresh: hasFlag('--refresh'),
    privateKey: privateKey && (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`),
    polkadotWs:
      process.env.POLKADOT_WS_URL ||
      process.env.POLKADOT_PROVIDER_URL ||
      'wss://rococo-rpc.polkadot.io',
    stages: stagesArg ? stagesArg.split(',').map((s) => s.trim()) : all,
    outDir: path.resolve(process.env.OUTPUT_DIR || path.join(process.cwd(), 'pays_results')),
    addresses: {
      AssetTransferProcessor: addr(
        ['ASSET_TRANSFER_ADDRESS'],
        DEFAULT_ADDRESSES.AssetTransferProcessor,
      ),
      ConfidenceScoreCalculator: addr(
        ['CONFIDENCE_CALCULATOR_ADDRESS'],
        DEFAULT_ADDRESSES.ConfidenceScoreCalculator,
      ),
      PacechainChannel: addr(
        ['PACCHAIN_CHANNEL_ADDRESS', 'PACECHAIN_CHANNEL_ADDRESS'],
        DEFAULT_ADDRESSES.PacechainChannel,
      ),
      SpeculativeTransactionHandler: addr(
        ['SPECULATIVE_TX_ADDRESS'],
        DEFAULT_ADDRESSES.SpeculativeTransactionHandler,
      ),
    },
    n: {
      zk: quick ? 5 : number('ZK_N', 30),
      dual: quick ? 4 : number('DUAL_N', 30),
      onchain: quick ? 2 : number('ONCHAIN_TRIALS', 8),
      beeSeeds: quick ? 3 : number('BEE_SEEDS', 20),
      blocks: quick ? 600 : number('SEPOLIA_BLOCKS', 3000),
      confLegit: quick ? 200 : 1500,
      confAttack: quick ? 75 : 300,
      ptau: number('PTAU_POWER', 11),
      blockA: number('BLOCK_A', 1),
      blockB: number('BLOCK_B', 1),
      confirmations: number('CONFIRMATIONS', 2),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// 2. Small helpers
// ---------------------------------------------------------------------------------------------

/** Pause for `ms` milliseconds. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** High-resolution clock in milliseconds, used for all timings. */
const now = () => Number(process.hrtime.bigint()) / 1e6;
/** Seeded random number generator (mulberry32). The same seed always gives the same numbers, so simulations are repeatable. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** One standard-normal random number (Box-Muller) from the uniform generator `r`. */
function randn(r) {
  let u = 0,
    v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/** Basic statistics helpers: sum, mean, sample standard deviation. */
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
};
const T975 = {
  1: 12.71,
  2: 4.3,
  3: 3.18,
  4: 2.78,
  5: 2.57,
  6: 2.45,
  7: 2.36,
  8: 2.31,
  9: 2.26,
  10: 2.23,
  14: 2.14,
  19: 2.09,
  29: 2.05,
};
/** Two-sided 95% critical value of Student's t for `df` degrees of freedom (used for confidence intervals). */
function tcrit(df) {
  if (df >= 30) return 1.96 + 2.4 / df;
  const k =
    Object.keys(T975)
      .map(Number)
      .filter((x) => x <= df)
      .pop() || 1;
  return T975[k];
}
const ci95 = (a) => (a.length < 2 ? 0 : (tcrit(a.length - 1) * sd(a)) / Math.sqrt(a.length));
/** Percentile `p` (0..1) of the array `a`, with linear interpolation. */
function pct(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
/** Summarise a list of measurements as { n, mean, sd, ci95, min, p50, p95, max }. */
const summary = (a) =>
  a.length
    ? {
        n: a.length,
        mean: mean(a),
        sd: sd(a),
        ci95: ci95(a),
        min: Math.min(...a),
        p50: pct(a, 0.5),
        p95: pct(a, 0.95),
        max: Math.max(...a),
      }
    : { n: 0 };
const f2 = (x, d = 2) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x));
const sha256Text = (text) => crypto.createHash('sha256').update(text).digest('hex');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Host name of a URL, with Infura project ids removed so secrets never reach the results file. */
const hostOf = (u) => {
  try {
    return new URL(u).host.replace(/^.*\.infura\.io$/, 'sepolia.infura.io');
  } catch {
    return 'n/a';
  }
};

/** Collects the results of every stage and saves them to pays_validation.json after each stage, so a crash never loses finished work. */
class Recorder {
  constructor(config) {
    fs.mkdirSync(config.outDir, { recursive: true });
    this.file = path.join(config.outDir, 'pays_validation.json');
    this.data = {
      startedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        cpu: os.cpus()[0] && os.cpus()[0].model,
        cores: os.cpus().length,
        rpcHost: config.rpcUrl ? hostOf(config.rpcUrl) : null,
        quick: config.quick,
        offline: config.offline,
        sentTransactions: config.send,
      },
      evidenceTags: {
        M: 'measured here',
        D: 'recorded live network data',
        S: 'seeded simulation',
        C: 'configured parameter',
        L: 'literature',
      },
      settings: { ...config.n, stages: config.stages, addresses: config.addresses },
      stages: {},
      claims: {},
    };
  }
  set(stage, value) {
    this.data.stages[stage] = value;
    this.save();
  }
  save() {
    this.data.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      this.file,
      JSON.stringify(this.data, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
    );
  }
}

/**
 * Run the command-line tool of an installed npm package (circom2 or snarkjs) with plain Node.
 * No shell, npx or cmd.exe is involved, so there is no quoting problem on Windows and nothing
 * that can wait for keyboard input. The command is stopped with a clear error after `timeoutMs`.
 */
function runTool(packageName, args, cwd, timeoutMs = 5 * 60 * 1000) {
  let dir = path.dirname(require.resolve(packageName));
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== packageName) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Cannot find the installed package ${packageName}`);
    dir = parent;
  }
  const bin = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).bin;
  const script = path.join(dir, typeof bin === 'string' ? bin : bin[packageName]);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    timeout: timeoutMs,
  });
  if (result.error) {
    throw new Error(`${packageName} ${args.slice(0, 2).join(' ')} did not finish: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${packageName} ${args.slice(0, 2).join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return `${result.stdout}\n${result.stderr}`;
}

// ---------------------------------------------------------------------------------------------
// 3. zk-SNARK: circuit, trusted setup, proofs
// ---------------------------------------------------------------------------------------------

const ZK = { work: null, poseidon: null, vk: null };

/** Folder that contains node_modules (found through the installed circomlib package). */
function nodeModulesDir() {
  return path.dirname(path.dirname(require.resolve('circomlib/package.json')));
}

/** One-off zk setup: compile the circuit, create the powers-of-tau file, derive the proving and verification keys. Reports constraint count and setup time. */
async function zkSetup(config) {
  const t = {};
  let t0 = now();
  // Each circuit + ptau size gets its own folder, so a half-finished earlier run can never get in the way.
  const fingerprint = sha256Text(CIRCUIT + '|ptau' + config.n.ptau);
  ZK.work = path.join(config.outDir, `work_${fingerprint.slice(0, 8)}`);
  const metaFile = path.join(ZK.work, 'setup_meta.json');
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    console.log('   reusing the zk setup from the previous run (delete the work_* folder to redo it)');
    ZK.vk = JSON.parse(fs.readFileSync(path.join(ZK.work, 'vkey.json'), 'utf8'));
    return { circuit: meta.circuit, setupMs: { ...meta.setupMs, reused: true } };
  }
  fs.rmSync(ZK.work, { recursive: true, force: true });
  fs.mkdirSync(ZK.work, { recursive: true });
  fs.writeFileSync(path.join(ZK.work, 'pays_validity.circom'), CIRCUIT);
  // circom2 runs sandboxed inside the working directory, so the circomlib circuits are copied next to the circuit.
  fs.cpSync(
    path.join(nodeModulesDir(), 'circomlib', 'circuits'),
    path.join(ZK.work, 'circomlib', 'circuits'),
    { recursive: true },
  );
  const step = (packageName, args) => {
    console.log(`   running: ${packageName} ${args.slice(0, 2).join(' ')} ...`);
    return runTool(packageName, args, ZK.work);
  };
  step('circom2', ['pays_validity.circom', '--r1cs', '--wasm', '--sym', '-o', '.', '-l', '.']);
  t.compileMs = now() - t0;
  const info = step('snarkjs', ['r1cs', 'info', 'pays_validity.r1cs']);
  const grab = (n) => {
    const r = new RegExp(n + '[^0-9]*([0-9]+)', 'i').exec(info);
    return r ? Number(r[1]) : null;
  };
  const circuit = {
    constraints: grab('# of Constraints'),
    wires: grab('# of Wires'),
    privateInputs: grab('# of Private Inputs'),
    publicInputs: grab('# of Public Inputs'),
  };
  t0 = now();
  const stamp = Date.now();
  step('snarkjs', ['powersoftau', 'new', 'bn128', String(config.n.ptau), 'pot0.ptau']);
  step('snarkjs', ['powersoftau', 'contribute', 'pot0.ptau', 'pot1.ptau', '--name=pays', `-e=pays-ptau-${stamp}`]);
  step('snarkjs', ['powersoftau', 'prepare', 'phase2', 'pot1.ptau', 'potf.ptau']);
  t.ptauMs = now() - t0;
  t0 = now();
  step('snarkjs', ['groth16', 'setup', 'pays_validity.r1cs', 'potf.ptau', 'z0.zkey']);
  step('snarkjs', ['zkey', 'contribute', 'z0.zkey', 'pays.zkey', '--name=pays', `-e=pays-zkey-${stamp}`]);
  step('snarkjs', ['zkey', 'export', 'verificationkey', 'pays.zkey', 'vkey.json']);
  step('snarkjs', ['zkey', 'export', 'solidityverifier', 'pays.zkey', 'Groth16Verifier.sol']);
  t.zkeyMs = now() - t0;
  ZK.vk = JSON.parse(fs.readFileSync(path.join(ZK.work, 'vkey.json'), 'utf8'));
  fs.writeFileSync(metaFile, JSON.stringify({ fingerprint, circuit, setupMs: t }));
  return { circuit, setupMs: t };
}
/** Build one random valid input for the circuit (balance, amount, nonce, secret, Poseidon hashes). `opts` can make it deliberately invalid. */
async function zkInput(r, opts = {}) {
  if (!ZK.poseidon) ZK.poseidon = await require('circomlibjs').buildPoseidon();
  const p = ZK.poseidon,
    F = p.F,
    rnd = () => BigInt(Math.floor(r() * 2 ** 40));
  const sender = rnd() + 1n,
    receiver = rnd() + 1n,
    salt = rnd(),
    amount = BigInt(Math.floor(r() * 1e6) + 1);
  const balance = opts.insufficient ? amount - 1n : amount + BigInt(Math.floor(r() * 1e6));
  const nonce = opts.zeroNonce ? 0n : BigInt(Math.floor(r() * 1e4) + 1);
  const s = (x) => x.toString();
  return {
    txHash: s(F.toObject(p([sender, receiver, amount, nonce]))),
    senderComm: s(F.toObject(p([sender, salt]))),
    sender: s(sender),
    receiver: s(receiver),
    amount: s(amount),
    balance: s(balance),
    nonce: s(nonce),
    salt: s(salt),
  };
}
/** Generate a Groth16 proof for `input`. Returns the proof, public signals and the witness / proving times. */
async function zkProve(input, tag = 'w') {
  const snarkjs = require('snarkjs'),
    wtns = path.join(ZK.work, `${tag}.wtns`);
  let t0 = now();
  await snarkjs.wtns.calculate(
    input,
    path.join(ZK.work, 'pays_validity_js', 'pays_validity.wasm'),
    wtns,
  );
  const tWit = now() - t0;
  t0 = now();
  const { proof, publicSignals } = await snarkjs.groth16.prove(
    path.join(ZK.work, 'pays.zkey'),
    wtns,
  );
  const tProve = now() - t0;
  return { proof, publicSignals, tWit, tProve };
}
/** Verify a proof off-chain and return { ok, ms }. */
async function zkVerify(publicSignals, proof) {
  const t0 = now();
  let ok = false;
  try {
    ok = await require('snarkjs').groth16.verify(ZK.vk, publicSignals, proof);
  } catch {
    ok = false;
  }
  return { ok, ms: now() - t0 };
}
/** Reformat a proof into the argument layout the Solidity verifier expects. */
const zkCalldata = (proof, pub) => ({
  a: proof.pi_a.slice(0, 2),
  b: [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ],
  c: proof.pi_c.slice(0, 2),
  pub,
});

/** Cache of valid and tampered proofs so later stages can reuse them instead of proving again. */
const POOL = { valid: [], tampered: [] };

/** Stage zk: measure proof cost, then check soundness: valid proofs verify, forged proofs, altered public inputs and impossible witnesses are rejected. */
async function stageZk(config, rec) {
  console.log('\n[zk] Groth16 cost and soundness of the PAYS validity predicate');
  const r = rng(11),
    st = await zkSetup(config),
    rows = [];
  for (let i = 0; i < config.n.zk; i++) {
    const inp = await zkInput(r),
      p = await zkProve(inp, 'zk'),
      v = await zkVerify(p.publicSignals, p.proof);
    rows.push({
      tWit: p.tWit,
      tProve: p.tProve,
      tVerify: v.ms,
      ok: v.ok,
      proofJsonBytes: Buffer.byteLength(JSON.stringify(p.proof)),
    });
    if (POOL.valid.length < 60) POOL.valid.push({ proof: p.proof, publicSignals: p.publicSignals });
  }
  const M = Math.max(10, Math.min(30, config.n.zk * 3));
  let tamperRej = 0,
    pubRej = 0;
  const unprov = { insufficientBalance: 0, zeroNonce: 0, n: 0 };
  for (let i = 0; i < M; i++) {
    const g = POOL.valid[i % POOL.valid.length],
      bad = JSON.parse(JSON.stringify(g.proof));
    bad.pi_a[0] = (BigInt(bad.pi_a[0]) + 1n).toString();
    if (!(await zkVerify(g.publicSignals, bad)).ok) tamperRej++;
    if (POOL.tampered.length < 60)
      POOL.tampered.push({ proof: bad, publicSignals: g.publicSignals });
    const ps = [...g.publicSignals];
    ps[0] = (BigInt(ps[0]) + 1n).toString();
    if (!(await zkVerify(ps, g.proof)).ok) pubRej++;
    unprov.n++;
    for (const [k, o] of [
      ['insufficientBalance', { insufficient: true }],
      ['zeroNonce', { zeroNonce: true }],
    ]) {
      // circom prints an error for every unsatisfiable witness; that is the expected outcome here, so hide it.
      const realConsoleError = console.error;
      console.error = () => {};
      try {
        await zkProve(await zkInput(r, o), 'bad');
      } catch {
        unprov[k]++;
      } finally {
        console.error = realConsoleError;
      }
    }
  }
  const out = {
    tag: 'M',
    circuit: st.circuit,
    setupMs: st.setupMs,
    proofs: config.n.zk,
    witnessMs: summary(rows.map((x) => x.tWit)),
    proveMs: summary(rows.map((x) => x.tProve)),
    verifyMs: summary(rows.map((x) => x.tVerify)),
    proofJsonBytes: summary(rows.map((x) => x.proofJsonBytes)),
    proofBytesGroth16Bn254: 128,
    checks: {
      completeness: `${rows.filter((x) => x.ok).length}/${rows.length}`,
      tamperedProofRejected: `${tamperRej}/${M}`,
      wrongPublicInputRejected: `${pubRej}/${M}`,
      invalidWitnessUnprovable: {
        insufficientBalance: `${unprov.insufficientBalance}/${unprov.n}`,
        zeroNonce: `${unprov.zeroNonce}/${unprov.n}`,
      },
    },
  };
  rec.set('zk', out);
  console.log(
    `   ${st.circuit.constraints} constraints | prove ${f2(out.proveMs.mean, 1)} ms | verify ${f2(out.verifyMs.mean, 1)} ms | completeness ${out.checks.completeness} | tampered rejected ${out.checks.tamperedProofRejected}`,
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// 4. RBF speculation accuracy on a live block series
// ---------------------------------------------------------------------------------------------

/** Solve the linear system A x = b by Gaussian elimination with pivoting (needed to fit the RBF weights). */
function solveLinear(A, b) {
  const n = b.length,
    M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / (M[i][i] || 1e-12);
  }
  return x;
}
/** Gaussian RBF over a sliding window (window mean removed), extrapolated `steps` ahead. */
/** Gaussian-RBF prediction: fit the weights on the last `hist.length` values, then extrapolate `steps` ahead. */
function rbfPredict(hist, beta, lambda = 1e-6, steps = 1) {
  const k = hist.length,
    mu = mean(hist),
    v = hist.map((x) => x - mu),
    xs = hist.map((_, i) => i / (k - 1)),
    phi = (d) => Math.exp(-((beta * d) ** 2));
  const w = solveLinear(
      xs.map((xi, i) => xs.map((xj, j) => phi(xi - xj) + (i === j ? lambda : 0))),
      v,
    ),
    xq = 1 + steps / (k - 1);
  return mu + xs.reduce((s, xi, i) => s + w[i] * phi(xq - xi), 0);
}

/** Download the last N Sepolia blocks (gas used, base fee, ...) and cache them in sepolia_series.json. */
async function fetchSepoliaSeries(config) {
  const file = path.join(config.outDir, 'sepolia_series.json');
  if (!config.refresh && fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j.blocks.length >= config.n.blocks * 0.9) return j;
  }
  const rpc = async (method, params) => {
    const r = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    return j.result;
  };
  const head = parseInt(await rpc('eth_blockNumber', []), 16),
    blocks = [];
  for (let n = Math.max(1, head - config.n.blocks + 1); n <= head; n += 50) {
    const batch = [];
    for (let k = n; k < Math.min(n + 50, head + 1); k++)
      batch.push({
        jsonrpc: '2.0',
        id: k,
        method: 'eth_getBlockByNumber',
        params: ['0x' + k.toString(16), false],
      });
    let js = null;
    for (let tries = 0; tries < 8 && !js; tries++) {
      const r = await (
        await fetch(config.rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        })
      ).json();
      if (Array.isArray(r) && r.every((x) => x.result)) js = r.sort((a, b) => a.id - b.id);
      else await sleep(1000 * (tries + 1));
    }
    if (!js) throw new Error('the endpoint kept rate-limiting block requests');
    await sleep(250);
    for (const j of js) {
      const b = j.result;
      if (!b) continue;
      blocks.push({
        number: parseInt(b.number, 16),
        timestamp: parseInt(b.timestamp, 16),
        baseFeeGwei: parseInt(b.baseFeePerGas, 16) / 1e9,
        gasUsed: parseInt(b.gasUsed, 16),
        gasLimit: parseInt(b.gasLimit, 16),
        txCount: b.transactions.length,
      });
    }
  }
  if (blocks.length < 200)
    throw new Error('only ' + blocks.length + ' blocks returned by the endpoint');
  const out = {
    tag: 'D',
    network: 'Ethereum Sepolia',
    collected: new Date().toISOString(),
    blocks,
  };
  fs.writeFileSync(file, JSON.stringify(out));
  return out;
}
/** Offline fallback: a made-up block series. Anything computed from it is tagged S, not D. */
function syntheticSeries(n) {
  const r = rng(5),
    blocks = [];
  let util = 0.4,
    bf = 5;
  for (let i = 0; i < n; i++) {
    util = Math.min(1, Math.max(0, 0.9 * util + 0.04 + 0.12 * randn(r)));
    bf = Math.max(0.001, bf * (1 + 0.125 * (util * 2 - 1)));
    blocks.push({
      number: i,
      timestamp: 12 * i,
      baseFeeGwei: bf,
      gasUsed: Math.round(util * 6e7),
      gasLimit: 6e7,
      txCount: 0,
    });
  }
  return { tag: 'S', network: 'synthetic AR(1) (offline fallback)', blocks };
}
/** Shared state passed from the rbf stage to the dual stage (the block series and the outcome stream). */
const LIVE = { series: null };

/** Stage rbf: predict the next block's gas utilisation and base fee with RBF and with simple baselines, compare errors, and test the difference with a bootstrap. */
async function stageRbf(config, rec) {
  console.log('\n[rbf] speculation accuracy');
  let S;
  if (config.offline || !config.rpcUrl) {
    console.warn('   !! no RPC (or --offline): using a synthetic series, evidence tag S');
    S = syntheticSeries(Math.max(config.n.blocks, 1000));
  } else S = await fetchSepoliaSeries(config);
  LIVE.series = S;
  const B = S.blocks,
    targets = {
      gasUtilisation: {
        s: B.map((b) => b.gasUsed / b.gasLimit),
        eps: 0.05,
        unit: 'fraction of gas limit',
      },
      baseFee: {
        s: B.map((b) => b.baseFeeGwei),
        eps: 0.02 * mean(B.map((b) => b.baseFeeGwei)),
        unit: 'gwei',
      },
    };
  const res = {};
  for (const [name, T] of Object.entries(targets)) {
    const s = T.s,
      n = s.length,
      split = Math.floor(n * 0.6);
    const ma = (k) => (x, t) => mean(x.slice(t - k, t));
    const lin = (k) => (x, t) => {
      const y = x.slice(t - k, t),
        mx = (k - 1) / 2,
        my = mean(y);
      let sxy = 0,
        sxx = 0;
      y.forEach((v, i) => {
        sxy += (i - mx) * (v - my);
        sxx += (i - mx) ** 2;
      });
      return my + (sxy / sxx) * (k - mx);
    };
    const ev = (pred, a, b) => {
      const P = [],
        A = [],
        tm = [];
      for (let t = a; t < b; t++) {
        const t0 = now();
        P.push(pred(s, t));
        tm.push(now() - t0);
        A.push(s[t]);
      }
      return {
        mae: mean(P.map((p, i) => Math.abs(p - A[i]))),
        rmse: Math.sqrt(mean(P.map((p, i) => (p - A[i]) ** 2))),
        hit: P.filter((p, i) => Math.abs(p - A[i]) <= T.eps).length / P.length,
        ms: mean(tm),
        msP95: pct(tm, 0.95),
        P,
        A,
      };
    };
    let best = null;
    for (const k of [4, 8, 16])
      for (const beta of [0.5, 1, 2, 4, 8]) {
        const e = ev((x, t) => rbfPredict(x.slice(t - k, t), beta), 20, split);
        if (!best || e.mae < best.mae) best = { k, beta, mae: e.mae };
      }
    const R = {
      persistence: ev((x, t) => x[t - 1], split, n),
      movingAverage8: ev(ma(8), split, n),
      linear8: ev(lin(8), split, n),
      rbf: ev((x, t) => rbfPredict(x.slice(t - best.k, t), best.beta), split, n),
    };
    // Extension: the same RBF predictor with its settings (window k, width beta, ridge lambda) chosen on a
    // wider grid. Only the training part of the series is used for the choice: the second half of it is the
    // validation block, and the test part is never looked at. Skipped when the target is saturated.
    let tuned = null;
    if (R.persistence.hit < 0.99) {
      const validationStart = Math.floor(split / 2);
      const validationMae = (predict) => {
        let total = 0;
        for (let t = validationStart; t < split; t++) total += Math.abs(predict(s, t) - s[t]);
        return total / (split - validationStart);
      };
      for (const k of [4, 6, 8, 12, 16, 24])
        for (const beta of [0.5, 1, 2, 4, 8, 16, 32, 64])
          for (const lambda of [1e-8, 1e-6, 1e-4, 1e-2, 1e-1, 1]) {
            const mae = validationMae((x, t) => rbfPredict(x.slice(t - k, t), beta, lambda));
            if (!tuned || mae < tuned.validationMae) tuned = { k, beta, lambda, validationMae: mae };
          }
      R.rbfTuned = ev((x, t) => rbfPredict(x.slice(t - tuned.k, t), tuned.beta, tuned.lambda), split, n);
    }
    if (name === 'baseFee')
      R.eip1559Rule = ev(
        (x, t) => {
          const pb = B[t - 1];
          return pb.baseFeeGwei * (1 + (pb.gasUsed - pb.gasLimit / 2) / (pb.gasLimit / 2) / 8);
        },
        split,
        n,
      );
    // Bootstrap 95% interval for (mean absolute error of RBF) - (mean absolute error of another model).
    // An interval entirely below zero means RBF is more accurate than that model on this test set.
    const absErrors = (model) => R[model].P.map((p, i) => Math.abs(p - R[model].A[i]));
    const bootstrapDifference = (otherModel, ofModel = 'rbf') => {
      const rbfErr = absErrors(ofModel);
      const otherErr = absErrors(otherModel);
      const diff = rbfErr.map((x, i) => x - otherErr[i]);
      const random = rng(99);
      const means = [];
      for (let b = 0; b < 1000; b++) {
        let total = 0;
        for (let i = 0; i < diff.length; i++) total += diff[Math.floor(random() * diff.length)];
        means.push(total / diff.length);
      }
      return [pct(means, 0.025), pct(means, 0.975)];
    };
    const differenceCi = {
      persistence: bootstrapDifference('persistence'),
      movingAverage8: bootstrapDifference('movingAverage8'),
      linear8: bootstrapDifference('linear8'),
    };
    const tunedDifferenceCi = tuned && {
      persistence: bootstrapDifference('persistence', 'rbfTuned'),
      movingAverage8: bootstrapDifference('movingAverage8', 'rbfTuned'),
      linear8: bootstrapDifference('linear8', 'rbfTuned'),
      defaultRbf: bootstrapDifference('rbf', 'rbfTuned'),
    };
    res[name] = {
      cv: sd(s) / Math.abs(mean(s) || 1),
      unit: T.unit,
      eps: T.eps,
      trainN: split,
      testN: n - split,
      selected: best,
      models: Object.fromEntries(
        Object.entries(R).map(([k, v]) => [
          k,
          { mae: v.mae, rmse: v.rmse, hitRate: v.hit, predMs: v.ms, predMsP95: v.msP95 },
        ]),
      ),
      rbfMinusPersistenceMaeCi95: differenceCi.persistence,
      rbfMinusBaselineMaeCi95: differenceCi,
      tuned: tuned && { selected: tuned, minusBaselineMaeCi95: tunedDifferenceCi },
    };
    const m = res[name].models;
    if (m.rbfTuned)
      console.log(
        `   ${name}: tuned RBF (k=${tuned.k}, beta=${tuned.beta}, lambda=${tuned.lambda}) MAE ${f2(m.rbfTuned.mae, 5)} (hit ${f2(m.rbfTuned.hitRate * 100, 1)}%) | moving average ${f2(m.movingAverage8.mae, 5)}`,
      );
    console.log(
      `   ${name}: RBF MAE ${f2(m.rbf.mae, 5)} (hit ${f2(m.rbf.hitRate * 100, 1)}%) | persistence ${f2(m.persistence.mae, 5)} (hit ${f2(m.persistence.hitRate * 100, 1)}%)${m.eip1559Rule ? ` | EIP-1559 rule ${f2(m.eip1559Rule.mae, 5)}` : ''}`,
    );
  }
  const u = targets.gasUtilisation,
    split = Math.floor(u.s.length * 0.6),
    sel = res.gasUtilisation.selected,
    stream = [];
  for (let t = split; t < u.s.length && stream.length < 400; t++)
    stream.push({ hist: u.s.slice(t - sel.k, t), beta: sel.beta, actual: u.s[t] });
  const out = {
    tag: S.tag,
    source: S.network,
    blocks: B.length,
    firstBlock: B[0].number,
    lastBlock: B[B.length - 1].number,
    results: res,
    streamEps: u.eps,
  };
  rec.set('rbf', out);
  LIVE.stream = stream;
  return out;
}

// ---------------------------------------------------------------------------------------------
// 5. Chains: ethers helpers, compilation, local EVM chains
// ---------------------------------------------------------------------------------------------

/** Wait until a transaction is mined (and `extraBlocks` more blocks), polling every `pollMs` milliseconds. */
async function waitReceipt(provider, hash, extraBlocks = 0, pollMs = 5) {
  let r;
  while (!(r = await provider.send('eth_getTransactionReceipt', [hash]))) await sleep(pollMs);
  if (r.status !== '0x1') throw new Error('transaction reverted ' + hash);
  const bn = parseInt(r.blockNumber, 16);
  while (
    extraBlocks > 0 &&
    parseInt(await provider.send('eth_blockNumber', []), 16) < bn + extraBlocks
  )
    await sleep(pollMs);
  return { gasUsed: Number(BigInt(r.gasUsed)), block: bn, hash };
}

/** Compile the embedded PaysRelay and verifier contracts with solc. */
function compileRelay() {
  const solc = require('solc');
  const input = {
    language: 'Solidity',
    sources: {
      'Groth16Verifier.sol': {
        content: fs.readFileSync(path.join(ZK.work, 'Groth16Verifier.sol'), 'utf8'),
      },
      'PaysRelay.sol': { content: PAYS_RELAY_SOL },
    },
    settings: {
      evmVersion: 'paris',
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter((e) => e.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.formattedMessage).join('\n'));
  return {
    Verifier: out.contracts['Groth16Verifier.sol'].Groth16Verifier,
    Relay: out.contracts['PaysRelay.sol'].PaysRelay,
    Source: out.contracts['PaysRelay.sol'].PaysSource,
  };
}

/** In-process ganache chain with a fixed block interval and funded wallets. */
/** Start an in-process ganache chain with the given id and block time. */
function startLocalChain(chainId, blockTimeSec, nWallets) {
  const ganache = require('ganache'),
    keys = Array.from({ length: nWallets }, () => ethers.Wallet.createRandom().privateKey);
  const raw = ganache.provider({
    logging: { quiet: true },
    chain: { chainId, hardfork: 'shanghai' },
    miner: { blockTime: blockTimeSec, defaultGasPrice: 1e9 },
    wallet: {
      accounts: keys.map((k) => ({ secretKey: k, balance: '0x' + (10n ** 24n).toString(16) })),
    },
  });
  const provider = new ethers.BrowserProvider(
    raw,
    { chainId, name: 'local' + chainId },
    { cacheTimeout: -1 },
  );
  return {
    raw,
    provider,
    local: true,
    signers: keys.map((k) => new ethers.NonceManager(new ethers.Wallet(k, provider))),
    ov: { gasLimit: 1_500_000, gasPrice: 1_000_000_000, type: 0 },
  };
}
/** Deploy a compiled contract and record the gas used. */
async function deployContract(chain, signer, art, args = []) {
  const f = new ethers.ContractFactory(art.abi, '0x' + art.evm.bytecode.object, signer);
  const ov = chain.local ? { ...chain.ov, gasLimit: 6_000_000 } : {};
  const c = await f.deploy(...args, ov);
  const rc = await waitReceipt(
    chain.provider,
    c.deploymentTransaction().hash,
    0,
    chain.local ? 5 : 250,
  );
  c.deployGas = rc.gasUsed;
  return c;
}
/** Sends contract.fn(...args) and returns the confirmation record. */
/** Send one contract transaction and return { gas, ms, block } measured from send to receipt. */
async function sendCall(chain, contract, fn, args, label, extraBlocks = 0) {
  const t0 = now();
  const tx = await contract[fn](...args, chain.local ? chain.ov : {});
  const rc = await waitReceipt(chain.provider, tx.hash, extraBlocks, chain.local ? 5 : 250);
  return { label, hash: tx.hash, block: rc.block, gas: rc.gasUsed, ms: now() - t0, t0 };
}

// ---------------------------------------------------------------------------------------------
// 6. Dual-transaction path (local two-chain run, and Sepolia with --send)
// ---------------------------------------------------------------------------------------------

/** Stage dual: on two local chains compare (1) wait-then-relay, (2) the speculative commit and (3) the zk-confirmed commit, using real proofs checked on chain. With --send it repeats on Sepolia. */
async function stageDual(config, rec) {
  console.log('\n[dual] dual-transaction path vs wait-then-relay');
  if (!ZK.vk) {
    await zkSetup(config);
  }
  if (!LIVE.stream) {
    const S = syntheticSeries(1500),
      u = S.blocks.map((b) => b.gasUsed / b.gasLimit);
    LIVE.stream = [];
    for (let t = 900; t < 1300; t++)
      LIVE.stream.push({ hist: u.slice(t - 4, t), beta: 2, actual: u[t] });
    LIVE.streamEps = 0.05;
    console.warn('   !! RBF stage not run: using a synthetic outcome stream (tag S)');
  }
  const eps = LIVE.streamEps || 0.05,
    art = compileRelay(),
    out = {
      tag: 'M',
      configured: {
        blockTimeA: config.n.blockA,
        blockTimeB: config.n.blockB,
        confirmations: config.n.confirmations,
        tag: 'C',
      },
    };
  // ---- local two-chain run
  const A = startLocalChain(1337, config.n.blockA, 2),
    B = startLocalChain(1338, config.n.blockB, 4);
  const ver = await deployContract(B, B.signers[0], art.Verifier),
    relay = await deployContract(B, B.signers[0], art.Relay, [await ver.getAddress()]),
    src = await deployContract(A, A.signers[0], art.Source);
  const srcA = (i) =>
    new ethers.Contract(src.target, ethers.Interface.from(art.Source.abi), A.signers[i]);
  const relB = (i) =>
    new ethers.Contract(relay.target, ethers.Interface.from(art.Relay.abi), B.signers[i]);
  const r = rng(31),
    rows = [],
    id = (k) => ethers.keccak256(ethers.toUtf8Bytes('tx' + k)),
    val = (x) => BigInt(Math.round(x * 1e6));
  for (let i = 0; i < config.n.dual; i++) {
    const s = LIVE.stream[i % LIVE.stream.length],
      pred = rbfPredict(s.hist, s.beta),
      miss = Math.abs(pred - s.actual) > eps;
    // arm 1: baseline wait-then-relay (no prediction, no proof)
    let t0 = now();
    let rc = await sendCall(
      A,
      srcA(0),
      'submit',
      [id(i), val(s.actual)],
      'src',
      config.n.confirmations - 1,
    );
    const rb = await sendCall(B, relB(0), 'recordPlain', [id(i), val(s.actual)], 'plain');
    const tBase = now() - t0;
    // arm 2: PAYS dual path
    const tid = id(100000 + i);
    t0 = now();
    const inp = await zkInput(r),
      proofP = zkProve(inp, 'dual').then((p) => ({ ...p, at: now() - t0 }));
    const aP = (async () => {
      await sendCall(A, srcA(1), 'submit', [tid, val(s.actual)], 'src', config.n.confirmations - 1);
      return now() - t0;
    })();
    const specP = (async () => {
      const tp = now();
      const pp = rbfPredict(s.hist, s.beta);
      const tRbf = now() - tp;
      const sc = await sendCall(B, relB(1), 'recordSpeculative', [tid, val(pp)], 'spec');
      return { tSpec: now() - t0, tRbf, gas: sc.gas };
    })();
    const [pr, tA, sp] = await Promise.all([proofP, aP, specP]);
    const cd = zkCalldata(pr.proof, pr.publicSignals);
    const cc = await sendCall(
      B,
      relB(2),
      'confirm',
      [tid, val(s.actual), cd.a, cd.b, cd.c, cd.pub],
      'confirm',
    );
    const tFinal = now() - t0;
    rows.push({
      miss,
      tBase,
      tSpec: sp.tSpec,
      tRbf: sp.tRbf,
      tProof: pr.at,
      tAFinal: tA,
      tFinal,
      tCorrectUsable: miss ? tFinal : sp.tSpec,
      gasPlain: rb.gas,
      gasSpec: sp.gas,
      gasConfirm: cc.gas,
      finalized: await relay.finalized(tid),
      valueOk: (await relay.value(tid)) === val(s.actual),
    });
    if ((i + 1) % 5 === 0 || i + 1 === config.n.dual)
      console.log(
        `   local trial ${i + 1}/${config.n.dual}: baseline ${f2(tBase, 0)} ms | speculative ${f2(sp.tSpec, 0)} ms | final ${f2(tFinal, 0)} ms`,
      );
  }
  const col = (k) => rows.map((x) => x[k]);
  out.local = {
    trials: rows.length,
    mispredictionRate: rows.filter((x) => x.miss).length / rows.length,
    epsilon: eps,
    baselineMs: summary(col('tBase')),
    speculativeMs: summary(col('tSpec')),
    finalMs: summary(col('tFinal')),
    correctUsableMs: summary(col('tCorrectUsable')),
    rbfMs: summary(col('tRbf')),
    proofReadyMs: summary(col('tProof')),
    gas: {
      plain: summary(col('gasPlain')),
      speculative: summary(col('gasSpec')),
      confirmWithZk: summary(col('gasConfirm')),
      verifierDeploy: ver.deployGas,
      relayDeploy: relay.deployGas,
    },
    allFinalized: rows.every((x) => x.finalized),
    allValuesCorrect: rows.every((x) => x.valueOk),
    speculativeSpeedup: mean(col('tBase')) / mean(col('tSpec')),
    correctUsableSpeedup: mean(col('tBase')) / mean(col('tCorrectUsable')),
    finalOverheadMs: mean(col('tFinal')) - mean(col('tBase')),
  };
  await A.raw.disconnect();
  await B.raw.disconnect();
  console.log(
    `   local: baseline ${f2(out.local.baselineMs.mean, 0)} ms | speculative ${f2(out.local.speculativeMs.mean, 0)} ms | final ${f2(out.local.finalMs.mean, 0)} ms | misprediction ${f2(out.local.mispredictionRate * 100, 1)}% | confirm gas ${f2(out.local.gas.confirmWithZk.mean, 0)}`,
  );
  // ---- Sepolia (real chain), only with --send
  if (config.send && config.rpcUrl && config.privateKey && !config.offline)
    out.sepolia = await dualSepolia(config, art, eps);
  else
    out.sepolia = {
      skipped: config.send
        ? 'needs RPC and PRIVATE_KEY'
        : 'run with --send to deploy PaysRelay and verify proofs on Sepolia',
    };
  rec.set('dual', out);
  return out;
}

/** JSON-RPC provider that backs off and retries when the endpoint answers 'Too Many Requests' (free Infura tiers do). */
/** Ethers provider that waits and retries when the RPC says 'Too Many Requests' (free Infura plans do this). */
class PatientProvider extends ethers.JsonRpcProvider {
  async _send(payload) {
    for (let attempt = 0; ; attempt++) {
      let response;
      try {
        response = await super._send(payload);
      } catch (error) {
        // Network trouble (DNS failure, dropped connection, timeout): wait and try again.
        const transient = /ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED|timeout|fetch failed|SERVER_ERROR/i.test(
          `${error.code} ${error.message}`,
        );
        if (!transient || attempt >= 8) throw error;
        await sleep(Math.min(30000, 1000 * 2 ** attempt));
        continue;
      }
      const results = Array.isArray(response) ? response : [response];
      const rateLimited = results.some(
        (r) =>
          r && r.error && (r.error.code === -32005 || /too many|rate/i.test(r.error.message || '')),
      );
      if (!rateLimited || attempt >= 7) return response;
      await sleep(800 * 2 ** attempt);
    }
  }
}
/** Create a PatientProvider for Sepolia. Requests give up after 20 s and are then retried. */
const patient = (url) => {
  const request = new ethers.FetchRequest(url);
  request.timeout = 20000;
  return new PatientProvider(request, undefined, {
    staticNetwork: ethers.Network.from(11155111),
    batchMaxCount: 1,
  });
};

/** Connect to the Sepolia RPC and make sure it really is chain 11155111. */
async function connectSepolia(config) {
  const provider = patient(config.rpcUrl);
  const net = await provider.getNetwork();
  if (net.chainId !== SEPOLIA_CHAIN_ID)
    throw new Error(`Connected to chain ${net.chainId}, expected Sepolia`);
  return provider;
}

/** The Sepolia part of the dual stage: deploy the verifier and relay, then time plain, direct-zk and dual commits. */
async function dualSepolia(config, art, eps) {
  console.log(
    '   [sepolia] deploying Groth16Verifier and PaysRelay, then running real dual commits',
  );
  const provider = await connectSepolia(config),
    wallet = new ethers.Wallet(config.privateKey, provider),
    signer = new ethers.NonceManager(wallet);
  const bal = await provider.getBalance(wallet.address);
  console.log('   account', wallet.address, 'balance', ethers.formatEther(bal), 'ETH');
  if (bal === 0n) throw new Error('The account has no Sepolia ETH');
  const chain = { provider, local: false },
    res = { tag: 'M', network: 'Ethereum Sepolia', account: wallet.address };
  const ver = await deployContract(chain, signer, art.Verifier),
    relay = await deployContract(chain, signer, art.Relay, [await ver.getAddress()]);
  res.contracts = {
    Groth16Verifier: await ver.getAddress(),
    PaysRelay: await relay.getAddress(),
    verifierDeployGas: ver.deployGas,
    relayDeployGas: relay.deployGas,
  };
  const rel = new ethers.Contract(relay.target, ethers.Interface.from(art.Relay.abi), signer),
    r = rng(77),
    rows = [],
    id = (k) => ethers.keccak256(ethers.toUtf8Bytes('sepolia' + Date.now() + k));
  for (let i = 0; i < config.n.onchain; i++) {
    const s = LIVE.stream[i % LIVE.stream.length];
    const bid = id('b' + i);
    let t0 = now();
    const pb = await sendCall(
      chain,
      rel,
      'recordPlain',
      [bid, BigInt(Math.round(s.actual * 1e6))],
      'plain',
    );
    const tPlain = now() - t0;
    // zk-verified direct commit (proof first, one transaction) as the non-speculative reference
    const tid = id('p' + i),
      inp = await zkInput(r);
    t0 = now();
    const pr = await zkProve(inp, 'sep'),
      cd = zkCalldata(pr.proof, pr.publicSignals),
      tProofDone = now() - t0;
    const direct = await sendCall(
      chain,
      rel,
      'confirm',
      [id('d' + i), BigInt(Math.round(s.actual * 1e6)), cd.a, cd.b, cd.c, cd.pub],
      'confirmDirect',
    );
    const tDirect = now() - t0;
    // dual path: speculative commit goes out immediately, the proof is generated in parallel, then the confirmable commit follows
    t0 = now();
    const proofP = zkProve(await zkInput(r), 'sep2');
    const spec = await sendCall(
      chain,
      rel,
      'recordSpeculative',
      [tid, BigInt(Math.round(rbfPredict(s.hist, s.beta) * 1e6))],
      'speculative',
    );
    const tSpec = now() - t0;
    const p2 = await proofP,
      cd2 = zkCalldata(p2.proof, p2.publicSignals);
    const conf = await sendCall(
      chain,
      rel,
      'confirm',
      [tid, BigInt(Math.round(s.actual * 1e6)), cd2.a, cd2.b, cd2.c, cd2.pub],
      'confirm',
    );
    const tFinal = now() - t0;
    rows.push({
      tPlain,
      tProofDone,
      tDirect,
      tSpec,
      tFinal,
      gasPlain: pb.gas,
      gasSpec: spec.gas,
      gasConfirm: conf.gas,
      gasConfirmDirect: direct.gas,
      finalized: await rel.finalized(tid),
      blocks: { spec: spec.block, confirm: conf.block },
    });
    console.log(
      `   sepolia trial ${i + 1}/${config.n.onchain}: speculative visible ${f2(tSpec / 1000, 1)} s | verified+final ${f2(tFinal / 1000, 1)} s | direct zk commit ${f2(tDirect / 1000, 1)} s | confirm gas ${conf.gas}`,
    );
  }
  const col = (k) => rows.map((x) => x[k]);
  Object.assign(res, {
    trials: rows.length,
    plainCommitMs: summary(col('tPlain')),
    speculativeVisibleMs: summary(col('tSpec')),
    dualFinalMs: summary(col('tFinal')),
    directZkCommitMs: summary(col('tDirect')),
    gas: {
      plain: summary(col('gasPlain')),
      speculative: summary(col('gasSpec')),
      confirmWithZk: summary(col('gasConfirm')),
    },
    allFinalized: rows.every((x) => x.finalized),
    note: 'Single-chain exercise: it measures real inclusion time and the gas of on-chain Groth16 verification, not cross-chain relay latency.',
  });
  return res;
}

// ---------------------------------------------------------------------------------------------
// 7. Connection round trips
// ---------------------------------------------------------------------------------------------

/** Stage conn: time 30 round trips to the Sepolia RPC and, if @polkadot/api is installed, connect to the Polkadot endpoint and measure block intervals. */
async function stageConn(config, rec) {
  console.log('\n[conn] connection round trips');
  const out = { tag: 'M' };
  if (config.offline || !config.rpcUrl)
    out.sepolia = { skipped: 'no RPC endpoint (set INFURA_PROJECT_ID or ETHEREUM_PROVIDER_URL)' };
  else {
    try {
      const provider = patient(config.rpcUrl);
      const t = [];
      const t0 = now();
      const net = await provider.getNetwork();
      const first = now() - t0;
      for (let i = 0; i < 30; i++) {
        const s = now();
        await provider.send('eth_blockNumber', []);
        t.push(now() - s);
        await sleep(50);
      }
      out.sepolia = {
        chainId: Number(net.chainId),
        firstCallMs: first,
        roundTripMs: summary(t),
        host: hostOf(config.rpcUrl),
      };
      console.log(
        `   Sepolia: first call ${f2(first, 0)} ms | round trip ${f2(out.sepolia.roundTripMs.mean, 1)} ms (n=30)`,
      );
    } catch (e) {
      out.sepolia = { error: String(e.message).slice(0, 160) };
      console.log('   Sepolia failed:', out.sepolia.error);
    }
  }
  let wsProvider = null;
  try {
    const { ApiPromise, WsProvider } = require('@polkadot/api');
    const t0 = now();
    wsProvider = new WsProvider(config.polkadotWs, false, undefined, 8000);
    const api = await Promise.race([
      ApiPromise.create({ provider: wsProvider }),
      sleep(15000).then(() => {
        throw new Error('timeout');
      }),
    ]);
    const connectMs = now() - t0,
      chain = String(await api.rpc.system.chain());
    const heads = [];
    let last = null;
    await new Promise((resolve) => {
      let n = 0;
      api.rpc.chain.subscribeNewHeads(() => {
        const t = now();
        if (last) heads.push(t - last);
        last = t;
        if (++n >= 6) resolve();
      });
      setTimeout(resolve, 40000);
    });
    out.polkadot = {
      endpointHost: hostOf(config.polkadotWs.replace('wss', 'https')),
      chain,
      connectMs,
      blockIntervalMs: summary(heads),
    };
    await api.disconnect();
    console.log(
      `   Polkadot (${chain}): connect ${f2(connectMs, 0)} ms | block interval ${f2(out.polkadot.blockIntervalMs.mean || NaN, 0)} ms`,
    );
  } catch (e) {
    out.polkadot = { skipped: String(e.message).slice(0, 120) };
    // stop the background reconnection attempts of the timed-out connection
    if (wsProvider) wsProvider.disconnect().catch(() => {});
    console.log('   Polkadot skipped:', out.polkadot.skipped);
  }
  rec.set('conn', out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// 8. Bee-algorithm validator routing (seeded queueing simulation, tag S; coordination time is measured)
// ---------------------------------------------------------------------------------------------

/**
 * Stage "bee": how well do different policies spread transactions over validators?
 *
 * This is a seeded queueing simulation (evidence tag S). Each round, a batch of transactions
 * arrives and a routing policy decides how many go to each validator. Validators have different
 * speeds and reliabilities. We then measure how evenly the load is spread (Jain's fairness index),
 * how long transactions wait, and how many fail. Only the time the policy itself takes to decide
 * is measured on this machine (tag M).
 *
 * Policies compared: random, round-robin, stake-weighted, least-loaded, and the Bee algorithm.
 */
function stageBee(config, rec) {
  console.log('\n[bee] validator routing vs baselines');

  const NUM_VALIDATORS = 40;
  const ROUNDS = 60;
  const SEEDS = config.n.beeSeeds;

  // Create the validators. 15% are "degraded" (unreliable). Speed is skewed so that
  // a few validators are much faster than the rest.
  function makeValidators(random) {
    return Array.from({ length: NUM_VALIDATORS }, () => {
      const degraded = random() < 0.15;
      return {
        txPerRound: 2 + 8 * random() ** 1.5, // service speed
        reliability: degraded ? 0.5 + 0.2 * random() : 0.85 + 0.15 * random(),
        stake: Math.exp(1.2 * randn(random)), // log-normal stake, used by stake-weighted routing
      };
    });
  }

  // Turn a list of weights into whole-number transaction counts that add up to batchSize
  // (largest-remainder rounding).
  function allocate(weights, batchSize) {
    const totalWeight = sum(weights) || 1;
    const shares = weights.map((w) => (w / totalWeight) * batchSize);
    const counts = shares.map(Math.floor);
    const leftover = batchSize - sum(counts);
    shares
      .map((share, index) => [share - Math.floor(share), index])
      .sort((a, b) => b[0] - a[0])
      .slice(0, leftover)
      .forEach(([, index]) => counts[index]++);
    return counts;
  }

  // Cost of an assignment: the time the slowest validator needs to clear its queue,
  // plus a penalty for transactions expected to fail on unreliable validators.
  function assignmentCost(counts, queues, validators) {
    let slowestFinish = 0;
    let expectedFailures = 0;
    for (let j = 0; j < validators.length; j++) {
      slowestFinish = Math.max(slowestFinish, (queues[j] + counts[j]) / validators[j].txPerRound);
      expectedFailures += counts[j] * (1 - validators[j].reliability);
    }
    return slowestFinish + 0.05 * expectedFailures;
  }

  // The Bee policy (artificial bee colony). Each "food source" is a vector of weights, one per
  // validator, that allocate() turns into an assignment. The colony improves the sources by
  // trying small random changes and keeping the ones with lower cost.
  function beePolicy(random, queues, validators, batchSize, warmStarts = []) {
    const NUM_BEES = 20; // number of food sources
    const ABANDON_AFTER = 6; // failed attempts before a source is replaced
    const CYCLES = 25;
    const dimensions = validators.length;

    const randomSource = () => Array.from({ length: dimensions }, () => random() + 0.05);
    const sources = Array.from({ length: NUM_BEES }, randomSource);
    // Extension: optionally start some of the sources from known good assignments (empty for the plain Bee policy).
    warmStarts.forEach((counts, i) => {
      sources[i] = counts.map((c) => c + 0.05);
    });
    const failedTries = new Array(NUM_BEES).fill(0);
    const costOf = (weights) => assignmentCost(allocate(weights, batchSize), queues, validators);
    const costs = sources.map(costOf);

    // Perturb one weight of source i using a random other source; keep the change if it is cheaper.
    function tryNeighbour(i) {
      const other = (i + 1 + Math.floor(random() * (NUM_BEES - 1))) % NUM_BEES;
      const dim = Math.floor(random() * dimensions);
      const candidate = sources[i].slice();
      candidate[dim] = Math.max(
        0.01,
        candidate[dim] + (random() * 2 - 1) * (candidate[dim] - sources[other][dim]),
      );
      const candidateCost = costOf(candidate);
      if (candidateCost < costs[i]) {
        sources[i] = candidate;
        costs[i] = candidateCost;
        failedTries[i] = 0;
      } else {
        failedTries[i]++;
      }
    }

    for (let cycle = 0; cycle < CYCLES; cycle++) {
      // 1. Employed bees: every source gets one attempt.
      for (let i = 0; i < NUM_BEES; i++) tryNeighbour(i);

      // 2. Onlooker bees: cheaper sources are chosen more often for extra attempts.
      const fitness = costs.map((c) => 1 / (1 + c));
      const totalFitness = sum(fitness);
      let attempts = 0;
      for (let i = 0; attempts < NUM_BEES; i = (i + 1) % NUM_BEES) {
        if (random() < (fitness[i] / totalFitness) * NUM_BEES * 0.5) {
          tryNeighbour(i);
          attempts++;
        }
        if (i === NUM_BEES - 1 && attempts === 0) attempts++; // guarantee the loop ends
      }

      // 3. Scout bees: sources that stopped improving are replaced by a fresh random one.
      for (let i = 0; i < NUM_BEES; i++) {
        if (failedTries[i] > ABANDON_AFTER) {
          sources[i] = randomSource();
          costs[i] = costOf(sources[i]);
          failedTries[i] = 0;
        }
      }
    }

    let best = 0;
    for (let i = 1; i < NUM_BEES; i++) if (costs[i] < costs[best]) best = i;
    return allocate(sources[best], batchSize);
  }

  // Greedy assignment: each transaction goes to the validator that would finish it soonest, where
  // `speedOf` says how fast a validator is considered to be.
  function greedyCounts(queues, validators, batchSize, speedOf) {
    const counts = new Array(NUM_VALIDATORS).fill(0);
    for (let i = 0; i < batchSize; i++) {
      let bestValidator = 0;
      let bestFinishTime = Infinity;
      for (let j = 0; j < NUM_VALIDATORS; j++) {
        const finishTime = (queues[j] + counts[j] + 1) / speedOf(validators[j]);
        if (finishTime < bestFinishTime) {
          bestFinishTime = finishTime;
          bestValidator = j;
        }
      }
      counts[bestValidator]++;
    }
    return counts;
  }

  // Each policy is a factory that returns a function (random, queues, validators, batchSize) => counts.
  const policies = {
    random: () => (random, queues, validators, batchSize) => {
      const counts = new Array(NUM_VALIDATORS).fill(0);
      for (let i = 0; i < batchSize; i++) counts[Math.floor(random() * NUM_VALIDATORS)]++;
      return counts;
    },
    roundRobin: () => {
      let next = 0;
      return (random, queues, validators, batchSize) => {
        const counts = new Array(NUM_VALIDATORS).fill(0);
        for (let i = 0; i < batchSize; i++) counts[next++ % NUM_VALIDATORS]++;
        return counts;
      };
    },
    stakeWeighted: () => (random, queues, validators, batchSize) =>
      allocate(
        validators.map((v) => v.stake),
        batchSize,
      ),
    // Greedy: send each transaction to the validator that would finish it soonest.
    leastLoaded: () => (random, queues, validators, batchSize) => {
      const counts = new Array(NUM_VALIDATORS).fill(0);
      for (let i = 0; i < batchSize; i++) {
        let bestValidator = 0;
        let bestFinishTime = Infinity;
        for (let j = 0; j < NUM_VALIDATORS; j++) {
          const finishTime = (queues[j] + counts[j] + 1) / validators[j].txPerRound;
          if (finishTime < bestFinishTime) {
            bestFinishTime = finishTime;
            bestValidator = j;
          }
        }
        counts[bestValidator]++;
      }
      return counts;
    },
    bee: () => beePolicy,
    // Extensions, added after the first results. They are reported separately and do not change the verdict.
    // greedyReliable: a stronger baseline that also avoids unreliable validators.
    greedyReliable: () => (random, queues, validators, batchSize) =>
      greedyCounts(queues, validators, batchSize, (v) => v.txPerRound * v.reliability),
    // beeWarm: the Bee search started from the two greedy assignments.
    beeWarm: () => (random, queues, validators, batchSize) =>
      beePolicy(random, queues, validators, batchSize, [
        greedyCounts(queues, validators, batchSize, (v) => v.txPerRound),
        greedyCounts(queues, validators, batchSize, (v) => v.txPerRound * v.reliability),
      ]),
  };

  // Run one policy for ROUNDS rounds at a given load and return its metrics.
  // load = batch size as a fraction of the total capacity of all validators.
  function simulate(policyName, seed, load) {
    const random = rng(seed);
    const validators = makeValidators(random);
    const batchSize = Math.round(load * sum(validators.map((v) => v.txPerRound)));
    const route = policies[policyName]();
    const queues = new Array(NUM_VALIDATORS).fill(0);
    const served = new Array(NUM_VALIDATORS).fill(0);
    const waits = []; // { weight: number of transactions, seconds: their wait }
    const decisionMs = [];
    let succeeded = 0;
    let failed = 0;

    for (let round = 0; round < ROUNDS; round++) {
      const startedAt = now();
      const counts = route(random, queues, validators, batchSize);
      decisionMs.push(now() - startedAt); // measured: time the policy needed to decide

      for (let j = 0; j < NUM_VALIDATORS; j++) {
        queues[j] += counts[j];
        const processed = Math.min(queues[j], validators[j].txPerRound);
        if (counts[j]) {
          const seconds =
            (queues[j] - counts[j]) / validators[j].txPerRound + // wait for older transactions
            counts[j] / 2 / validators[j].txPerRound + // average position inside the new batch
            1 / validators[j].txPerRound; // own service time
          waits.push({ weight: counts[j], seconds });
        }
        queues[j] -= processed;
        served[j] += processed;
        const lost = processed * (1 - validators[j].reliability);
        failed += lost;
        succeeded += processed - lost;
      }
    }

    // Jain's fairness index over validator utilisation: 1 = perfectly even, 1/n = one validator does everything.
    const utilisation = served.map((s, j) => s / (validators[j].txPerRound * ROUNDS));
    const jain = sum(utilisation) ** 2 / (NUM_VALIDATORS * sum(utilisation.map((u) => u * u)));

    const totalWeight = sum(waits.map((w) => w.weight));
    let cumulative = 0;
    let p95 = 0;
    for (const w of [...waits].sort((a, b) => a.seconds - b.seconds)) {
      cumulative += w.weight;
      if (cumulative / totalWeight >= 0.95) {
        p95 = w.seconds;
        break;
      }
    }

    return {
      jain,
      meanLatencyS: sum(waits.map((w) => w.weight * w.seconds)) / totalWeight,
      p95LatencyS: p95,
      successPerRound: succeeded / ROUNDS,
      failRate: failed / (succeeded + failed),
      coordMs: mean(decisionMs),
    };
  }

  const out = {
    tag: 'S',
    note: 'queueing simulation; coordination time is measured (M); validator clustering is not tested',
    validators: NUM_VALIDATORS,
    rounds: ROUNDS,
    seeds: SEEDS,
    loads: {},
  };

  // Repeat every policy over several seeds at three load levels and summarise each metric (mean, CI, ...).
  for (const load of [0.5, 0.8, 0.95]) {
    out.loads[load] = {};
    for (const policyName of Object.keys(policies)) {
      const runs = [];
      for (let s = 1; s <= SEEDS; s++) runs.push(simulate(policyName, 1000 + s, load));
      const summarised = {};
      for (const metric of Object.keys(runs[0]))
        summarised[metric] = summary(runs.map((r) => r[metric]));
      out.loads[load][policyName] = summarised;
    }
    const results = out.loads[load];
    console.log(
      `   load ${load}: ` +
        Object.keys(results)
          .map(
            (n) =>
              `${n} J=${f2(results[n].jain.mean, 3)} lat=${f2(results[n].meanLatencyS.mean, 2)}`,
          )
          .join(' | '),
    );
  }
  rec.set('bee', out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// 9. Proof-of-confidence: paper formula with real zk verdicts, then the deployed contract
// ---------------------------------------------------------------------------------------------

/** Make sure there are enough valid and tampered proofs in POOL for the confidence stage. */
async function ensurePool(config) {
  if (POOL.valid.length >= 20 && POOL.tampered.length >= 20) return;
  if (!ZK.vk) await zkSetup(config);
  const r = rng(12);
  for (let i = 0; POOL.valid.length < 20 || POOL.tampered.length < 20; i++) {
    const p = await zkProve(await zkInput(r), 'pool');
    POOL.valid.push({ proof: p.proof, publicSignals: p.publicSignals });
    const bad = JSON.parse(JSON.stringify(p.proof));
    bad.pi_a[0] = (BigInt(bad.pi_a[0]) + 1n).toString();
    POOL.tampered.push({ proof: bad, publicSignals: p.publicSignals });
  }
}
/** Area under the ROC curve: probability that a random good item scores higher than a random bad one. */
const aucOf = (pos, neg) => {
  let c = 0;
  for (const p of pos) for (const n of neg) c += p > n ? 1 : p === n ? 0.5 : 0;
  return c / (pos.length * neg.length);
};

/** Apply the paper's confidence formula to six kinds of transactions (legitimate plus five attack types), using real zk verdicts, and compare filtering rules on a held-out split. */
async function stageConfFormula(config) {
  await ensurePool(config);
  const W = { r: 0.3, p: 0.25, z: 0.3, n: 0.15 },
    P = { alpha: 0.7, beta: 0.3, lambda: 0.5, gamma: 1, delta: 0.6, k: 5, tau: 0.5, l: 6, L0: 0.7 },
    sig = (x) => 1 / (1 + Math.exp(x));
  const score = (f) =>
    W.r * (P.alpha * (f.succ / Math.max(1, f.total)) + P.beta * Math.exp(-P.lambda * f.failed)) +
    W.p * (P.gamma * Math.exp(-((f.freq - f.mu) ** 2) / (2 * f.sigma ** 2))) +
    W.z * (P.delta * f.Vp + (1 - P.delta) * sig(P.k * (f.tv - P.tau))) +
    W.n * Math.min(1, (f.avail / f.req) * sig(P.l * (f.L - P.L0)));
  // The four terms of the score before they are multiplied by their weights.
  const components = (f) => [
    P.alpha * (f.succ / Math.max(1, f.total)) + P.beta * Math.exp(-P.lambda * f.failed),
    P.gamma * Math.exp(-((f.freq - f.mu) ** 2) / (2 * f.sigma ** 2)),
    P.delta * f.Vp + (1 - P.delta) * sig(P.k * (f.tv - P.tau)),
    Math.min(1, (f.avail / f.req) * sig(P.l * (f.L - P.L0))),
  ];
  const r = rng(77),
    net = () => ({
      avail: 0.8 + 0.8 * r(),
      req: 1,
      L: Math.min(1, Math.max(0, 0.45 + 0.15 * randn(r))),
    });
  const good = () => {
    const total = 50 + Math.floor(r() * 400);
    return {
      total,
      succ: Math.round(total * (0.93 + 0.07 * r())),
      failed: Math.floor(r() * 2),
      mu: 1,
      sigma: 0.4,
      freq: 1 + 0.35 * randn(r),
      ...net(),
    };
  };
  const gen = {
    legit: () => ({ ...good(), zk: 'valid' }),
    invalidProof: () => ({ ...good(), zk: 'tampered' }),
    insufficientBalance: () => ({ ...good(), zk: 'none' }),
    sybilBurst: () => ({
      total: 1 + Math.floor(r() * 6),
      succ: 1 + Math.floor(r() * 3),
      failed: Math.floor(r() * 3),
      mu: 1,
      sigma: 0.4,
      freq: 3 + 2 * r(),
      ...net(),
      zk: 'valid',
    }),
    replayPattern: () => ({
      ...good(),
      freq: 3 + 1.5 * r(),
      failed: 2 + Math.floor(r() * 4),
      succ: 0,
      total: 100,
      zk: 'valid',
    }),
    lowRepValidProof: () => {
      const total = 80 + Math.floor(r() * 100);
      return {
        total,
        succ: Math.round(total * (0.35 + 0.3 * r())),
        failed: 3 + Math.floor(r() * 5),
        mu: 1,
        sigma: 0.4,
        freq: 1 + 0.4 * randn(r),
        ...net(),
        zk: 'valid',
      };
    },
  };
  const mix = { legit: config.n.confLegit };
  for (const k of Object.keys(gen)) if (k !== 'legit') mix[k] = Math.round(config.n.confAttack / 5);
  const recs = [];
  for (const [cls, n] of Object.entries(mix))
    for (let i = 0; i < n; i++) {
      const f = gen[cls]();
      let ok = false,
        tv = 0;
      if (f.zk === 'valid') {
        const g = POOL.valid[Math.floor(r() * POOL.valid.length)],
          v = await zkVerify(g.publicSignals, g.proof);
        ok = v.ok;
        tv = v.ms / 1000;
      } else if (f.zk === 'tampered') {
        const g = POOL.tampered[Math.floor(r() * POOL.tampered.length)],
          v = await zkVerify(g.publicSignals, g.proof);
        ok = v.ok;
        tv = Math.max(v.ms, 5) / 1000;
      }
      f.Vp = ok ? 1 : 0;
      f.tv = tv;
      recs.push({
        cls,
        bad: cls !== 'legit',
        zkOk: ok,
        s: score(f),
        c: components(f),
        rep: (P.alpha * f.succ) / Math.max(1, f.total),
      });
    }
  const rs = rng(123),
    calib = [],
    test = [];
  recs.forEach((x) => (rs() < 0.3 ? calib : test).push(x));
  const gate = (name, decide, good2, set = test) => {
    const by = {};
    for (const c of Object.keys(mix)) {
      const R = set.filter((x) => x.cls === c);
      by[c] = { n: R.length, flagged: R.filter((x) => !decide(x)).length / R.length };
    }
    const L = set.filter((x) => !x.bad),
      Bd = set.filter((x) => x.bad),
      tp = Bd.filter((x) => !decide(x)).length,
      fp = L.filter((x) => !decide(x)).length,
      prec = tp / Math.max(1, tp + fp),
      rc = tp / Bd.length;
    return {
      name,
      tpr: rc,
      fpr: fp / L.length,
      precision: prec,
      f1: (2 * prec * rc) / Math.max(1e-9, prec + rc),
      auc: good2 ? aucOf(L.map(good2), Bd.map(good2)) : null,
      detectionByClass: by,
    };
  };
  let THR = 0.5,
    bt = -1;
  for (let t = 0.3; t <= 0.95; t += 0.01) {
    const g = gate('c', (x) => x.s > t, null, calib);
    if (g.fpr <= 0.01 && g.tpr > bt) {
      bt = g.tpr;
      THR = +t.toFixed(2);
    }
  }
  // ---- Extension: learn the four weights instead of using the hand-set ones ----------------------
  // The score keeps its form (a weighted sum of the four terms). Only the weights change: they are fitted
  // on the calibration split with a class-balanced logistic regression that keeps every weight >= 0 and
  // then rescaled to sum to 1. The threshold is the value that lets 1% of legitimate calibration
  // transactions through. Nothing from the test split is used for fitting or for the threshold.
  function fitWeights(rows) {
    const goodCount = rows.filter((x) => !x.bad).length;
    const badCount = rows.length - goodCount;
    let w = [1, 1, 1, 1];
    let bias = -2;
    for (let iteration = 0; iteration < 3000; iteration++) {
      const gradW = [0, 0, 0, 0];
      let gradBias = 0;
      for (const x of rows) {
        const z = bias + w[0] * x.c[0] + w[1] * x.c[1] + w[2] * x.c[2] + w[3] * x.c[3];
        const probabilityGood = 1 / (1 + Math.exp(-z));
        const label = x.bad ? 0 : 1;
        const sampleWeight = 0.5 / (x.bad ? badCount : goodCount);
        const error = sampleWeight * (probabilityGood - label);
        for (let i = 0; i < 4; i++) gradW[i] += error * x.c[i];
        gradBias += error;
      }
      for (let i = 0; i < 4; i++) w[i] = Math.max(0, w[i] - 2 * (gradW[i] + 1e-3 * w[i]));
      bias -= 2 * gradBias;
    }
    const total = sum(w) || 1;
    return w.map((v) => v / total);
  }
  const weightedScore = (weights) => (x) => weights[0] * x.c[0] + weights[1] * x.c[1] + weights[2] * x.c[2] + weights[3] * x.c[3];
  const thresholdForOnePercent = (rows, scoreOf) => pct(rows.filter((x) => !x.bad).map(scoreOf), 0.01);
  const fitted = fitWeights(calib);
  const fittedScore = weightedScore(fitted);
  const fittedThreshold = thresholdForOnePercent(calib, fittedScore);

  // Repeated random 30/70 splits show how much the result depends on one particular split.
  const defaultWeights = [W.r, W.p, W.z, W.n];
  const repeated = { defaultWeights: { tpr: [], tprGated: [], fprGated: [] }, fittedWeights: { tpr: [], tprGated: [], fprGated: [] } };
  for (let repeat = 0; repeat < 30; repeat++) {
    const splitRandom = rng(5000 + repeat);
    const part = { calib: [], test: [] };
    recs.forEach((x) => (splitRandom() < 0.3 ? part.calib : part.test).push(x));
    const variants = {
      defaultWeights: weightedScore(defaultWeights),
      fittedWeights: weightedScore(fitWeights(part.calib)),
    };
    for (const [variant, scoreOf] of Object.entries(variants)) {
      const threshold = thresholdForOnePercent(part.calib, scoreOf);
      const legit = part.test.filter((x) => !x.bad);
      const bad = part.test.filter((x) => x.bad);
      repeated[variant].tpr.push(bad.filter((x) => !(scoreOf(x) > threshold)).length / bad.length);
      repeated[variant].tprGated.push(bad.filter((x) => !(x.zkOk && scoreOf(x) > threshold)).length / bad.length);
      repeated[variant].fprGated.push(legit.filter((x) => !(x.zkOk && scoreOf(x) > threshold)).length / legit.length);
    }
  }

  const out = {
    tag: 'S+M',
    note: 'transaction features simulated (S); zk verdicts come from the real Groth16 verifier (M); threshold chosen on a 30% calibration split, results on the 70% test split',
    weights: W,
    params: P,
    threshold: THR,
    counts: mix,
    nTest: test.length,
    nCalibration: calib.length,
    gates: {
      noFilter: gate('no filter', () => true, null),
      zkOnly: gate(
        'ZK verification only',
        (x) => x.zkOk,
        (x) => (x.zkOk ? 1 : 0),
      ),
      reputationOnly: gate(
        'reputation only (<0.5)',
        (x) => x.rep >= 0.5,
        (x) => x.rep,
      ),
      confidence: gate(
        `confidence > ${THR}`,
        (x) => x.s > THR,
        (x) => x.s,
      ),
      confidencePlusZkGate: gate(
        `ZK gate, then confidence > ${THR}`,
        (x) => x.zkOk && x.s > THR,
        (x) => (x.zkOk ? x.s : -1),
      ),
    },
    calibrated: {
      tag: 'S+M',
      note: 'weights fitted on the calibration split only (logistic regression, non-negative, sum to 1); threshold lets 1% of legitimate calibration transactions through; evaluated on the same test split',
      weights: { reputation: fitted[0], pattern: fitted[1], zk: fitted[2], network: fitted[3] },
      paperWeights: { reputation: W.r, pattern: W.p, zk: W.z, network: W.n },
      threshold: fittedThreshold,
      gates: {
        confidence: gate(`fitted confidence > ${f2(fittedThreshold, 3)}`, (x) => fittedScore(x) > fittedThreshold, fittedScore),
        confidencePlusZkGate: gate(
          `ZK gate, then fitted confidence > ${f2(fittedThreshold, 3)}`,
          (x) => x.zkOk && fittedScore(x) > fittedThreshold,
          (x) => (x.zkOk ? fittedScore(x) : -1),
        ),
      },
      repeatedSplits: {
        splits: 30,
        note: 'each split fits and thresholds on its own 30% and tests on its own 70%; both variants use the same 1% rule',
        defaultWeights: Object.fromEntries(Object.entries(repeated.defaultWeights).map(([k, v]) => [k, summary(v)])),
        fittedWeights: Object.fromEntries(Object.entries(repeated.fittedWeights).map(([k, v]) => [k, summary(v)])),
      },
    },
    sweep: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => {
      const g = gate('c', (x) => x.s > t, null);
      return { threshold: t, tpr: g.tpr, fpr: g.fpr, f1: g.f1 };
    }),
  };
  for (const g of Object.values(out.calibrated.gates))
    console.log(
      `   [fitted weights] ${g.name}: TPR ${f2(g.tpr * 100, 1)}% | FPR ${f2(g.fpr * 100, 1)}% | F1 ${f2(g.f1, 3)} | AUC ${g.auc == null ? '-' : f2(g.auc, 3)}`,
    );
  {
    const rs30 = out.calibrated.repeatedSplits;
    console.log(
      `   30 random splits, ZK gate + confidence: paper weights TPR ${f2(rs30.defaultWeights.tprGated.mean * 100, 1)}% | fitted weights TPR ${f2(rs30.fittedWeights.tprGated.mean * 100, 1)}% +/- ${f2(rs30.fittedWeights.tprGated.ci95 * 100, 1)} (FPR ${f2(rs30.fittedWeights.fprGated.mean * 100, 1)}%)`,
    );
  }
  for (const g of Object.values(out.gates))
    console.log(
      `   ${g.name}: TPR ${f2(g.tpr * 100, 1)}% | FPR ${f2(g.fpr * 100, 1)}% | F1 ${f2(g.f1, 3)} | AUC ${g.auc == null ? '-' : f2(g.auc, 3)}`,
    );
  return out;
}

/** Stage conf: run the confidence formula test and store the result. */
async function stageConf(config, rec) {
  console.log('\n[conf] proof-of-confidence filtering');
  rec.set('conf', { formula: await stageConfFormula(config) });
}

// ---------------------------------------------------------------------------------------------
// 10. Deployed Sepolia contracts
// ---------------------------------------------------------------------------------------------

/** Fixed-point 1.0 used by the contracts (18 decimals). */
const ONE = 10n ** 18n;
/** Stage chain: check the deployed Sepolia contracts have code, call their read-only functions, test the on-chain RBF maths, and (with --send) send real transactions. */
async function stageChain(config, rec) {
  console.log('\n[chain] deployed Sepolia contracts');
  await sleep(3000);
  const out = { tag: 'M' };
  if (config.offline || !config.rpcUrl) {
    out.skipped = 'no RPC endpoint (set INFURA_PROJECT_ID or ETHEREUM_PROVIDER_URL)';
    console.log('   skipped:', out.skipped);
    rec.set('chain', out);
    return out;
  }
  const provider = await connectSepolia(config),
    wallet = config.privateKey ? new ethers.Wallet(config.privateKey, provider) : null,
    signer = wallet && new ethers.NonceManager(wallet);
  const from = wallet ? wallet.address : '0x000000000000000000000000000000000000dEaD';
  out.sender = from;
  out.head = await provider.getBlockNumber();
  out.deployed = {};
  for (const [name, a] of Object.entries(config.addresses)) {
    const code = await provider.getCode(a);
    out.deployed[name] = {
      address: a,
      deployed: code !== '0x',
      codeBytes: (code.length - 2) / 2,
      codeKeccak: code === '0x' ? null : ethers.keccak256(code),
    };
    console.log(
      `   ${name} ${a}: ${out.deployed[name].deployed ? out.deployed[name].codeBytes + ' bytes of code' : 'NO CODE'}`,
    );
  }
  const at = (name, runner) =>
    new ethers.Contract(config.addresses[name], ABI[name], runner || provider);

  // ---- ConfidenceScoreCalculator: read-only probes, then a contract-in-the-loop detection run
  if (out.deployed.ConfidenceScoreCalculator.deployed) {
    const cs = at('ConfidenceScoreCalculator'),
      c = {};
    try {
      c.thresholds = {
        high: Number(await cs.HIGH_CONFIDENCE_THRESHOLD()),
        low: Number(await cs.LOW_CONFIDENCE_THRESHOLD()),
      };
      c.weights = {
        sender: Number(await cs.SENDER_REPUTATION_WEIGHT()),
        pattern: Number(await cs.TRANSACTION_PATTERN_WEIGHT()),
        zk: Number(await cs.ZK_VERIFICATION_WEIGHT()),
        network: Number(await cs.NETWORK_STATE_WEIGHT()),
      };
      const call = async (f, zk, load) =>
        Number(await cs.calculateConfidenceScore.staticCall(from, f, zk, load, { from }));
      const grid = [];
      for (const f of [0, 1, 2, 5, 10, 50, 100, 1000])
        for (const zk of [true, false])
          for (const L of [0, 0.2, 0.5, 0.7, 0.9, 1]) {
            let s = null;
            try {
              s = await call(f, zk, BigInt(Math.round(L * 1e6)) * 10n ** 12n);
            } catch (e) {
              s = null;
            }
            grid.push({ f, zk, load: L, score: s });
          }
      const ok = grid.filter((g) => g.score != null),
        sc = ok.map((g) => g.score),
        valid = ok.filter((g) => g.zk),
        inval = ok.filter((g) => !g.zk);
      const paired = valid
        .map((g) => {
          const m = inval.find((h) => h.f === g.f && h.load === g.load);
          return m ? g.score - m.score : null;
        })
        .filter((x) => x != null);
      c.grid = {
        calls: grid.length,
        answered: ok.length,
        minScore: Math.min(...sc),
        maxScore: Math.max(...sc),
        minScoreOverHigh: Math.min(...sc) / c.thresholds.high,
        validMinusInvalid: summary(paired.map(Number)),
        invalidProofAboveLowThreshold:
          inval.filter((g) => g.score >= c.thresholds.low).length / Math.max(1, inval.length),
        invalidProofAboveHighThreshold:
          inval.filter((g) => g.score >= c.thresholds.high).length / Math.max(1, inval.length),
      };
      c.scaleMismatch = c.grid.minScore >= c.thresholds.high;
      // detection workload scored by the deployed contract
      const r = rng(2024),
        cache = new Map(),
        score = async (f, zk, L) => {
          const k = `${f}|${zk}|${L}`;
          if (!cache.has(k))
            cache.set(k, await call(f, zk, BigInt(Math.round(L * 1e6)) * 10n ** 12n));
          return cache.get(k);
        };
      const classes = {
        legit: () => [1 + Math.floor(r() * 3), true, 0.3 + 0.4 * r()],
        invalidProof: () => [1 + Math.floor(r() * 3), false, 0.3 + 0.4 * r()],
        burst: () => [50 + Math.floor(r() * 150), true, 0.3 + 0.4 * r()],
        congested: () => [1 + Math.floor(r() * 3), true, 0.95 + 0.05 * r()],
      };
      const set = [];
      for (const [cls, mk] of Object.entries(classes))
        for (let i = 0; i < 100; i++) {
          const [f, zk, L] = mk();
          set.push({ cls, bad: cls !== 'legit', s: await score(f, zk, +L.toFixed(2)) });
        }
      const Lg = set.filter((x) => !x.bad),
        Bd = set.filter((x) => x.bad);
      c.detection = {
        tag: 'S+M',
        note: 'transactions simulated (S); every score comes from the deployed contract (M)',
        n: set.length,
        auc: aucOf(
          Lg.map((x) => x.s),
          Bd.map((x) => x.s),
        ),
        atDeployedLowThreshold: {
          tpr: Bd.filter((x) => x.s < c.thresholds.low).length / Bd.length,
          fpr: Lg.filter((x) => x.s < c.thresholds.low).length / Lg.length,
        },
        // Diagnostic only: the scores look like 18-decimal fixed point (1.0 = 1e18) while the thresholds are
        // on a 0..1000 scale. This shows what the same scores would do if the thresholds were rescaled by 1e15.
        atRescaledLowThreshold: (() => {
          const rescaled = c.thresholds.low * 1e15;
          const flagged = (k) => {
            const rows = set.filter((x) => x.cls === k);
            return rows.filter((x) => x.s < rescaled).length / rows.length;
          };
          return {
            threshold: rescaled,
            tpr: Bd.filter((x) => x.s < rescaled).length / Bd.length,
            fpr: Lg.filter((x) => x.s < rescaled).length / Lg.length,
            flaggedByClass: Object.fromEntries(Object.keys(classes).map((k) => [k, flagged(k)])),
          };
        })(),
        byClass: Object.fromEntries(
          Object.keys(classes).map((k) => [
            k,
            {
              medianScore: pct(
                set.filter((x) => x.cls === k).map((x) => x.s),
                0.5,
              ),
            },
          ]),
        ),
      };
      console.log(
        `   ConfidenceScoreCalculator: scores ${c.grid.minScore.toExponential(2)} .. ${c.grid.maxScore.toExponential(2)} vs thresholds ${c.thresholds.low}/${c.thresholds.high} | AUC ${f2(c.detection.auc, 3)} | TPR at LOW threshold ${f2(c.detection.atDeployedLowThreshold.tpr * 100, 1)}%`,
      );
    } catch (e) {
      c.error = String(e.message).slice(0, 200);
      console.log('   ConfidenceScoreCalculator probe failed:', c.error);
    }
    out.confidenceScoreCalculator = c;
  }
  // ---- SpeculativeTransactionHandler: on-chain Gaussian-RBF evaluation vs double precision
  if (out.deployed.SpeculativeTransactionHandler.deployed) {
    const h = at('SpeculativeTransactionHandler'),
      rb = { rows: [] };
    try {
      const abi = ethers.AbiCoder.defaultAbiCoder();
      for (const beta of [0.5, 1, 2, 4])
        for (const spread of [0.1, 0.25, 0.5, 1, 1.5]) {
          const xs = [0, 1, 2, 3].map((i) => i * spread),
            lam = [0.25, 0.25, 0.25, 0.25],
            pts = xs.map((x, i) => [
              BigInt(Math.round(x * 1e6)) * 10n ** 12n,
              0n,
              BigInt(Math.round(lam[i] * 1e6)) * 10n ** 12n,
            ]);
          const data = abi.encode(['tuple(uint256 x,uint256 y,uint256 lambda)[]'], [pts]);
          let on = null,
            err = null;
          try {
            const ret = await h.calculateRBFInterpolation.staticCall(
              ethers.id('probe' + beta + spread),
              data,
              BigInt(Math.round(beta * 1e6)) * 10n ** 12n,
              { from },
            );
            on = abi.decode(['uint256[]'], ret)[0].map((v) => Number(v) / 1e18);
          } catch (e) {
            err = String(e.shortMessage || e.message).slice(0, 80);
          }
          const ref = xs.map((xi) =>
              sum(xs.map((xj, j) => lam[j] * Math.exp(-beta * (xi - xj) ** 2))),
            ),
            zmax = beta * (3 * spread) ** 2;
          rb.rows.push({
            beta,
            spread,
            maxArgument: zmax,
            onChain: on,
            reference: ref,
            maxAbsError: on ? Math.max(...on.map((v, i) => Math.abs(v - ref[i]))) : null,
            error: err,
          });
        }
      const okRows = rb.rows.filter((x) => x.onChain);
      rb.answered = okRows.length;
      rb.calls = rb.rows.length;
      rb.errorWhenArgumentBelow1 = okRows.filter((x) => x.maxArgument <= 1).length
        ? Math.max(...okRows.filter((x) => x.maxArgument <= 1).map((x) => x.maxAbsError))
        : null;
      rb.errorWhenArgumentAbove3 = okRows.filter((x) => x.maxArgument >= 3).length
        ? Math.max(...okRows.filter((x) => x.maxArgument >= 3).map((x) => x.maxAbsError))
        : null;
      rb.note =
        'The contract evaluates sum_j lambda_j exp(-beta d_ij^2) for caller-supplied weights with a 5-term series for exp(-z); it does not solve for the weights.';
      console.log(
        `   SpeculativeTransactionHandler: ${rb.answered}/${rb.calls} calls answered | max |error| z<=1: ${rb.errorWhenArgumentBelow1 == null ? '-' : rb.errorWhenArgumentBelow1.toExponential(2)} | z>=3: ${rb.errorWhenArgumentAbove3 == null ? '-' : rb.errorWhenArgumentAbove3.toExponential(2)}`,
      );
    } catch (e) {
      rb.error = String(e.message).slice(0, 200);
      console.log('   RBF probe failed:', rb.error);
    }
    out.speculativeTransactionHandler = rb;
  }
  // ---- Transactions (only with --send)
  if (config.send && signer) {
    out.transactions = {
      tag: 'M',
      note: 'real Sepolia transactions; ms = send to receipt',
      rows: [],
    };
    const N = config.n.onchain,
      chain = { provider, local: false },
      rows = out.transactions.rows;
    if (out.deployed.AssetTransferProcessor.deployed) {
      const at1 = at('AssetTransferProcessor', signer);
      for (let i = 0; i < N; i++) {
        const txId = ethers.id('pays-asset-' + Date.now() + '-' + i),
          lock = ethers.id('preimage' + i);
        try {
          const rc = await sendCall(
            chain,
            at1,
            'initiateAssetTransfer',
            [txId, from, 1n + BigInt(i), lock],
            'initiateAssetTransfer',
          );
          const st = await at1.assetTransfers(txId);
          rows.push({
            ...rc,
            stateMatches: st.hashLock === lock && st.amount === 1n + BigInt(i) && !st.isCompleted,
          });
          console.log(
            `   initiateAssetTransfer ${i + 1}/${N}: ${f2(rc.ms / 1000, 1)} s, gas ${rc.gas}, state matches ${rows[rows.length - 1].stateMatches}`,
          );
        } catch (e) {
          rows.push({
            label: 'initiateAssetTransfer',
            error: String(e.shortMessage || e.message).slice(0, 100),
          });
          console.log('   initiateAssetTransfer failed:', rows[rows.length - 1].error);
          break;
        }
      }
    }
    if (out.deployed.ConfidenceScoreCalculator.deployed) {
      const cs = at('ConfidenceScoreCalculator', signer);
      for (let i = 0; i < N; i++) {
        try {
          const rc = await sendCall(
            chain,
            cs,
            'updateTransactionFrequency',
            [BigInt(1 + (i % 3))],
            'updateTransactionFrequency',
          );
          rows.push(rc);
          console.log(
            `   updateTransactionFrequency ${i + 1}/${N}: ${f2(rc.ms / 1000, 1)} s, gas ${rc.gas}`,
          );
        } catch (e) {
          rows.push({
            label: 'updateTransactionFrequency',
            error: String(e.shortMessage || e.message).slice(0, 100),
          });
          break;
        }
      }
      try {
        const reader = at('ConfidenceScoreCalculator');
        out.confidenceScoreCalculator = out.confidenceScoreCalculator || {};
        out.confidenceScoreCalculator.afterFrequencyUpdates = {
          scoreValidProof: Number(
            await reader.calculateConfidenceScore.staticCall(from, 2, true, ONE / 2n, { from }),
          ),
          scoreInvalidProof: Number(
            await reader.calculateConfidenceScore.staticCall(from, 2, false, ONE / 2n, { from }),
          ),
        };
      } catch (e) {
        /* ignore */
      }
    }
    if (out.deployed.PacechainChannel.deployed) {
      const ch = at('PacechainChannel', signer);
      try {
        const role = await ch.CHANNEL_OPERATOR(),
          has = await ch.hasRole(role, from);
        out.channelOperator = { account: from, hadRole: has };
        if (!has) {
          const adminRole = await ch.DEFAULT_ADMIN_ROLE();
          if (await ch.hasRole(adminRole, from))
            rows.push(
              await sendCall(chain, ch, 'grantRole', [role, from], 'grantRole(CHANNEL_OPERATOR)'),
            );
          else throw new Error('account has neither CHANNEL_OPERATOR nor DEFAULT_ADMIN_ROLE');
        }
        for (let i = 0; i < Math.min(N, 3); i++) {
          const rc = await sendCall(
            chain,
            ch,
            'createChannel',
            [
              from,
              ethers.getAddress(
                '0x' +
                  (0xdead0n + BigInt(Date.now() % 1000000) * 16n + BigInt(i))
                    .toString(16)
                    .padStart(40, '0'),
              ),
              500n,
            ],
            'createChannel',
          );
          rows.push(rc);
          console.log(`   createChannel ${i + 1}: ${f2(rc.ms / 1000, 1)} s, gas ${rc.gas}`);
          await sleep(1500);
        }
      } catch (e) {
        rows.push({
          label: 'createChannel',
          error: String(e.shortMessage || e.message).slice(0, 120),
        });
        console.log('   createChannel not run:', rows[rows.length - 1].error);
      }
    }
    const okRows = rows.filter((x) => !x.error);
    out.transactions.gasByCall = {};
    out.transactions.confirmMsByCall = {};
    for (const l of [...new Set(okRows.map((x) => x.label))]) {
      out.transactions.gasByCall[l] = summary(
        okRows.filter((x) => x.label === l).map((x) => x.gas),
      );
      out.transactions.confirmMsByCall[l] = summary(
        okRows.filter((x) => x.label === l).map((x) => x.ms),
      );
    }
  } else
    out.transactions = {
      skipped:
        'run with --send (and a funded PRIVATE_KEY) to send transactions to the deployed contracts',
    };
  rec.set('chain', out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// 11. Claim verdicts (explicit rules, evaluated on the recorded numbers)
// ---------------------------------------------------------------------------------------------

/** Turn the recorded numbers into PASS / NOT SUPPORTED / INCONCLUSIVE for each claim. The rule for each verdict is stored next to it. */
function verdicts(D) {
  const C = {},
    st = Object.fromEntries(Object.entries(D.stages).filter(([, v]) => v && !v.error)),
    V = (id, claim, verdict, rule, detail) => {
      C[id] = { claim, verdict, rule, detail };
    };
  const frac = (s) => {
    const [a, b] = String(s).split('/').map(Number);
    return b ? a / b : NaN;
  };
  if (st.zk) {
    const k = st.zk.checks,
      ok =
        frac(k.completeness) === 1 &&
        frac(k.tamperedProofRejected) === 1 &&
        frac(k.wrongPublicInputRejected) === 1 &&
        frac(k.invalidWitnessUnprovable.insufficientBalance) === 1 &&
        frac(k.invalidWitnessUnprovable.zeroNonce) === 1;
    V(
      'zk',
      'Groth16 confirmation accepts valid transfers and rejects forged ones',
      ok ? 'PASS' : 'NOT SUPPORTED',
      'all valid proofs verify; every tampered proof, altered public input and unsatisfiable witness is rejected',
      {
        constraints: st.zk.circuit.constraints,
        proveMsMean: st.zk.proveMs.mean,
        verifyMsMean: st.zk.verifyMs.mean,
        ...k,
      },
    );
  }
  if (st.rbf) {
    const parts = {};
    let allBetter = true,
      anyWorse = false;
    for (const [n, R] of Object.entries(st.rbf.results)) {
      const m = R.models;
      // If repeating the last value is already within tolerance almost every time, the target is
      // saturated: no predictor can show an improvement, so it is reported but not used for the verdict.
      if (m.persistence.hitRate >= 0.99) {
        parts[n] = {
          excluded: `saturated: repeating the last value is already within tolerance in ${f2(m.persistence.hitRate * 100, 1)}% of blocks`,
          rbfMae: m.rbf.mae,
          persistenceMae: m.persistence.mae,
        };
        continue;
      }
      const [lo, hi] = R.rbfMinusPersistenceMaeCi95;
      const compare = (ci) => (ci[1] < 0 ? 'RBF better' : ci[0] > 0 ? 'RBF worse' : 'no clear difference');
      const baselines = ['persistence', 'movingAverage8', 'linear8'];
      const bestBaseline = baselines.reduce((a, b) => (m[a].mae <= m[b].mae ? a : b));
      parts[n] = {
        rbfMae: m.rbf.mae,
        persistenceMae: m.persistence.mae,
        diffCi95: [lo, hi],
        rbfHit: m.rbf.hitRate,
        persistenceHit: m.persistence.hitRate,
        versusOtherBaselines: Object.fromEntries(
          baselines.map((b) => [b, { mae: m[b].mae, hitRate: m[b].hitRate, result: R.rbfMinusBaselineMaeCi95 ? compare(R.rbfMinusBaselineMaeCi95[b]) : 'not computed' }]),
        ),
        bestSimpleBaseline: bestBaseline,
        tunedRbf: m.rbfTuned && {
          settings: R.tuned.selected,
          mae: m.rbfTuned.mae,
          hitRate: m.rbfTuned.hitRate,
          versus: Object.fromEntries(
            ['persistence', 'movingAverage8', 'linear8', 'defaultRbf'].map((b) => [b, compare(R.tuned.minusBaselineMaeCi95[b])]),
          ),
        },
      };
      if (!(hi < 0)) allBetter = false;
      if (lo > 0) anyWorse = true;
    }
    const used = Object.values(parts).filter((p) => !p.excluded).length;
    V(
      'rbf',
      'Gaussian-RBF speculation predicts the next block state more accurately than a naive predictor',
      !used ? 'INCONCLUSIVE' : allBetter ? 'PASS' : anyWorse ? 'NOT SUPPORTED' : 'INCONCLUSIVE',
      'bootstrap 95% CI of (RBF MAE - persistence MAE) lies entirely below zero for every target that is not saturated; entirely above zero for any such target = not supported. Comparison with the moving-average and linear baselines is reported but does not change the verdict',
      { evidence: st.rbf.tag, source: st.rbf.source, ...parts },
    );
  }
  if (st.dual && st.dual.local) {
    const L = st.dual.local,
      sp = L.speculativeMs.mean + L.speculativeMs.ci95 < L.baselineMs.mean - L.baselineMs.ci95;
    V(
      'dual',
      'The speculative leg of the dual transaction is usable sooner than the wait-then-relay baseline',
      sp && L.allFinalized && L.allValuesCorrect ? 'PASS' : sp ? 'INCONCLUSIVE' : 'NOT SUPPORTED',
      'speculative-visibility 95% interval lies below the baseline interval and every confirmable leg finalises with the correct value',
      {
        baselineMs: L.baselineMs.mean,
        speculativeMs: L.speculativeMs.mean,
        finalMs: L.finalMs.mean,
        mispredictionRate: L.mispredictionRate,
        speculativeSpeedup: L.speculativeSpeedup,
        correctUsableSpeedup: L.correctUsableSpeedup,
        finalOverheadMs: L.finalOverheadMs,
        note: 'confirmed finality is slower than the baseline by the proof-generation time',
      },
    );
  }
  if (st.bee) {
    const det = {};
    let pass = true;
    let loadsWon = 0;
    for (const [rho, P] of Object.entries(st.bee.loads)) {
      const b = P.bee.jain,
        beats = {};
      for (const o of ['random', 'roundRobin', 'stakeWeighted']) {
        const x = P[o].jain;
        beats[o] = b.mean - x.mean > b.ci95 + x.ci95;
        if (!beats[o]) pass = false;
      }
      if (Object.values(beats).every(Boolean)) loadsWon++;
      det[rho] = {
        beeJain: b.mean,
        beeLatencyS: P.bee.meanLatencyS.mean,
        beats,
        // secondary results: reported, but the verdict above depends on Jain's index only
        latencyReductionVsRandomPct: (1 - P.bee.meanLatencyS.mean / P.random.meanLatencyS.mean) * 100,
        failRateBeePct: P.bee.failRate.mean * 100,
        failRateRandomPct: P.random.failRate.mean * 100,
        decisionTimeMs: { bee: P.bee.coordMs.mean, leastLoaded: P.leastLoaded.coordMs.mean },
        extensions: Object.fromEntries(
          ['greedyReliable', 'beeWarm']
            .filter((name) => P[name])
            .map((name) => [
              name,
              {
                jain: P[name].jain.mean,
                meanLatencyS: P[name].meanLatencyS.mean,
                failRatePct: P[name].failRate.mean * 100,
                decisionTimeMs: P[name].coordMs.mean,
              },
            ]),
        ),
        leastLoadedJain: P.leastLoaded.jain.mean,
        leastLoadedLatencyS: P.leastLoaded.meanLatencyS.mean,
        beatsLeastLoaded: b.mean - P.leastLoaded.jain.mean > b.ci95 + P.leastLoaded.jain.ci95,
      };
    }
    V(
      'bee',
      'Bee-algorithm routing balances validator load better than naive policies',
      pass ? 'PASS' : loadsWon > 0 ? 'PARTIAL' : 'NOT SUPPORTED',
      "Jain's index of the Bee policy exceeds random, round-robin and stake-weighted routing by more than the combined 95% intervals at every load (PASS), at some loads only (PARTIAL), or at none (NOT SUPPORTED). The greedy least-loaded policy is reported but not required",
      { evidence: 'S', loadsWon, ...det },
    );
  }
  if (st.conf && st.conf.formula) {
    const G = st.conf.formula.gates,
      c = G.confidence,
      g = G.confidencePlusZkGate,
      ok = g.tpr >= 0.9 && g.fpr <= 0.05 && c.auc > G.reputationOnly.auc;
    V(
      'confidence',
      'The proof-of-confidence score filters bad transactions at a low false-positive cost',
      ok ? 'PASS' : g.tpr > G.zkOnly.tpr ? 'INCONCLUSIVE' : 'NOT SUPPORTED',
      'ZK gate plus confidence threshold reaches TPR >= 0.90 with FPR <= 0.05 on the held-out split and the score has a higher AUC than reputation alone',
      {
        evidence: st.conf.formula.tag,
        threshold: st.conf.formula.threshold,
        confidenceAuc: c.auc,
        reputationAuc: G.reputationOnly.auc,
        tprGated: g.tpr,
        fprGated: g.fpr,
        tprZkOnly: G.zkOnly.tpr,
        tprReputationOnly: G.reputationOnly.tpr,
      },
    );
  }
  if (st.conf && st.conf.formula && st.conf.formula.calibrated) {
    // Same rule as above, applied to the score with fitted weights. The mean of 30 random splits is used
    // because a single split can be lucky or unlucky.
    const cal = st.conf.formula.calibrated,
      rs = cal.repeatedSplits,
      g = cal.gates.confidencePlusZkGate,
      tpr = rs.fittedWeights.tprGated.mean,
      fpr = rs.fittedWeights.fprGated.mean,
      ok = tpr >= 0.9 && fpr <= 0.05 && g.auc > st.conf.formula.gates.reputationOnly.auc;
    V(
      'confidenceFitted',
      'With weights fitted on a calibration split, the proof-of-confidence score filters bad transactions at a low false-positive cost',
      ok ? 'PASS' : tpr > rs.defaultWeights.tprGated.mean ? 'INCONCLUSIVE' : 'NOT SUPPORTED',
      'mean over 30 random 30/70 splits: ZK gate plus confidence threshold reaches TPR >= 0.90 with FPR <= 0.05, and the AUC on the main split exceeds reputation alone. Weights and threshold use the calibration part only',
      {
        evidence: cal.tag,
        fittedWeights: cal.weights,
        paperWeights: cal.paperWeights,
        tprGatedMean30: tpr,
        tprGatedCi95: rs.fittedWeights.tprGated.ci95,
        fprGatedMean30: fpr,
        tprGatedMeanWithPaperWeights30: rs.defaultWeights.tprGated.mean,
        mainSplit: { tpr: g.tpr, fpr: g.fpr, auc: g.auc },
        weakestClass: Object.entries(g.detectionByClass)
          .filter(([k]) => k !== 'legit')
          .sort((a, b) => a[1].flagged - b[1].flagged)[0],
      },
    );
  }
  if (st.chain && st.chain.deployed) {
    const dep = Object.values(st.chain.deployed),
      all = dep.every((x) => x.deployed),
      cs = st.chain.confidenceScoreCalculator,
      rb = st.chain.speculativeTransactionHandler;
    const findings = [];
    if (!all) findings.push('at least one referenced address has no bytecode');
    if (cs && cs.scaleMismatch)
      findings.push(
        'every score returned by the deployed ConfidenceScoreCalculator is below its own high-confidence threshold (unit mismatch)',
      );
    if (cs && cs.grid && cs.grid.validMinusInvalid && cs.grid.validMinusInvalid.mean === 0)
      findings.push('the zk flag does not change the deployed score');
    if (cs && cs.detection && cs.detection.atDeployedLowThreshold.tpr < 0.5)
      findings.push(
        'the deployed thresholds flag fewer than half of the injected bad transactions',
      );
    if (rb && rb.errorWhenArgumentAbove3 != null && rb.errorWhenArgumentAbove3 > 0.05)
      findings.push(
        'on-chain Gaussian evaluation departs from exp(-z) by more than 0.05 once beta*d^2 >= 3',
      );
    V(
      'contracts',
      'The deployed Sepolia contracts implement the behaviour the paper describes',
      !all
        ? 'NOT SUPPORTED'
        : cs || rb
          ? findings.length
            ? 'NOT SUPPORTED'
            : 'PASS'
          : 'INCONCLUSIVE',
      'bytecode exists at each address, the confidence contract returns scores on the scale of its thresholds and reacts to the zk flag, and the on-chain RBF evaluation tracks exp(-z) on the supported range',
      {
        findings,
        deployed: Object.fromEntries(
          Object.entries(st.chain.deployed).map(([k, v]) => [k, v.deployed]),
        ),
      },
    );
  } else
    V(
      'contracts',
      'The deployed Sepolia contracts implement the behaviour the paper describes',
      'INCONCLUSIVE',
      'needs an RPC endpoint',
      { skipped: true },
    );
  return C;
}

// ---------------------------------------------------------------------------------------------
// 12. Report files
// ---------------------------------------------------------------------------------------------

/** Write tables.tex, summary.md and manifest.json from the recorded results. */
function writeReport(config, D) {
  const st = Object.fromEntries(Object.entries(D.stages).filter(([, v]) => v && !v.error)),
    m = (s, d = 1) => (s && s.n ? `${f2(s.mean, d)} $\\pm$ ${f2(s.ci95, d)}` : '--'),
    T = [];
  const tab = (cap, lab, head, rows, tag) =>
    T.push(
      `\\begin{table}[t]\n\\centering\n\\caption{${cap} [${tag}]}\n\\label{${lab}}\n\\begin{tabular}{${'l' + 'r'.repeat(head.length - 1)}}\n\\toprule\n${head.join(' & ')} \\\\\n\\midrule\n${rows.map((r) => r.join(' & ') + ' \\\\').join('\n')}\n\\bottomrule\n\\end{tabular}\n\\end{table}\n`,
    );
  if (st.zk)
    tab(
      'Cost of the Groth16 confirmation (mean $\\pm$ 95\\% CI)',
      'tab:zk',
      ['Quantity', 'Value'],
      [
        ['Constraints', String(st.zk.circuit.constraints)],
        ['Witness (ms)', m(st.zk.witnessMs)],
        ['Proof generation (ms)', m(st.zk.proveMs)],
        ['Verification (ms)', m(st.zk.verifyMs, 2)],
        ['Proof size (bytes)', String(st.zk.proofBytesGroth16Bn254)],
        ['Valid proofs accepted', st.zk.checks.completeness],
        ['Tampered proofs rejected', st.zk.checks.tamperedProofRejected],
        ['Altered public input rejected', st.zk.checks.wrongPublicInputRejected],
      ],
      'M',
    );
  if (st.rbf) {
    const rows = [];
    for (const [n, R] of Object.entries(st.rbf.results))
      for (const [k, v] of Object.entries(R.models))
        rows.push([`${n}, ${k}`, f2(v.mae, 4), f2(v.rmse, 4), f2(v.hitRate * 100, 1) + '\\%']);
    tab(
      `One-block-ahead prediction on ${st.rbf.blocks} blocks (${st.rbf.source}), held-out 40\\%`,
      'tab:rbf',
      ['Target, model', 'MAE', 'RMSE', 'Hit rate'],
      rows,
      st.rbf.tag,
    );
  }
  if (st.dual && st.dual.local) {
    const L = st.dual.local;
    tab(
      `Local two-chain dual-transaction latency (${L.trials} trials, block times ${config.n.blockA}/${config.n.blockB} s)`,
      'tab:dual',
      ['Path', 'Latency (ms)'],
      [
        ['Wait-then-relay baseline', m(L.baselineMs, 0)],
        ['Speculative visible', m(L.speculativeMs, 0)],
        ['Confirmed (zk verified)', m(L.finalMs, 0)],
        ['Misprediction rate', f2(L.mispredictionRate * 100, 1) + '\\%'],
        ['Confirm gas (Groth16)', m(L.gas.confirmWithZk, 0)],
      ],
      'M',
    );
  }
  if (st.dual && st.dual.sepolia && st.dual.sepolia.trials) {
    const S = st.dual.sepolia;
    tab(
      `Sepolia commits (${S.trials} trials)`,
      'tab:sep',
      ['Path', 'Time (ms)'],
      [
        ['Plain commit', m(S.plainCommitMs, 0)],
        ['Direct zk commit', m(S.directZkCommitMs, 0)],
        ['Speculative visible', m(S.speculativeVisibleMs, 0)],
        ['Dual, verified', m(S.dualFinalMs, 0)],
        ['Confirm gas', m(S.gas.confirmWithZk, 0)],
      ],
      'M',
    );
  }
  if (st.bee) {
    const rows = [];
    for (const [rho, P] of Object.entries(st.bee.loads))
      for (const [n, x] of Object.entries(P))
        rows.push([
          `${rho}, ${n}`,
          m(x.jain, 3),
          m(x.meanLatencyS, 2),
          f2(x.failRate.mean * 100, 1) + '\\%',
          f2(x.coordMs.mean, 2),
        ]);
    tab(
      `Validator routing (${st.bee.validators} validators, ${st.bee.seeds} seeds)`,
      'tab:bee',
      ['Load, policy', 'Jain index', 'Latency (s)', 'Failed', 'Coord. (ms)'],
      rows,
      'S',
    );
  }
  if (st.conf) {
    const confGates = [
      ...Object.values(st.conf.formula.gates),
      ...Object.values((st.conf.formula.calibrated && st.conf.formula.calibrated.gates) || {}),
    ];
    const rows = confGates.map((g) => [
      g.name,
      f2(g.tpr * 100, 1) + '\\%',
      f2(g.fpr * 100, 1) + '\\%',
      f2(g.f1, 3),
      g.auc == null ? '--' : f2(g.auc, 3),
    ]);
    tab(
      'Filtering of injected faulty transactions on the held-out split',
      'tab:conf',
      ['Gate', 'TPR', 'FPR', 'F1', 'AUC'],
      rows,
      st.conf.formula.tag,
    );
  }
  if (st.chain && st.chain.deployed) {
    const rows = Object.entries(st.chain.deployed).map(([k, v]) => [
      k,
      v.deployed ? 'yes' : 'no',
      v.deployed ? String(v.codeBytes) : '--',
    ]);
    tab(
      'Contracts referenced by the paper on Sepolia',
      'tab:deployed',
      ['Contract', 'Has code', 'Bytes'],
      rows,
      'M',
    );
  }
  fs.writeFileSync(path.join(config.outDir, 'tables.tex'), T.join('\n'));
  const lines = [
    '# PAYS validation summary',
    '',
    `Run: ${D.startedAt} .. ${D.finishedAt}`,
    `Node ${D.environment.node}, ${D.environment.cpu} (${D.environment.cores} cores). RPC host: ${D.environment.rpcHost || 'none'}. Transactions sent: ${D.environment.sentTransactions}.`,
    '',
    '## Claim verdicts',
    '',
  ];
  for (const [id, c] of Object.entries(D.claims))
    lines.push(
      `- **${id}**: ${c.verdict}. ${c.claim}. Rule: ${c.rule}.`,
      '  ```json',
      '  ' + JSON.stringify(c.detail),
      '  ```',
    );
  fs.writeFileSync(path.join(config.outDir, 'summary.md'), lines.join('\n') + '\n');
  fs.writeFileSync(
    path.join(config.outDir, 'manifest.json'),
    JSON.stringify(
      {
        script: path.basename(__filename),
        sha256: sha256(__filename),
        node: process.version,
        files: fs.readdirSync(config.outDir),
      },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// 13. Main
// ---------------------------------------------------------------------------------------------

/** Entry point: read settings, run the chosen stages (a failing stage is recorded and does not stop the others), then write verdicts and reports. */
async function main() {
  const config = loadConfig(),
    rec = new Recorder(config);
  console.log(
    'PAYS validation | stages:',
    config.stages.join(','),
    '| quick:',
    config.quick,
    '| offline:',
    config.offline,
    '| send:',
    config.send,
    '| RPC:',
    config.rpcUrl ? hostOf(config.rpcUrl) : 'none',
  );
  const stages = {
    conn: stageConn,
    zk: stageZk,
    rbf: stageRbf,
    dual: stageDual,
    bee: stageBee,
    conf: stageConf,
    chain: stageChain,
  };
  const order = ['conn', 'zk', 'rbf', 'dual', 'bee', 'conf', 'chain'].filter((s) =>
    config.stages.includes(s),
  );
  for (const s of order) {
    try {
      await stages[s](config, rec);
    } catch (e) {
      console.error(`   !! stage ${s} failed:`, e.message);
      rec.set(s, { error: String(e.stack || e.message).slice(0, 600) });
    }
  }
  rec.data.claims = verdicts(rec.data);
  rec.save();
  writeReport(config, rec.data);
  console.log('\n=== Verdicts ===');
  for (const [id, c] of Object.entries(rec.data.claims))
    console.log(`${id.padEnd(11)} ${c.verdict}`);
  console.log(
    '\nResults written to',
    config.outDir,
    '\nSend back: pays_validation.json, summary.md, tables.tex, sepolia_series.json, manifest.json',
  );
}
if (require.main === module)
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
module.exports = { main, rbfPredict, verdicts };
