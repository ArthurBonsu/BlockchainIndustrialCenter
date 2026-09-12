// verify_via_events.js
// -----------------------------------------------------------------------------
// Supersedes verify_oracle_reads.js and verify_grid_feeder_history.js. Both of
// those relied on reading CURRENT contract state (either pinned to a block,
// or via the historicalConditions mapping) -- and we've now seen that even
// conditionCount() itself reads back inconsistently (18 when 30+ is expected),
// which means the read-current-state approach isn't trustworthy on whatever
// RPC path is being used here, independent of which specific state variable
// is read.
//
// This script instead queries the ConditionUpdated EVENT LOG for the exact,
// already-known block numbers of every real transaction (from your JSON
// files) -- event logs are immutable once a block is mined, and querying a
// specific historical block range for logs is a much more standard, more
// reliably-served RPC operation than reading arbitrary current state. No
// value-matching, no index offsets, no ambiguity: we ask "what happened in
// block N" using the block number the transaction receipt itself already
// told us, for every single transaction.
//
// Usage:
//   1. Put grid_feeder_results.json AND the two onchain_validation_results
//      JSON files (rename them onchain_validation_run1.json /
//      onchain_validation_run2.json) in the same folder as this script.
//   2. .env needs INFURA_PROJECT_ID (read-only, no PRIVATE_KEY needed)
//   3. node verify_via_events.js
// -----------------------------------------------------------------------------

require('dotenv').config();
const { Web3 } = require('web3');
const fs = require('fs');

const ORACLE_ADDRESS = "0x9580429807f611a286255ff325e7c6812343d340";

const ORACLE_ABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "internalType": "uint256", "name": "frequency", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "voltage", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "stabilityScore", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
        ],
        "name": "ConditionUpdated",
        "type": "event",
    },
];

function loadIfExists(path) {
    return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : null;
}

async function checkBlockRange(oracle, label, expectations) {
    // expectations: [{ blockNumber, expectedFrequency, expectedVoltage, expectedScore, tag }]
    if (!expectations.length) return;
    const fromBlock = Math.min(...expectations.map(e => e.blockNumber));
    const toBlock = Math.max(...expectations.map(e => e.blockNumber));

    console.log(`\n${label} (blocks ${fromBlock}-${toBlock}):`);
    const events = await oracle.getPastEvents('ConditionUpdated', { fromBlock, toBlock });
    const byBlock = {};
    for (const e of events) byBlock[e.blockNumber] = e.returnValues;

    console.log("tag                 block       expected(f,v,score)          event-log(f,v,score)         match?");
    console.log("-".repeat(100));
    let mismatches = 0;
    for (const exp of expectations) {
        const ev = byBlock[exp.blockNumber];
        if (!ev) {
            console.log(`${exp.tag.padEnd(20)}${String(exp.blockNumber).padEnd(12)}NO EVENT FOUND IN THIS BLOCK`);
            mismatches++;
            continue;
        }
        const f = Number(ev.frequency), v = Number(ev.voltage), s = Number(ev.stabilityScore) / 1e18;
        const agree = f === exp.expectedFrequency && v === exp.expectedVoltage && Math.abs(s - exp.expectedScore) < 1e-6;
        if (!agree) mismatches++;
        console.log(`${exp.tag.padEnd(20)}${String(exp.blockNumber).padEnd(12)}(${exp.expectedFrequency},${exp.expectedVoltage},${exp.expectedScore.toFixed(4)})`.padEnd(70) +
            `(${f},${v},${s.toFixed(4)})  ${agree ? 'OK' : '*** MISMATCH ***'}`);
    }
    console.log("-".repeat(100));
    console.log(mismatches === 0 ? `All ${expectations.length} entries confirmed by event log.` : `${mismatches} mismatch(es) -- event log is authoritative.`);
}

async function main() {
    const web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
    const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS);

    // --- Grid feeder run ---
    const feeder = loadIfExists("grid_feeder_results.json");
    if (feeder) {
        const expectations = feeder.readings.filter(r => r.success).map(r => ({
            blockNumber: r.blockNumber,
            expectedFrequency: r.frequency,
            expectedVoltage: r.voltage,
            expectedScore: r.score,
            tag: `hour ${r.hour}${r.engineered ? ' (engineered)' : ''}`,
        }));
        await checkBlockRange(oracle, "grid_feeder.js run", expectations);
    } else {
        console.log("grid_feeder_results.json not found in this folder -- skipping.");
    }

    // --- Both onchain_validation runs' stress reads ---
    for (const [file, tag] of [
        ["onchain_validation_run1.json", "run1 stress read"],
        ["onchain_validation_run2.json", "run2 stress read"],
    ]) {
        const run = loadIfExists(file);
        if (!run) { console.log(`\n${file} not found -- skipping.`); continue; }
        const stressTx = run.oracle && run.oracle.updateCondition_stress;
        if (!stressTx || !stressTx.blockNumber) { console.log(`\n${file}: no updateCondition_stress block found -- skipping.`); continue; }
        await checkBlockRange(oracle, tag, [{
            blockNumber: stressTx.blockNumber,
            expectedFrequency: 59000,
            expectedVoltage: 120000,
            expectedScore: 0.7,
            tag: "stress call",
        }]);
    }
}

main().catch(console.error);
