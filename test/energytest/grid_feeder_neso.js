// grid_feeder_neso.js
// -----------------------------------------------------------------------------
// Replays 24 hourly readings of REAL, measured Great Britain system frequency
// (NESO "System Frequency" open dataset, 1-second CSV) through the deployed
// GridStabilityOracle on Sepolia: one real updateCondition() transaction per hour.
//
// Run from the project root:
//   node test/energytest/grid_feeder_neso.js --file fnew-2023-12.csv --worst-day --dry-run
//   node test/energytest/grid_feeder_neso.js --file fnew-2023-12.csv --worst-day
//   node test/energytest/grid_feeder_neso.js --file fnew-2023-12.csv --day 2023-12-14
//
// Folders (relative to this script):
//   test/energytest/neso_data/    put the NESO CSV here (e.g. fnew-2023-12.csv)
//   test/energyresults/           output: neso_<day>.json
//
// .env (project root, same as the other scripts): INFURA_PROJECT_ID, PRIVATE_KEY
// (the account holding ORACLE_ROLE, i.e. the oracle deployer).
//
// What is real and what is not:
//   * Frequency: real NESO measurements. GB runs at 50 Hz, the oracle is set to
//     60 Hz. The score depends only on |f - f_nom|, so each reading is mapped as
//         f_fed = 60000 mHz + (f_GB - 50000 mHz)
//     which preserves the deviation exactly.
//   * Voltage: held at the 120 V nominal (no open real voltage feed is used).
//   * Historical replay through an off-chain adapter, NOT a live utility feed.
//   * Per hour, the reading with the largest |f - 50| in that hour is used.
//
// Scores are decoded from the ConditionUpdated event in each receipt, then
// re-checked against the event logs of the confirmed blocks at the end.
// -----------------------------------------------------------------------------

try {
    require('dotenv').config();
    require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
} catch (e) { /* dotenv is only needed for the on-chain run */ }
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ---- contract (same deployment as onchain_validation.js) ----------------------
const ORACLE_ADDRESS = '0x9580429807f611a286255ff325e7c6812343d340'; // GridStabilityOracle
const ORACLE_ABI = [
    { inputs: [{ internalType: 'uint256', name: 'frequency', type: 'uint256' }, { internalType: 'uint256', name: 'voltage', type: 'uint256' }], name: 'updateCondition', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { anonymous: false, inputs: [
        { indexed: false, internalType: 'uint256', name: 'frequency', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'voltage', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'stabilityScore', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' }], name: 'ConditionUpdated', type: 'event' },
];

// ---- oracle parameters (manuscript Eq. for G) ----------------------------------
const GB_NOMINAL_MHZ = 50000;
const NOMINAL_MHZ = 60000, NOMINAL_MV = 120000;
const DF_MAX_MHZ = 2000, DV_MAX_MV = 16000;       // 2 Hz and 13.33% of 120 V
const ALPHA_F = 0.6, ALPHA_V = 0.4, G_THRESHOLD = 0.85;
const ETH_USD_PRICE = 3200;

function expectedScore(fMHz, vMV) {
    const sf = Math.max(0, 1 - Math.abs(fMHz - NOMINAL_MHZ) / DF_MAX_MHZ);
    const sv = Math.max(0, 1 - Math.abs(vMV - NOMINAL_MV) / DV_MAX_MV);
    return ALPHA_F * sf + ALPHA_V * sv;
}

// ---- args ----------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const flag = (n) => argv.includes(n);
const FILE_ARG = arg('--file'), DAY_ARG = arg('--day'), WORST = flag('--worst-day'), DRY = flag('--dry-run');
if (!FILE_ARG || (!DAY_ARG && !WORST)) {
    console.error('Usage: node test/energytest/grid_feeder_neso.js --file <csv> (--day YYYY-MM-DD | --worst-day) [--dry-run]');
    process.exit(1);
}
const DATA_DIR = path.join(__dirname, 'neso_data');
const RESULTS_DIR = path.join(__dirname, '..', 'energyresults');
const CSV_PATH = fs.existsSync(FILE_ARG) ? FILE_ARG : path.join(DATA_DIR, FILE_ARG);

// ---- NESO CSV ------------------------------------------------------------------
// Column names are detected from the header (time = dtm/date/time, frequency = f/freq).
function parseTime(s) {
    s = s.trim().replace(/^"|"$/g, '');
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
    return NaN;
}

async function loadFrequency(file) {
    if (!fs.existsSync(file)) throw new Error(`CSV not found: ${file}\nPut the NESO file in ${DATA_DIR}`);
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
    console.log(`--worst-day: ${k} (max |df| = ${(d * 1000).toFixed(0)} mHz)`);
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

// ---- main ------------------------------------------------------------------------
async function main() {
    const rows = await loadFrequency(CSV_PATH);
    const day = pickDay(rows);
    const trace = buildTrace(rows, day);

    console.log('='.repeat(78));
    console.log(`NESO REAL-FREQUENCY REPLAY -- ${day}`);
    console.log('='.repeat(78));
    console.log('hr  GB freq (Hz)  fed (mHz)  expected G  expected state');
    for (const p of trace) {
        console.log(`${String(p.hour).padStart(2)}  ${p.gbFrequencyHz.toFixed(3).padStart(10)}  ${String(p.frequency).padStart(9)}  ${p.expectedScore.toFixed(4).padStart(10)}  ${p.expectedScore < G_THRESHOLD ? 'STRESSED' : 'normal'}`);
    }
    if (DRY) { console.log('\n--dry-run: no transactions sent.'); return; }

    const { Web3 } = require('web3');
    const web3 = new Web3(process.env.RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
    web3.defaultReturnFormat = { number: 'str', bytes: 'HEX' };

    let pk = (process.env.PRIVATE_KEY || '').trim();
    if (!pk) { console.error('Set PRIVATE_KEY in .env'); process.exit(1); }
    if (pk.length === 64) pk = '0x' + pk;
    const account = web3.eth.accounts.privateKeyToAccount(pk);
    web3.eth.accounts.wallet.add(account);
    const from = account.address;

    const chainId = Number(await web3.eth.getChainId());
    const balance = Number(web3.utils.fromWei(await web3.eth.getBalance(from), 'ether'));
    console.log(`\nAccount: ${from}\nChain ID: ${chainId}${chainId === 11155111 ? ' (Sepolia)' : ''}\nBalance: ${balance} ETH\n`);
    if (!process.env.RPC_URL && chainId !== 11155111) { console.error('Not Sepolia; aborting.'); process.exit(1); }

    const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS);
    const eventInputs = ORACLE_ABI.find(x => x.type === 'event').inputs;
    const eventTopic = web3.utils.keccak256('ConditionUpdated(uint256,uint256,uint256,uint256)');

    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const OUTPUT_FILE = path.join(RESULTS_DIR, `neso_${day}.json`);
    const results = {
        metadata: {
            startedAt: new Date().toISOString(), network: 'Sepolia', oracleAddress: ORACLE_ADDRESS, account: from,
            source: 'NESO System Frequency open dataset (GB, 1 s), historical replay', sourceFile: path.basename(CSV_PATH), day,
            frequencyMapping: 'f_fed = 60000 mHz + (f_GB - 50000 mHz); deviation preserved',
            voltage: 'held at 120 V nominal',
            note: 'Historical replay through an off-chain adapter; not a live utility/SCADA/PMU integration. Every entry is a real on-chain transaction.',
        },
        readings: [],
    };
    const save = () => fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    for (const p of trace) {
        process.stdout.write(`Hour ${String(p.hour).padStart(2, '0')}: GB ${p.gbFrequencyHz.toFixed(3)} Hz -> fed ${p.frequency} mHz ... `);
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
            if (err.fatal) { results.readings.push(reading); save(); process.exit(1); }
        }
        results.readings.push(reading);
        save();
    }

    // Independent re-check from the event logs of the confirmed blocks.
    const ok = results.readings.filter(r => r.success);
    let logMismatches = null;
    if (ok.length) {
        try {
            const from_ = Math.min(...ok.map(r => r.blockNumber)), to_ = Math.max(...ok.map(r => r.blockNumber));
            const events = await oracle.getPastEvents('ConditionUpdated', { fromBlock: from_, toBlock: to_ });
            const byBlock = {};
            for (const e of events) byBlock[e.blockNumber] = e.returnValues;
            logMismatches = 0;
            for (const r of ok) {
                const ev = byBlock[r.blockNumber];
                r.eventLogConfirmed = !!ev && Number(ev.frequency) === r.frequency && Number(ev.voltage) === r.voltage
                    && Math.abs(Number(ev.stabilityScore) / 1e18 - r.score) < 1e-6;
                if (!r.eventLogConfirmed) logMismatches++;
            }
        } catch (e) { console.log(`Event-log re-check skipped: ${e.message}`); }
    }

    results.metadata.finishedAt = new Date().toISOString();
    results.summary = {
        totalHours: trace.length, successCount: ok.length, failureCount: trace.length - ok.length,
        matchedExpectedCount: ok.filter(r => r.matchesExpected).length,
        eventLogMismatches: logMismatches,
        stressedHoursDetected: ok.filter(r => r.isStressed).map(r => r.hour),
        maxAbsDeviationHz: Math.max(...trace.map(p => Math.abs(p.gbFrequencyHz - 50))),
        minScore: ok.length ? Math.min(...ok.map(r => r.score)) : null,
        totalGasUsed: ok.reduce((s, r) => s + r.gasUsed, 0),
    };
    save();

    console.log('\n' + '='.repeat(78));
    console.log(`Done. ${results.summary.successCount}/${trace.length} succeeded; ${results.summary.matchedExpectedCount} matched the off-chain expected score; event-log mismatches: ${logMismatches === null ? 'n/a' : logMismatches}.`);
    console.log(`Stressed hours: [${results.summary.stressedHoursDetected.join(', ')}]  (max |df| = ${results.summary.maxAbsDeviationHz.toFixed(3)} Hz)`);
    console.log(`Results written to ${OUTPUT_FILE}`);
    console.log('='.repeat(78));
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
