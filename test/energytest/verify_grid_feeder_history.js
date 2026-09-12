// verify_grid_feeder_history.js
// -----------------------------------------------------------------------------
// Definitive, zero-gas re-check of the grid_feeder.js run using the Oracle's
// PERMANENT audit log (historicalConditions[index] / conditionCount) instead
// of re-reading currentCondition pinned to a specific block.
//
// Why this is more reliable than block-pinning: currentCondition gets
// overwritten by every updateCondition() call, so reading its value "as of
// block N" requires the RPC backend to reconstruct historical state -- which
// is exactly where we saw an intermittent staleness artifact (grid_feeder
// hours 15 and 21 read back the PRIOR hour's stressed score). By contrast,
// historicalConditions[i] is written once and never touched again, so
// reading it via "latest" (right now, no pinning at all) is unambiguous
// regardless of when you ask.
//
// This script auto-locates the grid_feeder run's 24 entries in the log by
// matching (frequency, voltage) pairs from grid_feeder_results.json against
// historicalConditions, rather than assuming a hardcoded index offset --
// robust even if extra updateCondition() calls happened that we don't know
// about.
//
// Usage:
//   1. Make sure grid_feeder_results.json is in the same folder
//   2. .env needs INFURA_PROJECT_ID (no PRIVATE_KEY needed -- read-only)
//   3. node verify_grid_feeder_history.js
// -----------------------------------------------------------------------------

require('dotenv').config();
const { Web3 } = require('web3');
const fs = require('fs');

const ORACLE_ADDRESS = "0x9580429807f611a286255ff325e7c6812343d340";

const ORACLE_ABI = [
    { "inputs": [], "name": "conditionCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "historicalConditions", "outputs": [
        { "internalType": "uint256", "name": "frequency", "type": "uint256" },
        { "internalType": "uint256", "name": "voltage", "type": "uint256" },
        { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
        { "internalType": "uint256", "name": "stabilityScore", "type": "uint256" },
    ], "stateMutability": "view", "type": "function" },
];

async function main() {
    const web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
    const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS);

    const feeder = JSON.parse(fs.readFileSync("grid_feeder_results.json", "utf8"));
    const readings = feeder.readings.filter(r => r.success);

    const conditionCount = Number(await oracle.methods.conditionCount().call());
    console.log(`conditionCount right now: ${conditionCount}`);

    // Read back a window of the log (last 60 entries, or from 0 if fewer)
    const windowStart = Math.max(0, conditionCount - 60);
    const log = [];
    for (let i = windowStart; i < conditionCount; i++) {
        const r = await oracle.methods.historicalConditions(i).call();
        log.push({
            index: i,
            frequency: Number(r.frequency ?? r[0]),
            voltage: Number(r.voltage ?? r[1]),
            score: Number(r.stabilityScore ?? r[3]) / 1e18,
        });
    }

    // NOTE: some (frequency, voltage) pairs recur across runs -- e.g. hour
    // 14's engineered (59000, 120000) is IDENTICAL to the stress condition
    // used in both earlier onchain_validation.js runs. A pure value-search
    // would be ambiguous for those entries. Instead: locate the feeder
    // block's start using hour 0's reading (a noisy, effectively-unique
    // value unlikely to collide with anything else), then verify the
    // remaining 23 hours as 23 CONSECUTIVE entries immediately after it --
    // matching by position within the run, not by value alone.
    const hour0 = readings.find(r => r.hour === 0);
    const startEntry = log.find(e => e.frequency === hour0.frequency && e.voltage === hour0.voltage);
    if (!startEntry) {
        console.log("Could not locate the start of the grid_feeder run in the scanned window -- widen windowStart.");
        return;
    }
    const startIndex = startEntry.index;
    console.log(`Located grid_feeder run starting at historicalConditions index ${startIndex}\n`);

    console.log("hour  frequency  voltage   feeder-reported  on-chain-log   match?");
    console.log("-".repeat(75));
    let mismatches = 0;
    for (const r of readings) {
        const entry = log.find(e => e.index === startIndex + r.hour);
        if (!entry) {
            console.log(`${String(r.hour).padStart(4)}  index ${startIndex + r.hour} not in scanned window -- widen windowStart`);
            continue;
        }
        const inputsMatch = entry.frequency === r.frequency && entry.voltage === r.voltage;
        const agree = inputsMatch && Math.abs(entry.score - r.score) < 1e-6;
        if (!agree) mismatches++;
        const flag = !inputsMatch ? '*** INDEX OFFSET WRONG ***' : (agree ? 'OK' : '*** MISMATCH ***');
        console.log(`${String(r.hour).padStart(4)}  ${r.frequency}      ${r.voltage}   ${r.score.toFixed(4)}          ${entry.score.toFixed(4)}         ${flag}`);
    }

    console.log("-".repeat(75));
    console.log(mismatches === 0
        ? "All feeder-reported scores match the permanent on-chain log. No corrections needed."
        : `${mismatches} mismatch(es) found -- use the on-chain-log column as the corrected, authoritative value.`);
}

main().catch(console.error);
