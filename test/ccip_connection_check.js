#!/usr/bin/env node
/**
 * ccip_connection_check.js
 *
 * Read-only check before the PAYS against Chainlink CCIP experiment. It sends NO transaction and prints no secret.
 * It checks, in order:
 *   1. the Ethereum Sepolia endpoint answers and really is chain 11155111
 *   2. the Base Sepolia endpoint answers and really is chain 84532
 *   3. your account (derived from PRIVATE_KEY) holds test ETH on both chains
 *   4. the CCIP routers exist on both chains
 *   5. the Sepolia router supports the Base Sepolia lane, and what a CCIP message costs (fee quote)
 *
 * Usage (from the folder that holds .env.local):
 *   node test/ccip_connection_check.js
 *   node test/ccip_connection_check.js --env path/to/.env.local
 *   DEST_CHAIN=arbitrum node test/ccip_connection_check.js
 *
 * Settings it reads (same names as the validation script): INFURA_PROJECT_ID or ETHEREUM_PROVIDER_URL (Sepolia),
 * PRIVATE_KEY, BASE_SEPOLIA_RPC_URL or DEST_RPC_URL (default: the public endpoint), DEST_CHAIN (base or arbitrum),
 * and optionally CCIP_ROUTER_SOURCE, CCIP_ROUTER_DEST, CCIP_DEST_SELECTOR.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

// CCIP testnet constants from the Chainlink CCIP directory (docs.chain.link/ccip/directory/testnet)
const NETWORKS = {
  sepolia: { name: 'Ethereum Sepolia', chainId: 11155111, selector: '16015286601757825753', router: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59' },
  base: { name: 'Base Sepolia', chainId: 84532, selector: '10344971235874465080', router: '0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93', rpc: 'https://sepolia.base.org' },
  arbitrum: { name: 'Arbitrum Sepolia', chainId: 421614, selector: '3478487238524512106', router: '0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165', rpc: 'https://sepolia-rollup.arbitrum.io/rpc' },
};

// ---- settings
const argAfter = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : undefined; };
const envFile = [argAfter('--env'), '.env.local', '.env', '../.env.local', '../.env'].filter(Boolean).map((f) => path.resolve(f)).find((f) => fs.existsSync(f));
if (envFile) { dotenv.config({ path: envFile }); console.log('Settings read from', envFile); } else console.log('No .env.local or .env found in this folder; using the environment only.');
const isUrl = (v) => /^https?:\/\//.test(v || '');
const firstUrl = (names) => names.map((n) => process.env[n]).find(isUrl);
const key = (process.env.PRIVATE_KEY || '').trim();
const privateKey = /^(0x)?[0-9a-fA-F]{64}$/.test(key) ? (key.startsWith('0x') ? key : '0x' + key) : null;
const destName = (process.env.DEST_CHAIN || 'base').toLowerCase();
const dest = NETWORKS[destName];
const results = [];
const note = (ok, text) => { results.push(ok); console.log(`${ok ? ' OK  ' : 'FAIL '} ${text}`); };

function provider(url) {
  const req = new ethers.FetchRequest(url);
  req.timeout = 15000;
  return new ethers.JsonRpcProvider(req, undefined, { staticNetwork: true, batchMaxCount: 1 });
}
async function connect(label, candidates, expectedChainId) {
  for (const url of candidates) {
    try {
      const p = provider(url);
      const id = BigInt(await p.send('eth_chainId', []));
      const host = new URL(url).host;
      if (id === BigInt(expectedChainId)) { note(true, `${label}: ${host} answers, chain ${id}, block ${await p.getBlockNumber()}`); return p; }
      note(false, `${label}: ${host} is chain ${id}, but ${expectedChainId} is needed. Use the right endpoint for this chain.`);
    } catch (e) { note(false, `${label}: could not reach ${(() => { try { return new URL(url).host; } catch { return 'the endpoint'; } })()} (${String(e.shortMessage || e.message).slice(0, 80)})`); }
  }
  return null;
}

(async () => {
  if (!dest) { console.log(`DEST_CHAIN must be base or arbitrum (got "${destName}")`); process.exit(1); }
  const sepoliaUrls = [
    ...['RPC_URL', 'SEPOLIA_RPC_URL', 'ETHEREUM_PROVIDER_URL', 'ETHEREUM_RPC_URL', 'INFURA_URL', 'ALCHEMY_URL', 'TATUM_ETHEREUM_ENDPOINT', 'WEB3_PROVIDER_URL', 'CUSTOM_RPC_URL'].map((n) => process.env[n]).filter(isUrl),
    ...(process.env.INFURA_PROJECT_ID ? [`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`] : []),
  ];
  const destUrls = [process.env.BASE_SEPOLIA_RPC_URL, process.env.DEST_RPC_URL, dest.rpc].filter(isUrl);
  if (!sepoliaUrls.length) note(false, 'Sepolia: no endpoint found. Set INFURA_PROJECT_ID or ETHEREUM_PROVIDER_URL in .env.local');
  const S = sepoliaUrls.length ? await connect(NETWORKS.sepolia.name, sepoliaUrls, NETWORKS.sepolia.chainId) : null;
  const D = await connect(dest.name, [...new Set(destUrls)], dest.chainId);

  // account and balances
  let address = null;
  if (!privateKey) note(false, 'PRIVATE_KEY is missing or not 64 hex characters in .env.local');
  else {
    address = new ethers.Wallet(privateKey).address;
    console.log(`      account (from PRIVATE_KEY): ${address}   <- must be the MetaMask account you funded`);
    for (const [p, n] of [[S, NETWORKS.sepolia.name], [D, dest.name]]) {
      if (!p) continue;
      const b = await p.getBalance(address);
      note(b > 0n, `${n}: balance ${ethers.formatEther(b)} ETH${b > 0n ? '' : '  (needs test ETH: use a faucet or the testnet bridge)'}`);
    }
  }

  // routers
  const routerSrc = process.env.CCIP_ROUTER_SOURCE || NETWORKS.sepolia.router, routerDst = process.env.CCIP_ROUTER_DEST || dest.router;
  const selector = BigInt(process.env.CCIP_DEST_SELECTOR || dest.selector);
  for (const [p, n, a] of [[S, NETWORKS.sepolia.name, routerSrc], [D, dest.name, routerDst]]) {
    if (!p) continue;
    const code = await p.getCode(a);
    note(code !== '0x', `${n}: CCIP router ${a} ${code !== '0x' ? 'has contract code' : 'has NO code at this address'}`);
  }

  // lane and fee
  if (S) {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const router = new ethers.Contract(routerSrc, [
      'function isChainSupported(uint64) view returns (bool)',
      'function getFee(uint64, (bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256)',
    ], S);
    try { note(await router.isChainSupported(selector), `Lane Sepolia -> ${dest.name} (selector ${selector}) is ${'supported by the router'}`); }
    catch (e) { note(false, `Lane check failed: ${String(e.shortMessage || e.message).slice(0, 90)}`); }
    const receiver = coder.encode(['address'], [address || ethers.ZeroAddress]);
    const options = [
      ...(process.env.CCIP_EXTRA_ARGS ? [['CCIP_EXTRA_ARGS', process.env.CCIP_EXTRA_ARGS]] : []),
      ['empty extraArgs', '0x'],
      ['EVMExtraArgsV1', '0x97a657c9' + coder.encode(['uint256'], [200000]).slice(2)],
      ['EVMExtraArgsV2', '0x181dcf10' + coder.encode(['uint256', 'bool'], [200000, false]).slice(2)],
    ];
    let quoted = false;
    for (const [kind, extraArgs] of options) {
      try {
        const fee = await router.getFee(selector, { receiver, data: coder.encode(['uint256', 'uint256'], [1n, 1n]), tokenAmounts: [], feeToken: ethers.ZeroAddress, extraArgs });
        note(true, `Fee quote with ${kind}: ${ethers.formatEther(fee)} ETH per message (paid in native ETH)`);
        quoted = true;
        break;
      } catch (e) { console.log(`      ${kind} rejected: ${String(e.shortMessage || e.message).slice(0, 80)}`); }
    }
    if (!quoted) note(false, 'The router rejected every extraArgs form, so no fee quote. Send me this output.');
  }
  const bad = results.filter((r) => !r).length;
  console.log(bad ? `\n${bad} check(s) failed. Fix them, run this again, and send me the output if something is unclear.` : '\nAll checks passed. Next: node test/passchain_validation.js --stages xchain --merge --send');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('Unexpected error:', e.message); process.exit(1); });