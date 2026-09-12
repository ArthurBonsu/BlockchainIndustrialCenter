// verify_oracle_reads.js
// -----------------------------------------------------------------------------
// Zero-gas sanity check: re-reads the Oracle's state at the EXACT historical
// blocks where updateCondition() was already called (from
// onchain_validation_results.json), instead of "latest". This resolves an
// apparent RPC read-after-write lag where a .call() made immediately after
// updateCondition_stress's transaction confirmed returned a stale value.
//
// Read-only -- no private key needed, no gas spent, safe to run any time.
//
// Usage:
//   1. npm install web3 dotenv   (if not already installed)
//   2. Make sure .env has INFURA_PROJECT_ID
//   3. node verify_oracle_reads.js
// -----------------------------------------------------------------------------

require('dotenv').config();
const { Web3 } = require('web3');

const ORACLE_ADDRESS = "0x9580429807f611a286255ff325e7c6812343d340";

// From onchain_validation_results.json
const BLOCKS = {
    normal: 11691112,   // updateCondition(60000, 120000) confirmed here
    stress: 11691113,   // updateCondition(59000, 120000) confirmed here
};

const ORACLE_ABI = [
    { "inputs": [], "name": "getStabilityScore", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "isGridStressed", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
];

async function main() {
    const web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
    const oracle = new web3.eth.Contract(ORACLE_ABI, ORACLE_ADDRESS);

    for (const [label, blockNumber] of Object.entries(BLOCKS)) {
        const score = await oracle.methods.getStabilityScore().call({}, blockNumber);
        const isStressed = await oracle.methods.isGridStressed().call({}, blockNumber);
        console.log(`${label} (block ${blockNumber}): score = ${Number(score) / 1e18}, isStressed = ${isStressed}`);
    }
}

main().catch(console.error);
