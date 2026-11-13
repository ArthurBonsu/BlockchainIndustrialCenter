#!/usr/bin/env node
// run_neso_validation.js
// -----------------------------------------------------------------------------
// One command that runs the whole real-data validation and stores everything in
// a NEW timestamped folder inside test/energyresults/:
//
//   test/energyresults/neso_run_<UTC timestamp>/
//     run.log                        full console output of this run
//     run_summary.json               parameters, input-file SHA-256 hashes, step results
//     README.txt                     what each file is and the caveats
//     contracts_used.json            addresses + oracle ABI used
//     neso_replay_<day>.json         24 on-chain readings (tx hash, block, gas, score)
//     neso_replay_<day>.csv          the same as a table
//     fig_neso_context.pdf/.png      demand / price / DFS vs tau(t)   (needs Python)
//     neso_context_stats.json        numbers behind that figure
//     onchain_validation_results.json   (only with --with-contracts)
//
// Steps
//   1. Fingerprint the input CSVs (SHA-256).
//   2. Replay 24 hourly readings of REAL GB frequency (NESO, 1 s data) through
//      the deployed GridStabilityOracle on Sepolia: one real transaction per
//      hour, scores decoded from each receipt's ConditionUpdated event and then
//      re-checked against the event logs of the confirmed blocks.
//   3. Compare tau(t) with real GB demand, day-ahead prices and Demand
//      Flexibility Service events (runs generate_neso_context_figure.py).
//   4. Optional (--with-contracts): the full contract validation
//      (onchain_validation.js: setup, oracle, TimeWeightedAMM and
//      GridResponsiveAMM swaps, ~45 transactions, spends testnet gas and may seed
//      liquidity). Its output is moved into this run folder.
//
// Run from the project root:
//   node test/energytest/run_neso_validation.js                 (worst day in the NESO file)
//   node test/energytest/run_neso_validation.js --dry-run       (no transactions)
//   node test/energytest/run_neso_validation.js --day 2026-10-15 --file fnew-2026-10.csv
//   node test/energytest/run_neso_validation.js --with-contracts
//
// Options
//   --file <csv>        NESO frequency CSV in neso_data/ (default: the only fnew-*.csv there)
//   --day YYYY-MM-DD    day to replay            (default: --worst-day)
//   --worst-day         day with the largest |f - 50 Hz| in the file
//   --dry-run           no transactions; still runs steps 1 and 3
//   --skip-chain        skip step 2
//   --skip-context      skip step 3
//   --with-contracts    add step 4
//   --label <text>      suffix for the run folder name
//
// Folders (relative to this file):
//   test/energytest/neso_data/   fnew-YYYY-M.csv, demanddataupdate_2026.csv,
//                                dfs-utilisation-report.csv, day_ahead_prices.csv
//   test/energyresults/          output root
// Credentials (project-root .env.local or .env): PRIVATE_KEY (the oracle deployer),
// INFURA_PROJECT_ID (or ETHEREUM_PROVIDER_URL / RPC_URL).
//
// What is real and what is not
//   * Frequency: real NESO measurements. GB runs at 50 Hz, the oracle at 60 Hz;
//     the score depends only on |f - f_nom|, so each reading is mapped as
//     f_fed = 60000 mHz + (f_GB - 50000 mHz), which preserves the deviation.
//   * Per hour the second with the largest |f - 50| is used. Voltage is held at
//     the 120 V nominal (no open real voltage feed is used).
//   * Historical replay through an off-chain adapter, NOT a live utility feed.
//   * Demand/price/DFS comparison is descriptive; it does not test the AMM.
// -----------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const cp = require('child_process');

// ---- env (.env.local first, then .env; first definition of a key wins) ---------
const LOADED_ENV = [];
try {
    const dotenv = require('dotenv');
    const root = path.join(__dirname, '..', '..');
    for (const f of [path.join(root, '.env.local'), path.join(root, '.env'), path.join(process.cwd(), '.env.local'), path.join(process.cwd(), '.env')]) {
        if (fs.existsSync(f) && !LOADED_ENV.includes(f)) { dotenv.config({ path: f }); LOADED_ENV.push(f); }
    }
} catch (e) { /* dotenv only needed for the on-chain steps */ }

// ---- contracts (same deployment as the paper / onchain_validation.js) ----------
const NETWORK = { name: 'Sepolia', chainId: 11155111 };
const ADDRESSES = {
    EnergyTokenRE: '0xa78fc8e55a017cb5659476f6d67fe77c22b4c59a',
    EnergyTokenNRE: '0x8b8d7b0d8f38488f56454337205e269c20892e6c',
    EnergyTokenVault: '0x623ba68eb8c93d6204f449d1a2596078d094b13f',
    GridStabilityOracle: '0x9580429807f611a286255ff325e7c6812343d340',
    TimeWeightedAMM: '0xd85499cb852d582a26570f1c2b391c513ace78a2',
    GridResponsiveAMM: '0x99edf88047f58196d73528eb1e76abe7ed7f0b2e',
};
const ORACLE_ADDRESS = ADDRESSES.GridStabilityOracle;
const ORACLE_ABI = [
    { inputs: [{ internalType: 'uint256', name: 'frequency', type: 'uint256' }, { internalType: 'uint256', name: 'voltage', type: 'uint256' }], name: 'updateCondition', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { inputs: [], name: 'getStabilityScore', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'isGridStressed', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
    { anonymous: false, inputs: [
        { indexed: false, internalType: 'uint256', name: 'frequency', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'voltage', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'stabilityScore', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' }], name: 'ConditionUpdated', type: 'event' },
];

// ---- oracle parameters (manuscript Eq. for G) ------------------------------------
const GB_NOMINAL_MHZ = 50000;
const NOMINAL_MHZ = 60000, NOMINAL_MV = 120000;
const DF_MAX_MHZ = 2000, DV_MAX_MV = 16000;      // 2 Hz and 13.33% of 120 V
const ALPHA_F = 0.6, ALPHA_V = 0.4, G_THRESHOLD = 0.85;
const ETH_USD_PRICE = 3200;
const expectedScore = (fMHz, vMV) =>
    ALPHA_F * Math.max(0, 1 - Math.abs(fMHz - NOMINAL_MHZ) / DF_MAX_MHZ) +
    ALPHA_V * Math.max(0, 1 - Math.abs(vMV - NOMINAL_MV) / DV_MAX_MV);

// ---- args ------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const flag = (n) => argv.includes(n);
const DRY = flag('--dry-run'), SKIP_CHAIN = flag('--skip-chain'), SKIP_CONTEXT = flag('--skip-context');
const WITH_CONTRACTS = flag('--with-contracts');
const DAY_ARG = arg('--day');
const DATA_DIR = path.join(__dirname, 'neso_data');
const RESULTS_ROOT = path.join(__dirname, '..', 'energyresults');

// ---- run folder + tee logging ---------------------------------------------------
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LABEL = (arg('--label') || '').replace(/[^A-Za-z0-9_-]/g, '');
const RUN_DIR = path.join(RESULTS_ROOT, `neso_run_${STAMP}${DRY ? '_dryrun' : ''}${LABEL ? '_' + LABEL : ''}`);
fs.mkdirSync(RUN_DIR, { recursive: true });
const LOG_PATH = path.join(RUN_DIR, 'run.log');
const _log = console.log, _warn = console.warn, _err = console.error;
const fmt = (a) => a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
console.log = (...a) => { _log(...a); fs.appendFileSync(LOG_PATH, fmt(a) + '\n'); };
console.warn = (...a) => { _warn(...a); fs.appendFileSync(LOG_PATH, fmt(a) + '\n'); };
console.error = (...a) => { _err(...a); fs.appendFileSync(LOG_PATH, fmt(a) + '\n'); };
const out = (s) => { process.stdout.write(s); fs.appendFileSync(LOG_PATH, s); };
const writeJSON = (name, obj) => fs.writeFileSync(path.join(RUN_DIR, name), JSON.stringify(obj, null, 2));

// ---- helpers ---------------------------------------------------------------------
function sha256(file) {
    return new Promise((res, rej) => {
        const h = crypto.createHash('sha256');
        fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
    });
}

function runChild(cmd, args, opts = {}) {
    return new Promise((resolve) => {
        const child = cp.spawn(cmd, args, { ...opts, shell: false });
        let tail = '';
        const take = (d) => { const s = d.toString(); tail = (tail + s).slice(-4000); process.stdout.write(s); fs.appendFileSync(LOG_PATH, s); };
        child.stdout.on('data', take); child.stderr.on('data', take);
        child.on('error', (e) => resolve({ code: -1, tail: e.message }));
        child.on('close', (code) => resolve({ code, tail }));
    });
}

function findPython() {
    for (const c of ['python', 'py', 'python3']) {
        try { const r = cp.spawnSync(c, ['--version'], { encoding: 'utf8' }); if (r.status === 0) return c; } catch (e) { /* next */ }
    }
    return null;
}

// ---- NESO CSV --------------------------------------------------------------------
function parseTime(s) {
    s = s.trim().replace(/^"|"$/g, '');
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);          // NESO writes midnight as a bare date
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
    return NaN;
}

async function loadFrequency(file) {
    if (!fs.existsSync(file)) throw new Error(`CSV not found: ${file}`);
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    let header = null, tCol = 0, fCol = 1;
    const rows = [];
    for await (const line of rl) {
        if (!line.trim()) continue;
        const cells = line.split(',');
        if (header === null) {
            header = cells.map(c => c.trim().replace(/^"|"$/g, ''));
            console.log(`CSV header: ${header.join(' | ')}`);
            const t = header.findIndex(h => /^(dtm|date|time|datetime|timestamp)/i.test(h));
            const f = header.findIndex(h => /^(f|freq|frequency)/i.test(h));
            tCol = t === -1 ? 0 : t;
            fCol = f === -1 ? (tCol === 0 ? 1 : 0) : f;
            console.log(`Using time column "${header[tCol]}", frequency column "${header[fCol]}"`);
            if (!isNaN(parseTime(cells[tCol] || '')) && !isNaN(parseFloat(cells[fCol]))) rows.push([parseTime(cells[tCol]), parseFloat(cells[fCol])]);
            continue;
        }
        const t = parseTime(cells[tCol] || ''), f = parseFloat(cells[fCol]);
        if (!isNaN(t) && !isNaN(f)) rows.push([t, f]);
    }
    console.log(`Loaded ${rows.length} frequency samples.`);
    if (!rows.length) throw new Error('No usable rows parsed -- check the header printed above.');
    const med = rows[Math.floor(rows.length / 2)][1];
    if (med < 49 || med > 51) throw new Error(`Median frequency ${med} is not near 50 Hz -- wrong column or units?`);
    return rows;
}

function pickDay(rows) {
    if (DAY_ARG) return DAY_ARG;
    const worst = {};
    for (const [t, f] of rows) {
        const k = new Date(t).toISOString().slice(0, 10), d = Math.abs(f - 50);
        if (!(k in worst) || d > worst[k]) worst[k] = d;
    }
    const [k, d] = Object.entries(worst).sort((a, b) => b[1] - a[1])[0];
    console.log(`Worst day in file: ${k} (max |df| = ${(d * 1000).toFixed(0)} mHz)`);
    return k;
}

function buildTrace(rows, day) {
    const trace = [];
    for (let hour = 0; hour < 24; hour++) {
        const start = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
        const inHour = rows.filter(([t]) => t >= start && t < start + 3600000);
        if (!inHour.length) throw new Error(`No samples for ${day} hour ${hour}; pick a day fully inside the file.`);
        const pick = inHour.reduce((a, b) => (Math.abs(b[1] - 50) > Math.abs(a[1] - 50) ? b : a));
        const gbMHz = Math.round(pick[1] * 1000);
        const fed = NOMINAL_MHZ + (gbMHz - GB_NOMINAL_MHZ);
        trace.push({
            hour, sampleTimeUTC: new Date(pick[0]).toISOString(), gbFrequencyHz: pick[1],
            frequency: fed, voltage: NOMINAL_MV, samplesInHour: inHour.length,
            expectedScore: expectedScore(fed, NOMINAL_MV), engineered: false,
            label: 'NESO real frequency (largest deviation in hour)',
        });
    }
    return trace;
}

// ---- step 2: frequency replay --------------------------------------------------
async function stepFrequencyReplay(csvPath) {
    const rows = await loadFrequency(csvPath);
    const day = pickDay(rows);
    const trace = buildTrace(rows, day);

    console.log('='.repeat(78));
    console.log(`NESO REAL-FREQUENCY REPLAY -- ${day}${DRY ? '   [DRY RUN]' : ''}`);
    console.log('='.repeat(78));
    console.log('hr  GB freq (Hz)  fed (mHz)  expected G  expected state');
    for (const p of trace) {
        console.log(`${String(p.hour).padStart(2)}  ${p.gbFrequencyHz.toFixed(3).padStart(10)}  ${String(p.frequency).padStart(9)}  ${p.expectedScore.toFixed(4).padStart(10)}  ${p.expectedScore < G_THRESHOLD ? 'STRESSED' : 'normal'}`);
    }

    const results = {
        metadata: {
            startedAt: new Date().toISOString(), mode: DRY ? 'dry-run' : 'live', network: NETWORK.name,
            oracleAddress: ORACLE_ADDRESS, source: 'NESO System Frequency open dataset (GB, 1 s), historical replay',
            sourceFile: path.basename(csvPath), day,
            frequencyMapping: 'f_fed = 60000 mHz + (f_GB - 50000 mHz); deviation preserved',
            voltage: 'held at 120 V nominal', aggregation: 'sample with largest |f-50 Hz| in each hour',
            note: 'Historical replay through an off-chain adapter; not a live utility/SCADA/PMU integration. In live mode every entry is a real on-chain transaction.',
        },
        readings: [],
    };
    const jsonName = `neso_replay_${day}.json`;
    const save = () => writeJSON(jsonName, results);

    if (DRY) {
        results.readings = trace.map(p => ({ ...p, success: null }));
        results.summary = { totalHours: 24, maxAbsDeviationHz: Math.max(...trace.map(p => Math.abs(p.gbFrequencyHz - 50))), minExpectedScore: Math.min(...trace.map(p => p.expectedScore)), note: 'dry run, no transactions sent' };
        save(); writeTable(day, results.readings);
        console.log('\nDry run: no transactions sent.');
        return { status: 'dry-run', day, ...results.summary };
    }

    const { Web3 } = require('web3');
    let rpcUrl, rpcSource;
    if (process.env.RPC_URL) { rpcUrl = process.env.RPC_URL; rpcSource = 'RPC_URL'; }
    else if (process.env.INFURA_PROJECT_ID) { rpcUrl = `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`; rpcSource = 'INFURA_PROJECT_ID'; }
    else {
        rpcSource = ['ETHEREUM_PROVIDER_URL', 'TATUM_ETHEREUM_ENDPOINT', 'ETHEREUM_RPC_URL'].find(k => (process.env[k] || '').trim());
        rpcUrl = rpcSource ? process.env[rpcSource].trim() : null;
    }
    if (!rpcUrl) throw new Error('No RPC endpoint: set INFURA_PROJECT_ID (or ETHEREUM_PROVIDER_URL) in .env.local');
    let pk = (process.env.PRIVATE_KEY || '').trim();
    if (!pk) throw new Error('Set PRIVATE_KEY in .env.local');
    if (pk.length === 64) pk = '0x' + pk;

    const web3 = new Web3(rpcUrl);
    web3.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
    const account = web3.eth.accounts.privateKeyToAccount(pk);
    web3.eth.accounts.wallet.add(account);
    const from = account.address;
    if ((process.env.WALLET_ADDRESS || '').trim() && process.env.WALLET_ADDRESS.trim().toLowerCase() !== from.toLowerCase()) {
        console.warn(`WARNING: PRIVATE_KEY derives ${from}, which differs from WALLET_ADDRESS in your env. ORACLE_ROLE must be held by the oracle deployer.`);
    }
    const chainId = Number(await web3.eth.getChainId());
    const balance = Number(web3.utils.fromWei(await web3.eth.getBalance(from), 'ether'));
    console.log(`\nEnv files loaded: ${LOADED_ENV.length ? LOADED_ENV.join(', ') : '(none found)'}\nRPC source: ${rpcSource}\nAccount: ${from}\nChain ID: ${chainId}${chainId === NETWORK.chainId ? ' (Sepolia)' : ''}\nBalance: ${balance} ETH\n`);
    if (!process.env.RPC_URL && chainId !== NETWORK.chainId) throw new Error('Not Sepolia; aborting.');
    results.metadata.account = from; results.metadata.chainId = chainId; results.metadata.rpcSource = rpcSource;

    const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS);
    const eventInputs = ORACLE_ABI.find(x => x.type === 'event').inputs;
    const eventTopic = web3.utils.keccak256('ConditionUpdated(uint256,uint256,uint256,uint256)');

    for (const p of trace) {
        out(`Hour ${String(p.hour).padStart(2, '0')}: GB ${p.gbFrequencyHz.toFixed(3)} Hz -> fed ${p.frequency} mHz ... `);
        const reading = { ...p };
        try {
            const gasPrice = await web3.eth.getGasPrice();
            const m = oracle.methods.updateCondition(p.frequency, p.voltage);
            let gas;
            try { gas = await m.estimateGas({ from }); }
            catch (e) { const fe = new Error(`estimateGas failed (${e.message}). Account probably lacks ORACLE_ROLE, has no ETH, or the address is wrong.`); fe.fatal = true; throw fe; }
            gas = (BigInt(gas) * 12n) / 10n;
            const receipt = await m.send({ from, gas });

            reading.success = true;
            reading.txHash = receipt.transactionHash;
            reading.blockNumber = Number(receipt.blockNumber);
            reading.gasUsed = Number(receipt.gasUsed);
            reading.gasPriceGwei = Number(web3.utils.fromWei(gasPrice, 'gwei'));
            reading.txCostETH = (reading.gasUsed * Number(gasPrice)) / 1e18;
            reading.txCostUSD = reading.txCostETH * ETH_USD_PRICE;

            const log = (receipt.logs || []).find(l => l.address.toLowerCase() === ORACLE_ADDRESS.toLowerCase() && l.topics && l.topics[0] === eventTopic);
            if (!log) throw new Error('ConditionUpdated event not found in receipt');
            const ev = web3.eth.abi.decodeParameters(eventInputs, log.data);
            reading.score = Number(ev.stabilityScore) / 1e18;
            reading.isStressed = reading.score < G_THRESHOLD;
            reading.matchesExpected = Number(ev.frequency) === p.frequency && Number(ev.voltage) === p.voltage && Math.abs(reading.score - p.expectedScore) < 1e-4;
            console.log(`G=${reading.score.toFixed(4)} ${reading.isStressed ? '[STRESSED] ' : ''}${reading.matchesExpected ? 'ok' : '*** differs from expected ***'}`);
        } catch (err) {
            reading.success = false;
            reading.error = err.message;
            console.log(`FAILED: ${err.message}`);
            if (err.fatal) { results.readings.push(reading); save(); writeTable(day, results.readings); throw err; }
        }
        results.readings.push(reading);
        save();
    }

    // independent re-check against the event logs of the confirmed blocks
    const ok = results.readings.filter(r => r.success);
    let logMismatches = null;
    if (ok.length) {
        try {
            const lo = Math.min(...ok.map(r => r.blockNumber)), hi = Math.max(...ok.map(r => r.blockNumber));
            // Match by transaction hash (block numbers come back as hex text under the custom
            // return format, so they are not a safe key). Retry once if the node is still catching up.
            let events = await oracle.getPastEvents('ConditionUpdated', { fromBlock: lo, toBlock: hi });
            if (events.length < ok.length) {
                console.log(`Event-log re-check: ${events.length}/${ok.length} logs returned; retrying in 15 s ...`);
                await new Promise(res => setTimeout(res, 15000));
                events = await oracle.getPastEvents('ConditionUpdated', { fromBlock: lo, toBlock: hi });
            }
            const byTx = {};
            for (const e of events) byTx[String(e.transactionHash).toLowerCase()] = e.returnValues;
            logMismatches = 0;
            for (const r of ok) {
                const ev = byTx[String(r.txHash).toLowerCase()];
                if (!ev) { r.eventLogConfirmed = false; r.eventLogNote = 'no ConditionUpdated log returned for this transaction'; }
                else {
                    r.eventLogConfirmed = Number(ev.frequency) === r.frequency && Number(ev.voltage) === r.voltage
                        && Math.abs(Number(ev.stabilityScore) / 1e18 - r.score) < 1e-6;
                    if (!r.eventLogConfirmed) r.eventLogNote = `log differs: f=${ev.frequency} v=${ev.voltage} G=${Number(ev.stabilityScore) / 1e18}`;
                }
                if (!r.eventLogConfirmed) { logMismatches++; console.log(`  hour ${r.hour}: ${r.eventLogNote}`); }
            }
        } catch (e) { console.log(`Event-log re-check skipped: ${e.message}`); }
    }

    results.metadata.finishedAt = new Date().toISOString();
    results.summary = {
        totalHours: trace.length, successCount: ok.length, failureCount: trace.length - ok.length,
        matchedExpectedCount: ok.filter(r => r.matchesExpected).length, eventLogMismatches: logMismatches,
        stressedHoursDetected: ok.filter(r => r.isStressed).map(r => r.hour),
        maxAbsDeviationHz: Math.max(...trace.map(p => Math.abs(p.gbFrequencyHz - 50))),
        minScore: ok.length ? Math.min(...ok.map(r => r.score)) : null,
        totalGasUsed: ok.reduce((s, r) => s + r.gasUsed, 0),
        totalCostETH: ok.reduce((s, r) => s + r.txCostETH, 0),
    };
    save(); writeTable(day, results.readings);
    console.log('\n' + '='.repeat(78));
    console.log(`Replay done. ${results.summary.successCount}/${trace.length} succeeded; ${results.summary.matchedExpectedCount} matched the off-chain expected score; event-log mismatches: ${logMismatches === null ? 'n/a' : logMismatches}.`);
    console.log(`Stressed hours: [${results.summary.stressedHoursDetected.join(', ')}]  (max |df| = ${results.summary.maxAbsDeviationHz.toFixed(3)} Hz)`);
    console.log('='.repeat(78));
    const clean = results.summary.failureCount === 0 && logMismatches === 0;
    return { status: clean ? 'ok' : 'completed-with-issues', day, ...results.summary };
}

function writeTable(day, readings) {
    const cols = ['hour', 'sampleTimeUTC', 'gbFrequencyHz', 'frequency', 'voltage', 'expectedScore', 'score', 'isStressed', 'matchesExpected', 'eventLogConfirmed', 'txHash', 'blockNumber', 'gasUsed', 'txCostETH', 'txCostUSD'];
    const names = ['hour', 'sample_time_utc', 'gb_frequency_hz', 'fed_frequency_mhz', 'voltage_mv', 'expected_G', 'onchain_G', 'stressed', 'matches_expected', 'event_log_confirmed', 'tx_hash', 'block', 'gas_used', 'tx_cost_eth', 'tx_cost_usd'];
    const lines = [names.join(',')].concat(readings.map(r => cols.map(c => (r[c] === undefined || r[c] === null ? '' : r[c])).join(',')));
    fs.writeFileSync(path.join(RUN_DIR, `neso_replay_${day}.csv`), lines.join('\n') + '\n');
}

// ---- step 3: context comparison (Python) ------------------------------------------
async function stepContext() {
    const script = path.join(__dirname, 'generate_neso_context_figure.py');
    if (!fs.existsSync(script)) return { status: 'skipped', reason: 'generate_neso_context_figure.py not found next to this file' };
    const py = findPython();
    if (!py) return { status: 'failed', reason: 'Python not found (tried python, py, python3)' };
    console.log(`\nRunning ${path.basename(script)} with ${py} ...`);
    const r = await runChild(py, [script, '--out-dir', RUN_DIR], { cwd: __dirname });
    const produced = ['fig_neso_context.pdf', 'fig_neso_context.png', 'neso_context_stats.json'].filter(f => fs.existsSync(path.join(RUN_DIR, f)));
    if (r.code !== 0 || produced.length < 3) {
        return { status: 'failed', exitCode: r.code, produced, reason: 'See run.log. Needs pandas, numpy and matplotlib (pip install pandas numpy matplotlib) and the three CSVs in neso_data/.', tail: r.tail.slice(-600) };
    }
    let stats = null;
    try { stats = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'neso_context_stats.json'), 'utf8')); } catch (e) { /* ignore */ }
    return { status: 'ok', produced, stats };
}

// ---- step 4: full contract validation (optional) ----------------------------------
async function stepContracts() {
    const script = path.join(__dirname, 'onchain_validation.js');
    if (!fs.existsSync(script)) return { status: 'skipped', reason: 'onchain_validation.js not found next to this file' };
    console.log('\nRunning onchain_validation.js (this sends ~45 transactions and can take 10+ minutes) ...');
    const r = await runChild(process.execPath, [script], { cwd: RUN_DIR, env: process.env });
    const f = path.join(RUN_DIR, 'onchain_validation_results.json');
    if (r.code !== 0 || !fs.existsSync(f)) return { status: 'failed', exitCode: r.code, reason: 'See run.log', tail: r.tail.slice(-600) };
    let summary = null;
    try { summary = JSON.parse(fs.readFileSync(f, 'utf8')).summary || null; } catch (e) { /* ignore */ }
    return { status: 'ok', file: 'onchain_validation_results.json', summary };
}

// ---- main --------------------------------------------------------------------------
(async () => {
    const summary = {
        startedAt: new Date().toISOString(), mode: DRY ? 'dry-run' : 'live', args: argv,
        node: process.version, platform: process.platform, runFolder: RUN_DIR,
        envFilesLoaded: LOADED_ENV.map(f => path.basename(f)), inputs: [], steps: {},
    };
    console.log(`Run folder: ${RUN_DIR}`);

    // pick the NESO frequency file
    let fileArg = arg('--file');
    if (!fileArg) {
        const cands = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter(f => /^fnew-.*\.csv$/i.test(f)) : [];
        if (cands.length === 1) fileArg = cands[0];
        else if (!SKIP_CHAIN) { console.error(cands.length ? `Several fnew-*.csv files found (${cands.join(', ')}); pass --file.` : `No fnew-*.csv in ${DATA_DIR}.`); process.exitCode = 1; return; }
    }
    const csvPath = fileArg ? (fs.existsSync(fileArg) ? fileArg : path.join(DATA_DIR, fileArg)) : null;

    // step 1: fingerprint inputs
    console.log('\n[1/4] Fingerprinting input files');
    const inputs = [csvPath, ...['demanddataupdate_2026.csv', 'dfs-utilisation-report.csv', 'day_ahead_prices.csv'].map(n => path.join(DATA_DIR, n))].filter(f => f && fs.existsSync(f));
    for (const f of inputs) {
        const h = await sha256(f);
        summary.inputs.push({ file: path.basename(f), bytes: fs.statSync(f).size, sha256: h });
        console.log(`  ${path.basename(f)}  ${fs.statSync(f).size} bytes  sha256 ${h}`);
    }
    writeJSON('contracts_used.json', { network: NETWORK, addresses: ADDRESSES, oracleABI: ORACLE_ABI, oracleParameters: { nominalFrequency_mHz: NOMINAL_MHZ, nominalVoltage_mV: NOMINAL_MV, toleranceFrequency_mHz: DF_MAX_MHZ, toleranceVoltage_mV: DV_MAX_MV, alphaFrequency: ALPHA_F, alphaVoltage: ALPHA_V, stressThreshold: G_THRESHOLD } });
    summary.steps.fingerprint = { status: 'ok', files: summary.inputs.length };

    // step 2
    console.log('\n[2/4] Real-frequency replay through GridStabilityOracle');
    if (SKIP_CHAIN) summary.steps.frequencyReplay = { status: 'skipped' };
    else {
        try { summary.steps.frequencyReplay = await stepFrequencyReplay(csvPath); }
        catch (e) { console.error(`Replay failed: ${e.message}`); summary.steps.frequencyReplay = { status: 'failed', error: e.message }; }
    }

    // step 3
    console.log('\n[3/4] Demand / price / DFS comparison against tau(t)');
    if (SKIP_CONTEXT) summary.steps.context = { status: 'skipped' };
    else { try { summary.steps.context = await stepContext(); } catch (e) { summary.steps.context = { status: 'failed', error: e.message }; } }
    if (summary.steps.context.status === 'failed') console.error(`Context step failed: ${summary.steps.context.reason || summary.steps.context.error}`);

    // step 4
    console.log('\n[4/4] Full contract validation');
    if (!WITH_CONTRACTS) { summary.steps.contractValidation = { status: 'skipped', reason: 'pass --with-contracts to include' }; console.log('  skipped (pass --with-contracts to include)'); }
    else if (DRY) { summary.steps.contractValidation = { status: 'skipped', reason: 'dry run' }; console.log('  skipped (dry run)'); }
    else { try { summary.steps.contractValidation = await stepContracts(); } catch (e) { summary.steps.contractValidation = { status: 'failed', error: e.message }; } }

    summary.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(RUN_DIR, 'README.txt'),
`NESO real-data validation run  ${summary.startedAt}  (${summary.mode})

run_summary.json         parameters, SHA-256 of every input CSV, result of each step
run.log                  full console output
contracts_used.json      Sepolia addresses and the oracle ABI/parameters used
neso_replay_<day>.json   24 hourly readings of real GB frequency sent to GridStabilityOracle
neso_replay_<day>.csv    the same as a table (tx hash, block, gas, on-chain score)
fig_neso_context.*       real GB demand, day-ahead price and DFS events vs the tau(t) schedule
neso_context_stats.json  numbers behind that figure
onchain_validation_results.json   only if --with-contracts was used

Caveats (state these wherever the results are used):
- The frequency series is a historical replay of NESO data through an off-chain adapter, not a live feed.
- GB runs at 50 Hz; readings are mapped to the oracle's 60 Hz nominal by preserving the deviation.
- Per hour, the second with the largest deviation from 50 Hz is used. Voltage is held at 120 V nominal.
- The demand/price/DFS figure is descriptive (design check). It does not test load shifting.
`);
    summary.files = fs.readdirSync(RUN_DIR).sort();
    writeJSON('run_summary.json', summary);

    const failed = Object.entries(summary.steps).filter(([, v]) => v.status === 'failed' || v.status === 'completed-with-issues').map(([k]) => k);
    console.log('\n' + '='.repeat(78));
    console.log('RUN COMPLETE');
    for (const [k, v] of Object.entries(summary.steps)) console.log(`  ${k.padEnd(20)} ${v.status}`);
    console.log(`Everything is in: ${RUN_DIR}`);
    console.log('='.repeat(78));
    if (failed.length) process.exitCode = 1;
})().catch(e => { console.error(e.message || e); process.exit(1); });