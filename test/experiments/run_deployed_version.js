// Experiments for the contract version that the live test suite and the Sepolia deployment ABIs describe
// (repo folder contracts/SecondN2NContracts: Ownable, createABATLMapping, registerNID, createPathSequence).
//   Local EVM : node run_deployed_version.js                      (deploys a fresh copy on ganache)
//   Sepolia   : RPC_URL=... PRIVATE_KEY=0x.. ADDRESSES=../config/contract_addresses.json TRIALS=20 node run_deployed_version.js --live
// ADDRESSES is a JSON file {"NIDRegistry":"0x..","NIASRegistry":"0x..","ABATLTranslation":"0x..","SequencePathRouter":"0x.."}.
// Every transaction hash is stored, so the Sepolia run can be checked on a block explorer.
const fs = require('fs'), path = require('path'); const { ethers } = require('ethers');
const LIVE = process.argv.includes('--live');
// Optional .env support without extra packages: node run_deployed_version.js --live --env "C:\path\to\.env"
// The file is read on this machine only. Secrets are never printed or written to the result file.
{ const i = process.argv.indexOf('--env'); const ef = i > 0 ? process.argv[i + 1] : process.env.ENV_FILE;
  if (ef) for (const line of fs.readFileSync(ef, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); } }
const pick = (...k) => { for (const x of k) if (process.env[x]) return process.env[x]; };
const RPC = pick('RPC_URL', 'SEPOLIA_RPC_URL', 'INFURA_URL', 'ALCHEMY_URL', 'WEB3_PROVIDER_URL') || (process.env.INFURA_PROJECT_ID && 'https://sepolia.infura.io/v3/' + process.env.INFURA_PROJECT_ID) || (process.env.INFURA_API_KEY && 'https://sepolia.infura.io/v3/' + process.env.INFURA_API_KEY);
const KEY = pick('PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'ACCOUNT_PRIVATE_KEY', 'SEPOLIA_PRIVATE_KEY');
const state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'experiment_state.json')));
const seq = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sequencer_output.json'))).records;
const load = n => JSON.parse(fs.readFileSync(path.join(__dirname, fs.existsSync(path.join(__dirname, 'build', 'sepolia_version', n + '.json')) ? 'build/sepolia_version' : 'abi_sepolia', n + '.json')));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const stats = a => { if (!a.length) return { n: 0 }; const s = [...a].sort((x, y) => x - y), n = s.length, m = s.reduce((x, y) => x + y, 0) / n; const sd = Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, n - 1)); return { n, mean: m, sd, ci95: 1.96 * sd / Math.sqrt(n), median: s[Math.floor(n / 2)], p95: s[Math.floor(n * 0.95)], min: s[0], max: s[n - 1] }; };
const TR = Number(process.env.TRIALS || (LIVE ? 20 : 1e9));
const txs = [];
async function send(label, p) { const t0 = now(); const tx = await p; const r = await tx.wait(); const ms = now() - t0; txs.push({ label, hash: tx.hash, block: r.blockNumber, gas: Number(r.gasUsed), ms }); return { r, ms, gas: Number(r.gasUsed) }; }
(async () => {
  let provider, signer, C = {}, env;
  if (LIVE) { if (!RPC || !KEY) throw new Error('RPC endpoint or private key not found in the environment or .env file');
    provider = new ethers.JsonRpcProvider(RPC); const net = await provider.getNetwork(); if (Number(net.chainId) !== 11155111) throw new Error('not Sepolia, chainId ' + net.chainId);
    signer = new ethers.Wallet(KEY.startsWith('0x') ? KEY : '0x' + KEY, provider); const bal = await provider.getBalance(signer.address); console.log('account', signer.address, 'balance ETH', ethers.formatEther(bal)); if (bal === 0n) throw new Error('account has no Sepolia ETH');
    const A = JSON.parse(fs.readFileSync(process.env.ADDRESSES || path.join(__dirname, 'sepolia_addresses.json'))); for (const n of ['NIDRegistry', 'NIASRegistry', 'ABATLTranslation', 'SequencePathRouter']) C[n] = new ethers.Contract(A[n], load(n).abi, signer);
    env = { mode: 'sepolia', chainId: Number((await provider.getNetwork()).chainId), addresses: A, account: signer.address };
  } else { const ganache = require('ganache'); const g = ganache.provider({ logging: { quiet: true }, miner: { blockGasLimit: 60000000 }, seed: 'n2n2' }); provider = new ethers.BrowserProvider(g); signer = await provider.getSigner(0);
    for (const n of ['NIDRegistry', 'NIASRegistry', 'ABATLTranslation', 'SequencePathRouter']) { const j = load(n); const f = new ethers.ContractFactory(j.abi, j.bytecode, signer); const c = await f.deploy(); const r = await c.deploymentTransaction().wait(); txs.push({ label: 'deploy ' + n, gas: Number(r.gasUsed) }); C[n] = c; }
    env = { mode: 'local-evm-ganache' }; }
  const res = { env, generated: new Date().toISOString(), contractSource: 'contracts/SecondN2NContracts' };
  const maps = Object.values(state.abatlMappings).slice(0, TR);
  const seenN = new Set(), seenS = new Set(), T = { regNID: [], regNIAS: [], abatl: [] }, G = { regNID: [], regNIAS: [], abatl: [] }; let skipped = 0;
  for (const m of maps) {
    if (!seenN.has(m.sourceNID)) { seenN.add(m.sourceNID); if (!(await C.NIDRegistry.nidExists(m.sourceNID))) { const r = await send('registerNID', C.NIDRegistry.registerNID(m.sourceNID, 'H[15ms.1Gbps.HIGH.PRIORITY]', 'sec', 'ROUTER', 'GLOBAL', 'ORG-RIS', 179)); T.regNID.push(r.ms); G.regNID.push(r.gas); } else skipped++; }
    if (!seenS.has(m.destNIAS)) { seenS.add(m.destNIAS); if (!(await C.NIASRegistry.niasExists(m.destNIAS))) { const r = await send('registerNIAS', C.NIASRegistry.registerNIAS(m.destNIAS, 'EDGE', 'H[20ms.HIGH_SEC]', 90, 1000, 'GLOBAL')); T.regNIAS.push(r.ms); G.regNIAS.push(r.gas); } else skipped++; }
    const r = await send('createABATLMapping', C.ABATLTranslation.createABATLMapping(m.sourceNID, m.destNIAS, 'ris-derived', 15, 1000, 'HIGH', 'PRIORITY')); T.abatl.push(r.ms); G.abatl.push(r.gas);
  }
  res.replay = { mappings: maps.length, skippedExisting: skipped, time_ms: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, stats(v)])), gas: Object.fromEntries(Object.entries(G).map(([k, v]) => [k, stats(v)])), raw: { abatl_ms: T.abatl, abatl_gas: G.abatl } };
  // translateRoute lookup check (the key used at read time omits the timestamp that the write used)
  let hits = 0; const probe = maps.slice(0, 20); for (const m of probe) { const t = await C.ABATLTranslation.translateRoute(m.sourceNID, m.destNIAS); if (t.isActive) hits++; }
  res.translateRouteHits = { probed: probe.length, found: hits };
  // paths from the sequencer, then validate, use, and recover by re-sequencing (the router has no backup or reroute function)
  const P = { create_ms: [], create_gas: [], validate_ms: [], validate_gas: [], use_ms: [], use_gas: [], recover_ms: [], recover_gas: [] }; let validOk = 0, recOk = 0, n = 0;
  const idOf = r => { for (const l of r.logs) { try { const e = C.SequencePathRouter.interface.parseLog(l); if (e && e.name === 'PathSequenceCreated') return e.args[0]; } catch {} } };
  for (const r of seq.slice(0, Math.min(TR, 197))) {
    const nm = r.primary.map(a => 'AS' + a);
    const c = await send('createPathSequence', C.SequencePathRouter.createPathSequence(nm, Math.round(r.pm.latency), Math.round(r.pm.min_bw), Math.round(r.pm.security * 100), 'MULTI_HOP')); const pid = idOf(c.r); P.create_ms.push(c.ms); P.create_gas.push(c.gas);
    const v = await send('validatePath', C.SequencePathRouter.validatePath(pid)); P.validate_ms.push(v.ms); P.validate_gas.push(v.gas); if (v.r.logs.length) validOk++;
    const u = await send('usePathSequence', C.SequencePathRouter.usePathSequence(pid)); P.use_ms.push(u.ms); P.use_gas.push(u.gas);
    if (r.resequenced) { const rs = r.resequenced.map(a => 'AS' + a); const t0 = now(); const d = await send('deactivatePath', C.SequencePathRouter.deactivatePath(pid)); const f = await send('createPathSequence(FAILOVER)', C.SequencePathRouter.createPathSequence(rs, Math.round(r.pm.latency), Math.round(r.pm.min_bw), Math.round(r.pm.security * 100), 'FAILOVER'));
      P.recover_ms.push(now() - t0 + r.reseq_ms); P.recover_gas.push(d.gas + f.gas); if (!rs.includes('AS' + r.failed)) recOk++; }
    n++;
  }
  res.paths = { n, validate_events: validOk, recovered_correct: recOk, ...Object.fromEntries(Object.entries(P).map(([k, v]) => [k, stats(v)])) };
  const cr = []; for (const r of seq.slice(0, Math.min(TR, 20))) { const x = await send('computeRoute', C.SequencePathRouter.computeRoute('AS' + r.src, 'AS' + r.dst, 'DIRECT')); cr.push(x.gas); }
  res.computeRoute = stats(cr);
  res.txs = txs;
  const out = path.join(__dirname, '..', 'data', LIVE ? 'deployed_version_sepolia.json' : 'deployed_version_local.json'); fs.writeFileSync(out, JSON.stringify(res)); console.log('done', out);
  console.log(JSON.stringify({ replay: { regNID: res.replay.gas.regNID.mean, regNIAS: res.replay.gas.regNIAS.mean, abatl: res.replay.gas.abatl.mean }, paths: { create: res.paths.create_gas.mean, validate: res.paths.validate_gas.mean, recover_gas: res.paths.recover_gas.mean, recover_ms: res.paths.recover_ms.mean, recOk, n }, translateRouteHits: res.translateRouteHits }));
})().catch(e => { try { fs.writeFileSync(path.join(__dirname, '..', 'data', 'deployed_version_partial.json'), JSON.stringify({ error: String(e.shortMessage || e.message).slice(0, 300), txs })); } catch {} console.error('FAIL', e.shortMessage || e.message, e.stack.split('\n').slice(0,4).join(' | ')); process.exit(1); });
