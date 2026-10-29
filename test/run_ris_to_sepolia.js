/**
 * run_ris_to_sepolia.js  (single self-contained file: addresses and ABIs are inside)
 *
 * Closed-loop experiment: live BGP updates from RIPE RIS Live -> N2N identifiers -> deployed Sepolia contracts.
 *
 * For every new (peer AS, origin AS) pair seen in the live feed the script
 *   1. registers the source NID          (NIDRegistry.registerNID)        if it is not on chain yet
 *   2. registers the destination NIAS    (NIASRegistry.registerNIAS)      if it is not on chain yet
 *   3. writes the ABATL mapping          (ABATLTranslation.createABATLMapping)
 *   4. writes the real AS path           (SequencePathRouter.createPathSequence)   unless PATHS=0
 * and stores the RIS timestamp, every transaction hash, block, gas, and the delay between receiving the
 * update and confirming its last transaction.
 *
 * Usage
 *   npm install web3 ws dotenv
 *   node test/run_ris_to_sepolia.js                    live RIS feed, Sepolia
 *   node test/run_ris_to_sepolia.js --replay f.jsonl   read RIS messages from a file instead of the live feed
 *   node test/run_ris_to_sepolia.js --env path\to\.env use a specific env file
 *
 * Settings (environment or .env file; .env.local or .env is found automatically)
 *   PRIVATE_KEY                    funded Sepolia account (64 hex characters)
 *   INFURA_PROJECT_ID              or ETHEREUM_PROVIDER_URL / RPC_URL for another provider
 *   DURATION_S   (default 900)     seconds to listen to the feed
 *   MAX_PAIRS    (default 25)      stop after this many distinct (peer, origin) pairs
 *   MAX_QUEUE    (default 10)      updates waiting for the chain; further ones are dropped and counted
 *   PATHS        (default 1)       0 = skip createPathSequence
 *   RIS_HOST     (default rrc00)   RIS route collector
 *   OUTPUT_DIR   (default test/data) where the result file goes
 *   LATENCY_MS, BANDWIDTH_MBPS, SECURITY, QOS   attribute values written with each mapping. They are
 *                                  policy inputs, not measurements, and the result file says so.
 *
 * Secrets are read from the local environment only. They are never printed or written to the results.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Web3 } = require('web3');

const SEPOLIA_CHAIN_ID = 11155111n;

// Deployed Sepolia contracts (22 July 2025, SecondN2NContracts source, compiler 0.8.30).
const CONTRACT_ADDRESSES = {
  ABATLTranslation: '0xc6b5e094dc85792dd804eaa3669236d840434709',
  NIASRegistry: '0x5e8a8bf9cadf65f33ccf220bf5540390e73b26a5',
  NIDRegistry: '0x3e8d9276a878b418b5169726ffa3de21d7376770',
  ClusteringContract: '0xa7f137dd6868efe746a72e6e09dda73fac203a00', // deployed, not used by this experiment
  SequencePathRouter: '0xb0283be5775547dfacf1d41ab19d7d22e940505b',
};

// ABI fragments: only the functions and the event this script uses. They match the deployed contracts.
const ABIS = {
  NIDRegistry: [
    {
      type: 'function', name: 'nidExists', stateMutability: 'view',
      inputs: [
        { name: '', type: 'string' },
      ],
      outputs: [
        { name: '', type: 'bool' },
      ],
    },
    {
      type: 'function', name: 'registerNID', stateMutability: 'nonpayable',
      inputs: [
        { name: '_nidId', type: 'string' },
        { name: '_primaryAttributes', type: 'string' },
        { name: '_secondaryAttributes', type: 'string' },
        { name: '_deviceType', type: 'string' },
        { name: '_region', type: 'string' },
        { name: '_organizationId', type: 'string' },
        { name: '_port', type: 'uint256' },
      ],
      outputs: [
        { name: '', type: 'bool' },
      ],
    },
  ],
  NIASRegistry: [
    {
      type: 'function', name: 'niasExists', stateMutability: 'view',
      inputs: [
        { name: '', type: 'string' },
      ],
      outputs: [
        { name: '', type: 'bool' },
      ],
    },
    {
      type: 'function', name: 'registerNIAS', stateMutability: 'nonpayable',
      inputs: [
        { name: '_niasId', type: 'string' },
        { name: '_nodeType', type: 'string' },
        { name: '_attributes', type: 'string' },
        { name: '_securityLevel', type: 'uint256' },
        { name: '_bandwidth', type: 'uint256' },
        { name: '_region', type: 'string' },
      ],
      outputs: [
        { name: '', type: 'bool' },
      ],
    },
  ],
  ABATLTranslation: [
    {
      type: 'function', name: 'createABATLMapping', stateMutability: 'nonpayable',
      inputs: [
        { name: '_sourceNID', type: 'string' },
        { name: '_destNIAS', type: 'string' },
        { name: '_attributes', type: 'string' },
        { name: '_latency', type: 'uint256' },
        { name: '_bandwidth', type: 'uint256' },
        { name: '_securityLevel', type: 'string' },
        { name: '_qosLevel', type: 'string' },
      ],
      outputs: [
        { name: '', type: 'bytes32' },
      ],
    },
  ],
  SequencePathRouter: [
    {
      type: 'function', name: 'createPathSequence', stateMutability: 'nonpayable',
      inputs: [
        { name: '_nodeSequence', type: 'string[]' },
        { name: '_totalLatency', type: 'uint256' },
        { name: '_minBandwidth', type: 'uint256' },
        { name: '_securityScore', type: 'uint256' },
        { name: '_pathType', type: 'string' },
      ],
      outputs: [
        { name: '', type: 'bytes32' },
      ],
    },
    {
      type: 'event', name: 'PathSequenceCreated', anonymous: false,
      inputs: [
        { name: 'pathId', type: 'bytes32', indexed: true },
        { name: 'nodeSequence', type: 'string[]' },
        { name: 'totalLatency', type: 'uint256' },
        { name: 'pathType', type: 'string' },
      ],
    },
  ],
};
const CONTRACT_NAMES = Object.keys(ABIS);

/** Where results go: OUTPUT_DIR, else a "data" folder next to this script. */
function resultsDir() {
  const dir = process.env.OUTPUT_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------------------------
// 1. Configuration
// ---------------------------------------------------------------------------------------------

/** Value of a command-line option such as --env <file>, or undefined. */
function cliOption(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** The env file to use: --env, ENV_FILE, or the first .env.local / .env in this folder or a parent. */
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

/** First value among the given environment variable names that passes `isValid`. */
function firstValid(names, isValid) {
  return names.map((n) => process.env[n]).find((v) => v && isValid(v));
}

function loadConfig() {
  const envFile = findEnvFile();
  if (envFile) {
    dotenv.config({ path: envFile });
    console.log('Settings read from', envFile);
  }

  const isUrl = (v) => /^https?:\/\//.test(v);
  const isKey = (v) => /^(0x)?[0-9a-fA-F]{64}$/.test(v);

  let rpcUrl = firstValid(
    ['RPC_URL', 'SEPOLIA_RPC_URL', 'ETHEREUM_PROVIDER_URL', 'ETHEREUM_RPC_URL', 'INFURA_URL',
      'ALCHEMY_URL', 'TATUM_ETHEREUM_ENDPOINT', 'WEB3_PROVIDER_URL', 'CUSTOM_RPC_URL'], isUrl);
  if (!rpcUrl && process.env.INFURA_PROJECT_ID) {
    rpcUrl = `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
  }
  const privateKey = firstValid(['PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'SEPOLIA_PRIVATE_KEY'], isKey);

  const number = (name, fallback) => Number(process.env[name] || fallback);
  return {
    replayFile: cliOption('--replay'),
    rpcUrl,
    privateKey: privateKey && (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`),
    risHost: process.env.RIS_HOST || 'rrc00',
    durationMs: number('DURATION_S', 900) * 1000,
    maxPairs: number('MAX_PAIRS', 25),
    maxQueue: number('MAX_QUEUE', 10),
    writePaths: (process.env.PATHS || '1') !== '0',
    attributes: {
      latencyMs: number('LATENCY_MS', 15),
      bandwidthMbps: number('BANDWIDTH_MBPS', 1000),
      security: process.env.SECURITY || 'HIGH',
      qos: process.env.QOS || 'PRIORITY',
      note: 'policy inputs written with every mapping, not measurements',
    },
  };
}

// ---------------------------------------------------------------------------------------------
// 2. Small helpers
// ---------------------------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Descriptive statistics for a list of numbers. */
function summarise(values) {
  if (values.length === 0) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, n - 1);
  return {
    n,
    mean,
    sd: Math.sqrt(variance),
    median: sorted[Math.floor(n / 2)],
    p95: sorted[Math.floor(n * 0.95)],
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/** Removes the repeats that AS-path prepending creates: [1, 2, 2, 2, 3] -> [1, 2, 3]. */
function removePrepending(asPath) {
  return asPath.filter((asn, i) => i === 0 || asn !== asPath[i - 1]);
}

// ---------------------------------------------------------------------------------------------
// 3. RIS Live messages -> N2N identifiers
// ---------------------------------------------------------------------------------------------

/**
 * Turns one RIS Live message into an update we can write to the chain.
 * Returns { update } on success or { skip: 'reason' } when the message cannot be used.
 * Every AS number found in a path is added to `asnsSeen`.
 */
function parseRisMessage(rawText, asnsSeen) {
  let message;
  try {
    message = JSON.parse(rawText);
  } catch {
    return { skip: 'not_json' };
  }
  if (message.type !== 'ris_message' || !message.data || message.data.type !== 'UPDATE') {
    return { skip: 'not_update' };
  }

  const data = message.data;
  const asPath = data.path || [];
  asPath.filter(Number.isInteger).forEach((asn) => asnsSeen.add(asn));

  const isAnnouncement = (data.announcements || []).length > 0 && asPath.length > 0;
  if (!isAnnouncement) return { skip: 'withdrawal_only' };
  if (!asPath.every(Number.isInteger)) return { skip: 'as_set_in_path' };

  const hops = removePrepending(asPath);
  if (hops.length < 2) return { skip: 'path_too_short' };

  const peerAsn = Number(data.peer_asn);
  const originAsn = hops[hops.length - 1];
  return {
    update: {
      risTimestamp: data.timestamp,
      peerAsn,
      originAsn,
      path: hops,
      nid: `NID-${peerAsn}-0`,
      nias: `NIAS-${originAsn}`,
    },
  };
}

/**
 * Delivers raw RIS messages to `onMessage` until `shouldStop()` is true or the time is up.
 * Reads from a file with --replay, otherwise from the live WebSocket.
 */
async function readFeed(config, onMessage, shouldStop) {
  if (config.replayFile) {
    for (const line of fs.readFileSync(config.replayFile, 'utf8').split(/\r?\n/)) {
      if (line.trim() && !shouldStop()) onMessage(line);
    }
    return;
  }

  const WebSocket = require('ws');
  const socket = new WebSocket('wss://ris-live.ripe.net/v1/ws/?client=n2n-sepolia-experiment');
  socket.on('open', () => {
    socket.send(JSON.stringify({
      type: 'ris_subscribe',
      data: { host: config.risHost, type: 'UPDATE', moreSpecific: true },
    }));
    console.log('Connected to RIS Live, collector', config.risHost);
  });
  socket.on('message', (raw) => onMessage(raw.toString()));
  socket.on('error', (error) => console.error('RIS Live error:', error.message));

  const deadline = Date.now() + config.durationMs;
  while (Date.now() < deadline && !shouldStop()) await sleep(500);
  socket.close();
}

// ---------------------------------------------------------------------------------------------
// 4. The chain: connection, contracts, and sending transactions
// ---------------------------------------------------------------------------------------------

class Chain {
  /** Connects to Sepolia with the funded account and returns a ready Chain. */
  static async connect(config) {
    const chain = new Chain();
    chain.transactions = []; // one entry per confirmed transaction

    if (!config.rpcUrl) throw new Error('No RPC endpoint: set INFURA_PROJECT_ID or ETHEREUM_PROVIDER_URL in .env');
    if (!config.privateKey) throw new Error('No valid PRIVATE_KEY (64 hex characters) in .env');

    chain.web3 = new Web3(config.rpcUrl);
    const chainId = await chain.web3.eth.getChainId();
    if (chainId !== SEPOLIA_CHAIN_ID) throw new Error(`Connected to chain ${chainId}, expected Sepolia`);

    const account = chain.web3.eth.accounts.privateKeyToAccount(config.privateKey);
    chain.web3.eth.accounts.wallet.add(account);
    chain.sender = account.address;

    const balance = await chain.web3.eth.getBalance(chain.sender);
    console.log('Account', chain.sender, 'balance', chain.web3.utils.fromWei(balance, 'ether'), 'ETH');
    if (balance === 0n) throw new Error('The account has no Sepolia ETH');

    chain.contracts = {};
    for (const name of CONTRACT_NAMES) {
      chain.contracts[name] = new chain.web3.eth.Contract(ABIS[name], CONTRACT_ADDRESSES[name]);
    }
    chain.info = { mode: 'sepolia', chainId: Number(chainId), account: chain.sender, addresses: CONTRACT_ADDRESSES };
    return chain;
  }

  /**
   * Sends one transaction and waits for its receipt.
   * `method` is a web3 contract call such as contract.methods.registerNID(...).
   */
  async send(label, method) {
    const estimate = await method.estimateGas({ from: this.sender }); // throws if the call would revert
    const gas = Math.floor(Number(estimate) * 1.2);

    const startedAt = Date.now();
    const receipt = await method.send({ from: this.sender, gas });
    const record = {
      label,
      hash: receipt.transactionHash,
      block: Number(receipt.blockNumber),
      gas: Number(receipt.gasUsed),
      confirmMs: Date.now() - startedAt,
    };
    this.transactions.push(record);
    return { receipt, record };
  }
}

// ---------------------------------------------------------------------------------------------
// 5. Writing one update to the contracts
// ---------------------------------------------------------------------------------------------

/** Writes one RIS update to the chain and returns what happened. */
async function writeUpdate(chain, config, update, receivedAt) {
  const { NIDRegistry, NIASRegistry, ABATLTranslation, SequencePathRouter } = chain.contracts;
  const { latencyMs, bandwidthMbps, security, qos } = config.attributes;
  const outcome = { ...update, txHashes: [], ok: false };

  try {
    // 1. Source NID (the peer that announced the route)
    if (!(await NIDRegistry.methods.nidExists(update.nid).call())) {
      const attributes = `H[${latencyMs}ms.1Gbps.HIGH.PRIORITY]`;
      const { record } = await chain.send('registerNID',
        NIDRegistry.methods.registerNID(update.nid, attributes, 'sec', 'ROUTER', 'GLOBAL', 'ORG-RIS', 179));
      outcome.txHashes.push(record.hash);
    }

    // 2. Destination NIAS (the origin AS of the announced prefix)
    if (!(await NIASRegistry.methods.niasExists(update.nias).call())) {
      const { record } = await chain.send('registerNIAS',
        NIASRegistry.methods.registerNIAS(update.nias, 'EDGE', 'H[20ms.HIGH_SEC]', 90, 1000, 'GLOBAL'));
      outcome.txHashes.push(record.hash);
    }

    // 3. ABATL mapping NID -> NIAS
    const mapping = await chain.send('createABATLMapping',
      ABATLTranslation.methods.createABATLMapping(
        update.nid, update.nias, 'ris-live', latencyMs, bandwidthMbps, security, qos));
    outcome.txHashes.push(mapping.record.hash);

    // 4. The real AS path of the update, stored as a path sequence
    if (config.writePaths) {
      const hops = update.path.slice(0, 12).map((asn) => `AS${asn}`);
      const created = await chain.send('createPathSequence',
        SequencePathRouter.methods.createPathSequence(hops, latencyMs, bandwidthMbps, 90, 'MULTI_HOP'));
      outcome.txHashes.push(created.record.hash);
      const event = created.receipt.events && created.receipt.events.PathSequenceCreated;
      if (event) outcome.pathId = String(event.returnValues[0]);
    }

    outcome.ok = true;
    outcome.endToEndMs = Date.now() - receivedAt;
  } catch (error) {
    outcome.error = String(error.message).slice(0, 200);
  }
  return outcome;
}

// ---------------------------------------------------------------------------------------------
// 6. Results file
// ---------------------------------------------------------------------------------------------

class Recorder {
  constructor(config, chain) {
    this.file = path.join(resultsDir(), 'ris_to_sepolia.json');
    this.chain = chain;
    this.startedAt = new Date().toISOString();
    this.settings = {
      risHost: config.risHost,
      durationS: config.durationMs / 1000,
      maxPairs: config.maxPairs,
      writePaths: config.writePaths,
      attributes: config.attributes,
    };
    this.feedCounts = { messages: 0, skipped: {}, duplicatePairs: 0, droppedQueueFull: 0, acceptedPairs: 0 };
    this.asnsSeen = new Set();
    this.peerAsns = new Set();
    this.originAsns = new Set();
    this.updates = [];
  }

  countSkip(reason) {
    this.feedCounts.skipped[reason] = (this.feedCounts.skipped[reason] || 0) + 1;
  }

  addUpdate(outcome) {
    this.updates.push(outcome);
    this.save();
  }

  /** Summary numbers that go into the paper. */
  summary() {
    const done = this.updates.filter((u) => u.ok);
    const txs = this.chain.transactions;
    const labels = [...new Set(txs.map((t) => t.label))];
    return {
      updatesWritten: done.length,
      updatesFailed: this.updates.length - done.length,
      transactions: txs.length,
      totalGas: txs.reduce((sum, t) => sum + t.gas, 0),
      endToEndMs: summarise(done.map((u) => u.endToEndMs)),
      confirmMs: summarise(txs.map((t) => t.confirmMs)),
      gasByCall: Object.fromEntries(
        labels.map((l) => [l, summarise(txs.filter((t) => t.label === l).map((t) => t.gas))])),
      distinctAsns: {
        inLivePaths: this.asnsSeen.size,
        peers: this.peerAsns.size,
        origins: this.originAsns.size,
      },
    };
  }

  save() {
    const result = {
      environment: this.chain.info,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      settings: this.settings,
      feed: this.feedCounts,
      summary: this.summary(),
      updates: this.updates,
      transactions: this.chain.transactions,
    };
    fs.writeFileSync(this.file, JSON.stringify(result, null, 2));
  }
}

// ---------------------------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------------------------

async function main() {
  const config = loadConfig();
  const chain = await Chain.connect(config);
  const recorder = new Recorder(config, chain);

  const waiting = [];           // updates waiting to be written
  const pairsSeen = new Set();  // "peer>origin" pairs already accepted
  let feedFinished = false;

  // Called for every raw message from the feed.
  const onMessage = (rawText) => {
    recorder.feedCounts.messages++;
    const { update, skip } = parseRisMessage(rawText, recorder.asnsSeen);
    if (skip) {
      if (skip !== 'not_update') recorder.countSkip(skip);
      return;
    }

    const pair = `${update.peerAsn}>${update.originAsn}`;
    if (pairsSeen.has(pair)) { recorder.feedCounts.duplicatePairs++; return; }
    if (pairsSeen.size >= config.maxPairs) return;
    if (waiting.length >= config.maxQueue) { recorder.feedCounts.droppedQueueFull++; return; }

    pairsSeen.add(pair);
    recorder.feedCounts.acceptedPairs++;
    recorder.peerAsns.add(update.peerAsn);
    recorder.originAsns.add(update.originAsn);
    waiting.push({ update, receivedAt: Date.now() });
    if (pairsSeen.size >= config.maxPairs) feedFinished = true;
  };

  // The feed fills the waiting list; this loop writes the updates one at a time, in order.
  const feedTask = readFeed(config, onMessage, () => feedFinished).finally(() => { feedFinished = true; });

  while (!feedFinished || waiting.length > 0) {
    if (waiting.length === 0) { await sleep(300); continue; }
    const { update, receivedAt } = waiting.shift();
    const outcome = await writeUpdate(chain, config, update, receivedAt);
    recorder.addUpdate(outcome);
    console.log(outcome.ok
      ? `ok    AS${update.peerAsn} -> AS${update.originAsn}  ${update.path.length} hops  ${(outcome.endToEndMs / 1000).toFixed(1)} s`
      : `FAIL  AS${update.peerAsn} -> AS${update.originAsn}  ${outcome.error}`);
  }
  await feedTask;

  recorder.save();
  console.log('\nResults written to', recorder.file);
  const { gasByCall, ...headline } = recorder.summary();
  console.log(JSON.stringify(headline, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
