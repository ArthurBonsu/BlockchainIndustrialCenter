// onchain_validation.js
// -----------------------------------------------------------------------------
// REAL Sepolia validation script for the FIXED contract deployment.
// This performs genuine on-chain transactions (not a simulation) and writes
// every result -- including failures -- to a JSON file that
// generate_figures.py can turn directly into IEEE-style figures/tables.
//
// It replaces ieeevalidationfinal.js, which only tested the Oracle because
// the old Vault/TimeWeightedAMM/GridResponsiveAMM were broken (see
// DEPLOYMENT_GUIDE.md). With the Vault's approveSpender()/authorizedCallers
// fix and GridResponsiveAMM's updateReserves() fix in place, this script
// exercises all four contracts end-to-end: setup, Oracle, TimeWeightedAMM
// swaps, and GridResponsiveAMM swaps under both normal and stressed grid
// conditions.
//
// IMPORTANT: the account used MUST be the owner/deployer of all four
// contracts (Vault, Oracle, TimeWeightedAMM, GridResponsiveAMM) -- it needs
// onlyOwner rights on the Vault and AMMs, and ORACLE_ROLE on the Oracle
// (auto-granted to whoever deployed it).
//
// Usage:
//   1. cp .env.example .env   and fill in INFURA_PROJECT_ID + PRIVATE_KEY
//   2. Update CONTRACT_ADDRESSES below with your NEW deployment addresses
//      (see energytokenvaultaddress.txt)
//   3. npm install web3 dotenv
//   4. node onchain_validation.js
//
// Output: onchain_validation_results.json (written incrementally, so a
// crash partway through still leaves everything completed so far on disk).
// -----------------------------------------------------------------------------

require('dotenv').config();
const { Web3 } = require('web3');
const fs = require('fs');

// ============================================================================
// 1. CONFIGURATION -- fill these in
// ============================================================================

// NEW (fixed, redeployed) contract addresses -- copy from
// energytokenvaultaddress.txt once you've deployed the fixed contracts per
// DEPLOYMENT_GUIDE.md. Placeholders below are the OLD/broken addresses --
// replace them before running.
const CONTRACT_ADDRESSES = {
    EnergyTokenRE: "0xa78fc8e55a017cb5659476f6d67fe77c22b4c59a",   // unchanged, reused
    EnergyTokenNRE: "0x8b8d7b0d8f38488f56454337205e269c20892e6c",  // unchanged, reused
    // From energytokenvaultaddress.txt. Lowercased on purpose: web3.js
    // enforces EIP-55 checksum casing on mixed-case addresses, and I can't
    // independently verify the checksum of addresses supplied as text --
    // all-lowercase skips that check entirely and is functionally identical
    // on-chain (checksums are a client-side typo guard, not part of consensus).
    EnergyTokenVault: "0x623ba68eb8c93d6204f449d1a2596078d094b13f",
    GridStabilityOracle: "0x9580429807f611a286255ff325e7c6812343d340",
    TimeWeightedAMM: "0xd85499cb852d582a26570f1c2b391c513ace78a2",
    GridResponsiveAMM: "0x99edf88047f58196d73528eb1e76abe7ed7f0b2e",
};

// How much liquidity to seed if the Vault has none yet (18-decimal token units)
const SEED_LIQUIDITY_RE = "1000000000000000000000";   // 1000 RE
const SEED_LIQUIDITY_NRE = "1000000000000000000000";  // 1000 NRE

// Size of each test swap (small relative to liquidity, to keep price impact realistic)
const SWAP_AMOUNT = "5000000000000000000"; // 5 tokens

// Optional: ETH/USD price for cost-in-USD reporting. This is a static
// approximation you should update -- it is NOT fetched live.
const ETH_USD_PRICE = 3200;

const OUTPUT_FILE = "onchain_validation_results.json";

// ============================================================================
// 2. MINIMAL ABIs -- derived directly from the fixed .sol sources, only the
//    functions this script actually calls.
// ============================================================================

const ERC20_ABI = [
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
];

const VAULT_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "amountRE", "type": "uint256" }, { "internalType": "uint256", "name": "amountNRE", "type": "uint256" }], "name": "addLiquidity", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "caller", "type": "address" }, { "internalType": "bool", "name": "status", "type": "bool" }], "name": "setAuthorizedCaller", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amountRE", "type": "uint256" }, { "internalType": "uint256", "name": "amountNRE", "type": "uint256" }], "name": "approveSpender", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "getReserves", "outputs": [{ "internalType": "uint256", "name": "_reserveRE", "type": "uint256" }, { "internalType": "uint256", "name": "_reserveNRE", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "getPrices", "outputs": [{ "internalType": "uint256", "name": "priceRE", "type": "uint256" }, { "internalType": "uint256", "name": "priceNRE", "type": "uint256" }], "stateMutability": "view", "type": "function" },
];

const ORACLE_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "frequency", "type": "uint256" }, { "internalType": "uint256", "name": "voltage", "type": "uint256" }], "name": "updateCondition", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "getStabilityScore", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "isGridStressed", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "NOMINAL_FREQUENCY", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "NOMINAL_VOLTAGE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "G_THRESHOLD", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
];

const TWAMM_ABI = [
    { "inputs": [], "name": "tauPeak", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "tauNormal", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "tauOffPeak", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "getCurrentPeriod", "outputs": [{ "internalType": "string", "name": "period", "type": "string" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "getCurrentTimeWeight", "outputs": [{ "internalType": "uint256", "name": "tau", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "getTimeWeightedPrices", "outputs": [{ "internalType": "uint256", "name": "priceRE", "type": "uint256" }, { "internalType": "uint256", "name": "priceNRE", "type": "uint256" }, { "internalType": "uint256", "name": "tau", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "minAmountOut", "type": "uint256" }, { "internalType": "bool", "name": "isREtoNRE", "type": "bool" }], "name": "swap", "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "getStatistics", "outputs": [{ "internalType": "uint256", "name": "_totalSwapsRE", "type": "uint256" }, { "internalType": "uint256", "name": "_totalSwapsNRE", "type": "uint256" }, { "internalType": "uint256", "name": "_totalVolumeRE", "type": "uint256" }, { "internalType": "uint256", "name": "_totalVolumeNRE", "type": "uint256" }], "stateMutability": "view", "type": "function" },
];

const GRAMM_ABI = [
    { "inputs": [{ "internalType": "bool", "name": "isREtoNRE", "type": "bool" }], "name": "getAmountOut", "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "effectiveFee", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "minAmountOut", "type": "uint256" }, { "internalType": "bool", "name": "isREtoNRE", "type": "bool" }], "name": "swap", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "getStatistics", "outputs": [{ "internalType": "uint256", "name": "_totalSwapsRE", "type": "uint256" }, { "internalType": "uint256", "name": "_totalSwapsNRE", "type": "uint256" }, { "internalType": "uint256", "name": "_swapsDuringStress", "type": "uint256" }, { "internalType": "uint256", "name": "_accumulatedFees", "type": "uint256" }, { "internalType": "uint256", "name": "_totalGST", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "isGridStressed", "outputs": [{ "internalType": "bool", "name": "isStressed", "type": "bool" }, { "internalType": "uint256", "name": "gridScore", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "getUserGST", "outputs": [{ "internalType": "uint256", "name": "gstBalance", "type": "uint256" }, { "internalType": "uint256", "name": "energyDeferred", "type": "uint256" }], "stateMutability": "view", "type": "function" },
];

// ============================================================================
// 3. RESULTS OBJECT -- written to disk after every phase
// ============================================================================

const results = {
    metadata: {
        startedAt: new Date().toISOString(),
        network: "Sepolia",
        contracts: CONTRACT_ADDRESSES,
        note: "Genuine on-chain execution against the fixed/redeployed contracts. Every entry below reflects a real transaction or a real read; failures are recorded, not hidden.",
    },
    setup: {},
    oracle: {},
    timeWeightedAMM: { swaps: [] },
    gridResponsiveAMM: { swapsNormal: [], swapsStressed: [] },
    summary: {},
};

function save() {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
}

async function record(section, label, fn) {
    const t0 = Date.now();
    try {
        const receiptOrValue = await fn();
        const entry = { label, success: true, elapsedMs: Date.now() - t0 };
        if (receiptOrValue && receiptOrValue.transactionHash) {
            entry.txHash = receiptOrValue.transactionHash;
            entry.blockNumber = Number(receiptOrValue.blockNumber);
            entry.gasUsed = Number(receiptOrValue.gasUsed);
        } else {
            entry.value = receiptOrValue;
        }
        section[label] = entry;
        console.log(`  \u2713 ${label}`);
        return entry;
    } catch (err) {
        const entry = { label, success: false, error: err.message, elapsedMs: Date.now() - t0 };
        section[label] = entry;
        console.log(`  \u2717 ${label}: ${err.message}`);
        return entry;
    } finally {
        save();
    }
}

// ============================================================================
// 4. MAIN
// ============================================================================

async function main() {
    console.log("=".repeat(78));
    console.log("ON-CHAIN VALIDATION -- Fixed Contract Deployment");
    console.log("=".repeat(78));

    if (Object.values(CONTRACT_ADDRESSES).some(a => a.startsWith("PASTE_"))) {
        console.error("\nERROR: replace the PASTE_..._HERE placeholders in CONTRACT_ADDRESSES with your real new addresses before running.\n");
        process.exit(1);
    }

    const providerUrl = `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
    const web3 = new Web3(providerUrl);
    web3.defaultReturnFormat = { number: 'str', bytes: 'HEX' };

    let privateKey = (process.env.PRIVATE_KEY || process.env.ETHEREUM_PRIVATE_KEY || "").trim();
    if (!privateKey) { console.error("Set PRIVATE_KEY in .env"); process.exit(1); }
    if (privateKey.length === 64) privateKey = '0x' + privateKey;
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);
    web3.eth.defaultAccount = account.address;
    results.metadata.account = account.address;

    console.log(`Account: ${account.address}`);

    const tokenRE = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.EnergyTokenRE);
    const tokenNRE = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.EnergyTokenNRE);
    const vault = new web3.eth.Contract(VAULT_ABI, CONTRACT_ADDRESSES.EnergyTokenVault);
    const oracle = new web3.eth.Contract(ORACLE_ABI, CONTRACT_ADDRESSES.GridStabilityOracle);
    const twamm = new web3.eth.Contract(TWAMM_ABI, CONTRACT_ADDRESSES.TimeWeightedAMM);
    const gramm = new web3.eth.Contract(GRAMM_ABI, CONTRACT_ADDRESSES.GridResponsiveAMM);

    const from = account.address;
    const sendOpts = async (method) => {
        const gas = await method.estimateGas({ from }).catch(() => 500000n);
        return { from, gas };
    };

    // ------------------------------------------------------------------
    // PHASE 1: Vault/AMM authorization + allowances (owner-only setup)
    // ------------------------------------------------------------------
    console.log("\n[1/5] Vault + AMM authorization");

    await record(results.setup, "setAuthorizedCaller_TWAMM", async () => {
        const m = vault.methods.setAuthorizedCaller(CONTRACT_ADDRESSES.TimeWeightedAMM, true);
        return m.send(await sendOpts(m));
    });
    await record(results.setup, "setAuthorizedCaller_GRAMM", async () => {
        const m = vault.methods.setAuthorizedCaller(CONTRACT_ADDRESSES.GridResponsiveAMM, true);
        return m.send(await sendOpts(m));
    });

    const MAX_UINT = (2n ** 256n - 1n).toString();
    await record(results.setup, "vault_approveSpender_TWAMM", async () => {
        const m = vault.methods.approveSpender(CONTRACT_ADDRESSES.TimeWeightedAMM, MAX_UINT, MAX_UINT);
        return m.send(await sendOpts(m));
    });
    await record(results.setup, "vault_approveSpender_GRAMM", async () => {
        const m = vault.methods.approveSpender(CONTRACT_ADDRESSES.GridResponsiveAMM, MAX_UINT, MAX_UINT);
        return m.send(await sendOpts(m));
    });

    // Owner must also approve the Vault to pull tokens out of the owner's
    // OWN wallet for addLiquidity, and approve each AMM to pull tokens out
    // of the owner's wallet for the test swaps below (separate from the
    // Vault-to-AMM allowance set up above).
    for (const [label, spender] of [
        ["ownerApprove_Vault_RE", CONTRACT_ADDRESSES.EnergyTokenVault],
        ["ownerApprove_TWAMM_RE", CONTRACT_ADDRESSES.TimeWeightedAMM],
        ["ownerApprove_GRAMM_RE", CONTRACT_ADDRESSES.GridResponsiveAMM],
    ]) {
        await record(results.setup, label, async () => {
            const m = tokenRE.methods.approve(spender, MAX_UINT);
            return m.send(await sendOpts(m));
        });
    }
    for (const [label, spender] of [
        ["ownerApprove_Vault_NRE", CONTRACT_ADDRESSES.EnergyTokenVault],
        ["ownerApprove_TWAMM_NRE", CONTRACT_ADDRESSES.TimeWeightedAMM],
        ["ownerApprove_GRAMM_NRE", CONTRACT_ADDRESSES.GridResponsiveAMM],
    ]) {
        await record(results.setup, label, async () => {
            const m = tokenNRE.methods.approve(spender, MAX_UINT);
            return m.send(await sendOpts(m));
        });
    }

    // Seed liquidity only if the vault is currently empty
    // NOTE: web3.js 4.x with a custom defaultReturnFormat returns
    // multi-output calls as a named object, not a plain array -- so we
    // access by the ABI's output names rather than array-destructuring.
    const reservesResult = await vault.methods.getReserves().call();
    const reserveRE = reservesResult._reserveRE ?? reservesResult[0];
    const reserveNRE = reservesResult._reserveNRE ?? reservesResult[1];
    if (BigInt(reserveRE) === 0n || BigInt(reserveNRE) === 0n) {
        await record(results.setup, "addLiquidity", async () => {
            const m = vault.methods.addLiquidity(SEED_LIQUIDITY_RE, SEED_LIQUIDITY_NRE);
            return m.send(await sendOpts(m));
        });
    } else {
        results.setup.addLiquidity = { label: "addLiquidity", skipped: true, reason: "vault already has reserves", reserveRE, reserveNRE };
        save();
    }

    // ------------------------------------------------------------------
    // PHASE 2: Grid Stability Oracle
    // ------------------------------------------------------------------
    console.log("\n[2/5] Grid Stability Oracle");

    await record(results.oracle, "readConstants", async () => ({
        nominalFrequency: await oracle.methods.NOMINAL_FREQUENCY().call(),
        nominalVoltage: await oracle.methods.NOMINAL_VOLTAGE().call(),
        gThreshold: await oracle.methods.G_THRESHOLD().call(),
    }));

    const normalUpdate = await record(results.oracle, "updateCondition_normal", async () => {
        const m = oracle.methods.updateCondition(60000, 120000);
        return m.send(await sendOpts(m));
    });
    // NOTE: pinned to the exact block the transaction confirmed in, rather
    // than "latest" -- a .call() immediately after .send() resolves can hit
    // a load-balanced RPC node that hasn't caught up yet even though the tx
    // is already mined. Pinning removes the ambiguity entirely, for free.
    await record(results.oracle, "readScore_normal", async () => ({
        score: await oracle.methods.getStabilityScore().call({}, normalUpdate.blockNumber),
        isStressed: await oracle.methods.isGridStressed().call({}, normalUpdate.blockNumber),
    }));

    // Matches the exact worked example in DEPLOYMENT_GUIDE.md: 59Hz at
    // nominal voltage should give G ~= 0.70 and isGridStressed() = true.
    const stressUpdate = await record(results.oracle, "updateCondition_stress", async () => {
        const m = oracle.methods.updateCondition(59000, 120000);
        return m.send(await sendOpts(m));
    });
    await record(results.oracle, "readScore_stress", async () => ({
        score: await oracle.methods.getStabilityScore().call({}, stressUpdate.blockNumber),
        isStressed: await oracle.methods.isGridStressed().call({}, stressUpdate.blockNumber),
    }));

    // ------------------------------------------------------------------
    // PHASE 3: TimeWeightedAMM -- real swaps
    // ------------------------------------------------------------------
    console.log("\n[3/5] TimeWeightedAMM swaps");

    await record(results.timeWeightedAMM, "configuredValues", async () => ({
        tauPeak: await twamm.methods.tauPeak().call(),
        tauNormal: await twamm.methods.tauNormal().call(),
        tauOffPeak: await twamm.methods.tauOffPeak().call(),
        currentPeriod: await twamm.methods.getCurrentPeriod().call(),
        currentTau: await twamm.methods.getCurrentTimeWeight().call(),
    }));

    for (let i = 0; i < 4; i++) {
        const isREtoNRE = i % 2 === 0;
        const label = `swap_${i}_${isREtoNRE ? "RE_to_NRE" : "NRE_to_RE"}`;
        const gasPriceBefore = await web3.eth.getGasPrice();
        const entry = await record(results.timeWeightedAMM, label, async () => {
            const m = twamm.methods.swap(SWAP_AMOUNT, "0", isREtoNRE);
            return m.send(await sendOpts(m));
        });
        if (entry.success) {
            entry.amountIn = SWAP_AMOUNT;
            entry.gasPriceGwei = Number(web3.utils.fromWei(gasPriceBefore, "gwei"));
            entry.txCostETH = (entry.gasUsed * Number(gasPriceBefore)) / 1e18;
            entry.txCostUSD = entry.txCostETH * ETH_USD_PRICE;
            save();
        }
    }

    await record(results.timeWeightedAMM, "finalStatistics", async () => {
        const r = await twamm.methods.getStatistics().call();
        return {
            totalSwapsRE: r._totalSwapsRE ?? r[0],
            totalSwapsNRE: r._totalSwapsNRE ?? r[1],
            totalVolumeRE: r._totalVolumeRE ?? r[2],
            totalVolumeNRE: r._totalVolumeNRE ?? r[3],
        };
    });

    // ------------------------------------------------------------------
    // PHASE 4: GridResponsiveAMM -- swaps under normal AND stressed conditions
    // ------------------------------------------------------------------
    console.log("\n[4/5] GridResponsiveAMM swaps (normal vs. stressed)");

    // Force normal condition, then swap
    await record(results.gridResponsiveAMM, "setNormal", async () => {
        const m = oracle.methods.updateCondition(60000, 120000);
        return m.send(await sendOpts(m));
    });
    for (let i = 0; i < 2; i++) {
        const isREtoNRE = i % 2 === 0;
        const label = `normal_swap_${i}_${isREtoNRE ? "RE_to_NRE" : "NRE_to_RE"}`;
        const gasPriceBefore = await web3.eth.getGasPrice();
        const entry = await record({ swaps: results.gridResponsiveAMM.swapsNormal }, label, async () => {
            const m = gramm.methods.swap(SWAP_AMOUNT, "0", isREtoNRE);
            return m.send(await sendOpts(m));
        });
        results.gridResponsiveAMM.swapsNormal.push(entry);
        if (entry.success) {
            entry.gasPriceGwei = Number(web3.utils.fromWei(gasPriceBefore, "gwei"));
            entry.txCostETH = (entry.gasUsed * Number(gasPriceBefore)) / 1e18;
            entry.txCostUSD = entry.txCostETH * ETH_USD_PRICE;
        }
        save();
    }

    // Force stressed condition, then swap
    await record(results.gridResponsiveAMM, "setStressed", async () => {
        const m = oracle.methods.updateCondition(59000, 120000);
        return m.send(await sendOpts(m));
    });
    for (let i = 0; i < 2; i++) {
        const isREtoNRE = i % 2 === 0;
        const label = `stressed_swap_${i}_${isREtoNRE ? "RE_to_NRE" : "NRE_to_RE"}`;
        const gasPriceBefore = await web3.eth.getGasPrice();
        const entry = await record({ swaps: results.gridResponsiveAMM.swapsStressed }, label, async () => {
            const m = gramm.methods.swap(SWAP_AMOUNT, "0", isREtoNRE);
            return m.send(await sendOpts(m));
        });
        results.gridResponsiveAMM.swapsStressed.push(entry);
        if (entry.success) {
            entry.gasPriceGwei = Number(web3.utils.fromWei(gasPriceBefore, "gwei"));
            entry.txCostETH = (entry.gasUsed * Number(gasPriceBefore)) / 1e18;
            entry.txCostUSD = entry.txCostETH * ETH_USD_PRICE;
        }
        save();
    }

    await record(results.gridResponsiveAMM, "finalStatistics", async () => {
        const r = await gramm.methods.getStatistics().call();
        return {
            totalSwapsRE: r._totalSwapsRE ?? r[0],
            totalSwapsNRE: r._totalSwapsNRE ?? r[1],
            swapsDuringStress: r._swapsDuringStress ?? r[2],
            accumulatedFees: r._accumulatedFees ?? r[3],
            totalGST: r._totalGST ?? r[4],
        };
    });
    await record(results.gridResponsiveAMM, "userGST", async () => {
        const r = await gramm.methods.getUserGST(from).call();
        return {
            gstBalance: r.gstBalance ?? r[0],
            energyDeferred: r.energyDeferred ?? r[1],
        };
    });

    // ------------------------------------------------------------------
    // PHASE 5: Summary
    // ------------------------------------------------------------------
    console.log("\n[5/5] Summarizing");

    const allEntries = [
        ...Object.values(results.setup),
        ...Object.values(results.oracle),
        ...Object.values(results.timeWeightedAMM).filter(v => v && typeof v === 'object' && 'label' in v),
        ...results.gridResponsiveAMM.swapsNormal,
        ...results.gridResponsiveAMM.swapsStressed,
        results.gridResponsiveAMM.setNormal,
        results.gridResponsiveAMM.setStressed,
    ].filter(Boolean);

    const txEntries = allEntries.filter(e => e.txHash);
    results.summary = {
        totalOperations: allEntries.length,
        totalRealTransactions: txEntries.length,
        successCount: allEntries.filter(e => e.success).length,
        failureCount: allEntries.filter(e => e.success === false).length,
        successRatePct: Number((100 * allEntries.filter(e => e.success).length / allEntries.length).toFixed(1)),
        totalGasUsed: txEntries.reduce((s, e) => s + (e.gasUsed || 0), 0),
        avgGasUsed: txEntries.length ? Math.round(txEntries.reduce((s, e) => s + (e.gasUsed || 0), 0) / txEntries.length) : 0,
        finishedAt: new Date().toISOString(),
    };
    save();

    console.log("\n" + "=".repeat(78));
    console.log(`Done. ${results.summary.successCount}/${results.summary.totalOperations} operations succeeded.`);
    console.log(`Results written to ${OUTPUT_FILE}`);
    console.log("=".repeat(78));
}

main().catch(err => {
    console.error("Fatal error:", err);
    save();
    process.exit(1);
});
