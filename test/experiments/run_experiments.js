// Runs the N2N experiments against a local EVM (ganache) or any JSON-RPC endpoint.
//   Local EVM : node run_experiments.js
//   Sepolia   : RPC_URL=https://sepolia.infura.io/v3/<key> PRIVATE_KEY=0x.. node run_experiments.js --live
// The Sepolia mode uses one funded key for everything (it is the operator, so no extra accounts are needed),
// skips the unauthorised-account tests that need a second funded key unless PRIVATE_KEY2 is set, and
// reduces the trial counts (LIVE_TRIALS, default 10) to keep the faucet cost low.
const fs = require('fs'), path = require('path');
const { ethers } = require('ethers');
const LIVE = process.argv.includes('--live');
const seq = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sequencer_output.json'))).records;
const state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'experiment_state.json')));
const load = (set, n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'build', set, n + '.json')));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const stats = a => { const s = [...a].sort((x, y) => x - y), n = s.length, m = s.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, mean: m, sd, ci95: 1.96 * sd / Math.sqrt(n), median: s[Math.floor(n / 2)], p95: s[Math.floor(n * 0.95)], min: s[0], max: s[n - 1] }; };

async function mkEnv(blockTime) {
  if (LIVE) {
    const p = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const s1 = new ethers.Wallet(process.env.PRIVATE_KEY, p);
    const s2 = process.env.PRIVATE_KEY2 ? new ethers.Wallet(process.env.PRIVATE_KEY2, p) : null;
    return { provider: p, op: s1, other: s2 };
  }
  const ganache = require('ganache');
  const g = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 4, defaultBalance: 100000 }, chain: { hardfork: 'shanghai' },
    miner: { blockGasLimit: 60000000 }, seed: 'n2n' });
  const p = new ethers.BrowserProvider(g);
  return { provider: p, ganache: g, op: await p.getSigner(0), other: await p.getSigner(1) };
}
let LAST = '', BLOCKWAIT = 0, PROV = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function send(txPromise, label) { const t0 = now(); if (process.env.DBG) console.error('send', label || LAST); try { const tx = await txPromise; if (BLOCKWAIT) { await sleep(BLOCKWAIT); await PROV.send('evm_mine', []); } const r = await tx.wait(); return { ms: now() - t0, gas: Number(r.gasUsed), r }; } catch (e) { console.error('TX FAILED', label || LAST); throw e; } }
async function tryTx(fn) { try { const tx = await fn(); await tx.wait(); return true; } catch (e) { return false; } }

async function deploySet(set, env) {
  const F = n => { const j = load(set, n); return new ethers.ContractFactory(j.abi, j.bytecode, env.op); };
  const out = { gas: {}, c: {} };
  const dep = async (name, ...args) => { const f = F(name); const c = await f.deploy(...args); const r = await c.deploymentTransaction().wait();
    out.gas[name] = Number(r.gasUsed); out.c[name] = await c.waitForDeployment(); return c; };
  const nid = await dep('NIDRegistry'), nias = await dep('NIASRegistry');
  const ab = await dep('ABATLTranslation', await nid.getAddress(), await nias.getAddress());
  await dep('ClusteringContract', await nid.getAddress(), await nias.getAddress(), await ab.getAddress());
  const rt = await dep('SequencePathRouter');
  if (set === 'secured') await (await rt.setNodeRegistry(await nid.getAddress())).wait();
  return out;
}
const asn = a => 'AS' + a;
const res = { mode: LIVE ? 'live-rpc' : 'local-evm-ganache', generated: new Date().toISOString() };
const ST = k => !process.env.STAGES || process.env.STAGES.split(',').includes(k);
const TR = LIVE ? Number(process.env.LIVE_TRIALS || 10) : seq.length;

(async () => {
  const env = await mkEnv();
  // ---------- E1 deployment gas
  if (ST('deploy')) { const D = { original: await deploySet('original', env), secured: await deploySet('secured', env) };
  res.deployment = { original: D.original.gas, secured: D.secured.gas }; }
  console.log('E1 gas', JSON.stringify(res.deployment));

  // ---------- E2 replay of the 449 stored RIS-derived mappings
  res.replay = {};
  if (ST('replay')) for (const set of ['original', 'secured']) {
    const d = await deploySet(set, env); const { NIDRegistry: nid, NIASRegistry: nias, ABATLTranslation: ab } = d.c;
    const seenN = new Set(), seenS = new Set(); const T = { regNID: [], regNIAS: [], abatl: [] }, G = { regNID: [], regNIAS: [], abatl: [] };
    const maps = Object.values(state.abatlMappings).slice(0, LIVE ? TR * 5 : 449);
    for (const m of maps) {
      if (!seenN.has(m.sourceNID)) { seenN.add(m.sourceNID); const r = await send(nid.registerNode(m.sourceNID, 'H[15ms.1Gbps.HIGH.PRIORITY]', 3, 1, 'NID')); T.regNID.push(r.ms); G.regNID.push(r.gas); }
      if (!seenS.has(m.destNIAS)) { seenS.add(m.destNIAS); const r = await send(nias.registerNIAS(m.destNIAS, 'H[20ms.HIGH_SEC]', 3, 100, 50, 1, 'EDGE')); T.regNIAS.push(r.ms); G.regNIAS.push(r.gas); }
      const r = await send(ab.registerABATL(m.sourceNID + '_' + m.destNIAS, m.sourceNID, m.destNIAS, 1, 0, 0)); T.abatl.push(r.ms); G.abatl.push(r.gas);
    }
    res.replay[set] = { mappings: maps.length, uniqueNID: seenN.size, uniqueNIAS: seenS.size,
      time_ms: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, stats(v)])), gas: Object.fromEntries(Object.entries(G).map(([k, v]) => [k, stats(v)])), raw: { abatl_ms: T.abatl, abatl_gas: G.abatl } };
    console.log('E2', set, maps.length);
  }

  // ---------- E3/E4 path creation, backup registration, failure recovery
  async function pathExperiment(set, trials, intervalMs) {
    const d = await deploySet(set, env); const { NIDRegistry: nid, SequencePathRouter: rt } = d.c;
    const nodesNeeded = new Set(); seq.slice(0, trials).forEach(r => { r.primary.forEach(x => nodesNeeded.add(x)); r.backup.forEach(x => nodesNeeded.add(x)); (r.resequenced || []).forEach(x => nodesNeeded.add(x)); });
    for (const a of nodesNeeded) await (await nid.registerNode(asn(a), 'sec', 3, 1, 'NID')).wait();
    if (intervalMs && env.ganache) { PROV = env.provider; await env.provider.send('miner_stop', []); BLOCKWAIT = intervalMs; }
    const out = { create_ms: [], create_gas: [], backup_ms: [], backup_gas: [], A_ms: [], A_gas: [], B_ms: [], B_gas: [], A_ok: 0, B_ok: 0, verify_ok: 0, n: 0 };
    for (const r of seq.slice(0, trials)) {
      const id = 'P' + r.i, nm = r.primary.map(asn), bk = r.backup.map(asn), fl = asn(r.failed);
      LAST = 'createPath ' + id; const c = await send(rt.createPath(id, nm[0], nm[nm.length - 1], nm, r.cls), LAST); out.create_ms.push(c.ms); out.create_gas.push(c.gas);
      LAST = 'createDisjoint ' + id + ' ' + bk; const b = await send(rt.createDisjointPath(id, bk), LAST); out.backup_ms.push(b.ms); out.backup_gas.push(b.gas);
      if (!r.primary.includes(r.failed)) continue;
      // strategy A: mark node inactive, then switch to the stored backup
      let t0 = now(); const s1 = await send(nid.setNodeStatus(fl, false), 'setStatus ' + id); const rr = await send(rt.reroutePath(id, fl, { gasLimit: 3000000 }), 'reroute ' + id + ' ' + fl);
      const totalA = now() - t0; out.A_ms.push(totalA); out.A_gas.push(s1.gas + rr.gas);
      const ev = rr.r.logs.map(l => { try { return rt.interface.parseLog(l); } catch { return null; } }).find(e => e && e.name === 'PathRerouted');
      const newSeq = ev ? Array.from(ev.args[2]) : []; if (newSeq.join() === bk.join() && !newSeq.includes(fl)) out.A_ok++;
      if (set === 'secured') { if (await rt.verifyPath(id)) out.verify_ok++; }
      // strategy B: A* re-sequencing off-chain, then register the new sequence
      if (r.resequenced) { const rs = r.resequenced.map(asn); const t1 = now(); const cb = await send(rt.createPath(id + 'R', rs[0], rs[rs.length - 1], rs, r.cls), 'createR ' + id);
        const totalB = (now() - t1) + r.reseq_ms + s1.ms; out.B_ms.push(totalB); out.B_gas.push(s1.gas + cb.gas); if (!rs.includes(fl)) out.B_ok++; }
      await send(nid.setNodeStatus(fl, true), 'restore ' + id);
      out.n++;
    }
    if (intervalMs && env.ganache) { BLOCKWAIT = 0; await env.provider.send('miner_start', []); }
    const S = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? stats(v) : v]));
    return { ...S(out), raw: { A_ms: out.A_ms, B_ms: out.B_ms, create_ms: out.create_ms } };
  }
  res.paths = {};
  if (ST('paths')) for (const set of ['original', 'secured']) { res.paths[set] = await pathExperiment(set, TR, 0); console.log('E3/E4', set, res.paths[set].n); }
  if (!LIVE && ST('block')) { res.paths.secured_block2s = await pathExperiment('secured', Number(process.env.BLOCKN || 20), 2000); console.log('E4 block-time 2 s done'); }

  // ---------- E5 attack and misuse tests
  async function attacks(set, N) {
    const d = await deploySet(set, env); const { NIDRegistry: nid, NIASRegistry: nias, ABATLTranslation: ab, SequencePathRouter: rt, ClusteringContract: cl } = d.c;
    const other = env.other; const R = {};
    const asOther = c => c.connect(other);
    if (other) {
      let ok = { createPath: 0, reroutePath: 0, registerNode: 0, registerABATL: 0, createCluster: 0 };
      for (let i = 0; i < N; i++) {
        if (await tryTx(() => asOther(nid).registerNode('X' + i, 's', 1, 1, 'NID'))) ok.registerNode++;
        if (await tryTx(() => asOther(rt).createPath('XP' + i, 'a', 'b', ['a', 'b'], 'Default'))) ok.createPath++;
        if (await tryTx(() => asOther(ab).registerABATL('XA' + i, 'nobody', 'nobody', 1, 0, 0))) ok.registerABATL++;
        if (await tryTx(() => asOther(cl).createCluster(100 + (i % 100), 'c', 0, Math.floor(Date.now() / 1000) + 99999, 1, 10, 10))) ok.createCluster++;
        if (await tryTx(() => asOther(rt).reroutePath('XP' + i, 'a'))) ok.reroutePath++;
      }
      R.unauthorised_accept = { N, ...ok };
    }
    // ABATL record for unregistered identities, called by the operator
    let acc = 0; for (let i = 0; i < N; i++) if (await tryTx(() => ab.registerABATL('GH' + i, 'ghostNID' + i, 'ghostNIAS' + i, 1, 0, 0))) acc++;
    R.abatl_unregistered_accept = { N, accepted: acc };
    // wrong endpoints
    acc = 0; for (let i = 0; i < N; i++) if (await tryTx(() => rt.createPath('WE' + i, 'a', 'b', ['a', 'x', 'c'], 'Default'))) acc++;
    R.wrong_endpoints_accept = { N, accepted: acc };
    // reroute where the failed node sits in every backup
    for (const n of ['a', 'b', 'c', 'd']) await (await nid.registerNode('T' + n + set, 's', 1, 1, 'NID').catch?.(() => null) || { wait: async () => 0 }).wait?.();
    acc = 0; for (let i = 0; i < N; i++) { const id = 'NB' + i; const A = ['s' + i, 'm' + i, 't' + i], B = ['s' + i, 'k' + i, 't' + i];
      for (const x of [...A, ...B]) { try { await (await nid.registerNode(x, 's', 1, 1, 'NID')).wait(); } catch {} }
      await (await rt.createPath(id, A[0], A[2], A, 'Default')).wait(); await (await rt.createDisjointPath(id, B)).wait();
      if (await tryTx(() => rt.reroutePath(id, "k" + i, { gasLimit: 3000000 }))) acc++; }
    R.no_alternative_accept = { N, accepted: acc };
    // reroute onto a backup whose intermediate node is inactive
    acc = 0; for (let i = 0; i < N; i++) { const id = 'NB' + i; // reuse registered nodes, new path ids
      const id2 = 'IN' + i, A = ['s' + i, 'm' + i, 't' + i], B = ['s' + i, 'k' + i, 't' + i];
      await (await rt.createPath(id2, A[0], A[2], A, 'Default')).wait(); await (await rt.createDisjointPath(id2, B)).wait();
      await (await nid.setNodeStatus('k' + i, false)).wait();
      if (await tryTx(() => rt.reroutePath(id2, "m" + i, { gasLimit: 3000000 }))) acc++; }
    R.inactive_backup_accept = { N, accepted: acc };
    return R;
  }
  res.attacks = {}; const NA = LIVE ? TR : 100;
  if (ST('attacks')) for (const set of ['original', 'secured']) { res.attacks[set] = await attacks(set, NA); console.log('E5', set, JSON.stringify(res.attacks[set])); }

  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'data', (LIVE ? 'experiments_sepolia' : 'experiments_local') + (process.env.STAGES ? '_' + process.env.STAGES.replace(/,/g, '-') : '') + '.json'), JSON.stringify(res));
  console.log('done'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
