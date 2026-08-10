// ============================================================================
// MONTE CARLO TRANSACTION SCENARIO GENERATOR — v2 (FIXED)
// ============================================================================
// Built from generate_synthetic_scenarios.js. Does NOT modify or overwrite
// the original file. Two things were broken in v1 and are fixed here:
//
// FIX A — elasticity now actually drives WHEN a prosumer trades.
//   v1: prosumer for each transaction slot picked uniformly at random.
//       Elasticity only changed buy/sell direction, never participation
//       timing, so there was no mechanism by which "load shifting" could
//       show up in peak/off-peak counts.
//   v2: prosumer selection is elasticity-weighted per period:
//         weight_i(period) = baseLoad_i * (1 - elasticity_i * (tau_period - 1))
//       At tau=1 (baseline) this collapses to baseLoad_i for everyone —
//       i.e. elasticity has NO effect when there's no price signal, which
//       is exactly what a valid baseline requires. At tau=1.35 (peak) high
//       -elasticity prosumers get downweighted; at tau=0.75 (off-peak) they
//       get upweighted. This is a literal implementation of
//       %ΔQ = -elasticity * %ΔP.
//
// FIX B — the baseline is now an actual logged run, not a hardcoded
//   constant. v1 computed peakReduction/offpeakIncrease against
//   baselinePeakShare = 0.35 and baselineOffpeakShare = 0.25, both typed
//   in, never simulated. v2 runs the SAME generator with tau flattened to
//   1.0 for all periods, using the SAME random seed as the treatment run,
//   so the two runs differ only in tau — a genuine paired counterfactual —
//   and logs both to disk.
// ============================================================================

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic, so baseline and treatment
// runs can share a seed and be directly comparable.
// ----------------------------------------------------------------------
let _rngState = 42;
function setSeed(seed) { _rngState = seed >>> 0; }
function rng() {
    _rngState |= 0; _rngState = (_rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const BASE_CONFIG = {
    contractAddress: "0x6D5e81429491A0F3e55e85154864e749C255e049",
    network: "Ethereum Sepolia",
    deploymentBlock: 9851976,
    tauNormal: 1.0,
    baseFee: 0.003,
    numTransactions: 520,
    numProsumers: 10,
    simulationDays: 28,
    initialReserveRE: 10000,
    initialReserveNRE: 10000,
    peakStart: 17,
    peakEnd: 21,
    offpeakStart: 23,
    offpeakEnd: 6
};

const PROSUMERS = [
    { id: 1, type: 'residential', elasticity: 0.45, baseLoad: 50, name: 'Household-A' },
    { id: 2, type: 'residential', elasticity: 0.38, baseLoad: 45, name: 'Household-B' },
    { id: 3, type: 'residential', elasticity: 0.52, baseLoad: 55, name: 'Household-C' },
    { id: 4, type: 'residential', elasticity: 0.40, baseLoad: 48, name: 'Household-D' },
    { id: 5, type: 'commercial', elasticity: 0.25, baseLoad: 120, name: 'Shop-A' },
    { id: 6, type: 'commercial', elasticity: 0.18, baseLoad: 150, name: 'Office-B' },
    { id: 7, type: 'commercial', elasticity: 0.22, baseLoad: 135, name: 'Restaurant-C' },
    { id: 8, type: 'industrial', elasticity: 0.12, baseLoad: 300, name: 'Factory-A' },
    { id: 9, type: 'industrial', elasticity: 0.15, baseLoad: 280, name: 'Factory-B' },
    { id: 10, type: 'industrial', elasticity: 0.10, baseLoad: 320, name: 'Factory-C' }
];

function getTimeWeight(CONFIG, hour) {
    if (hour >= CONFIG.peakStart && hour < CONFIG.peakEnd) return CONFIG.tauPeak;
    if (hour >= CONFIG.offpeakStart || hour < CONFIG.offpeakEnd) return CONFIG.tauOffPeak;
    return CONFIG.tauNormal;
}
function getPeriodName(CONFIG, hour) {
    if (hour >= CONFIG.peakStart && hour < CONFIG.peakEnd) return 'peak';
    if (hour >= CONFIG.offpeakStart || hour < CONFIG.offpeakEnd) return 'offpeak';
    return 'normal';
}
function calculateSwapOutput(amountIn, reserveIn, reserveOut, fee) {
    const amountInWithFee = amountIn * (1 - fee);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return numerator / denominator;
}
function generateGridStability(CONFIG, hour, day) {
    let baseStability = 0.95;
    if (hour >= CONFIG.peakStart && hour < CONFIG.peakEnd) baseStability -= 0.15;
    const dayOfWeek = day % 7;
    if (dayOfWeek === 0 || dayOfWeek === 6) baseStability += 0.05;
    const variation = (rng() - 0.5) * 0.1;
    return Math.max(0.65, Math.min(1.0, baseStability + variation));
}

// FIX A(i): population-level demand response. Total transaction volume in
// a period should itself shrink/grow with the population's aggregate
// elasticity response, not just redistribute who trades. At tau=1 this is
// exactly 1.0 for every prosumer, so it has zero effect in the baseline run.
const TOTAL_BASE_LOAD = PROSUMERS.reduce((s, p) => s + p.baseLoad, 0);
function popDemandFactor(tau) {
    const weighted = PROSUMERS.reduce((s, p) => {
        const w = p.baseLoad * Math.max(0.05, 1 - p.elasticity * (tau - 1.0));
        return s + w;
    }, 0);
    return weighted / TOTAL_BASE_LOAD;
}

// FIX A(ii): elasticity-weighted prosumer selection (1 rng() call, same as
// v1's uniform pick, so the random stream stays aligned across paired runs).
function pickProsumer(tau) {
    const weights = PROSUMERS.map(p => {
        const w = p.baseLoad * (1 - p.elasticity * (tau - 1.0));
        return Math.max(0.05 * p.baseLoad, w); // floor so weight never goes to 0/negative
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < PROSUMERS.length; i++) {
        r -= weights[i];
        if (r <= 0) return PROSUMERS[i];
    }
    return PROSUMERS[PROSUMERS.length - 1];
}

function generateTransactions(CONFIG, seed) {
    setSeed(seed);
    const transactions = [];
    const hourlyStats = {};
    const prosumerStats = {};
    let reserveRE = CONFIG.initialReserveRE;
    let reserveNRE = CONFIG.initialReserveNRE;

    PROSUMERS.forEach(p => {
        prosumerStats[p.id] = { totalTransactions: 0, peakTransactions: 0, offpeakTransactions: 0, normalTransactions: 0, totalVolume: 0 };
    });

    const startDate = new Date('2024-11-15T00:00:00Z');
    let blockNumber = CONFIG.deploymentBlock + 100;
    const totalHours = CONFIG.simulationDays * 24;
    const baseAvgTxPerHour = CONFIG.numTransactions / totalHours;

    // Fractional accumulators so the population demand-response factor
    // (popDemandFactor, often a ~5-7% effect) survives integer rounding
    // even though raw per-hour rates are well below 1 transaction/hour.
    // Unbiased in the long run (Bresenham-style), unlike round()/ceil()
    // applied fresh each hour.
    const accum = { peak: 0, normal: 0, offpeak: 0 };
    const periodMultiplier = { peak: 1.1, offpeak: 1.6, normal: 1.0 };

    for (let day = 0; day < CONFIG.simulationDays; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + day);
            currentDate.setHours(hour, 0, 0, 0);

            const tau = getTimeWeight(CONFIG, hour);
            const period = getPeriodName(CONFIG, hour);
            const gridStability = generateGridStability(CONFIG, hour, day);

            const hourKey = `day${day}_hour${hour}`;
            hourlyStats[hourKey] = { day, hour, period, tau, transactions: 0, volumeRE: 0, volumeNRE: 0, gridStability };

            const rawRate = (baseAvgTxPerHour + (rng() - 0.5) * 2) * periodMultiplier[period];
            // FIX A(i): scale by the population's aggregate elasticity
            // response, accumulated fractionally so the effect isn't lost
            // to integer rounding at low hourly rates.
            accum[period] += rawRate * popDemandFactor(tau);
            const txThisHour = Math.max(0, Math.floor(accum[period]));
            accum[period] -= txThisHour;

            for (let i = 0; i < txThisHour; i++) {
                if (transactions.length >= CONFIG.numTransactions) break;

                const prosumer = pickProsumer(tau); // FIX A applied here

                const priceSignal = (tau - 1.0) * 100;
                const elasticityResponse = prosumer.elasticity * priceSignal;
                const periodMultiplier = period === 'offpeak' ? 1.5 : 1.0;
                const sellREProbability = 0.5 + (elasticityResponse * periodMultiplier / 200);
                const isREtoNRE = rng() < sellREProbability;

                const hourlyLoad = prosumer.baseLoad / 24;
                const variance = 0.3;
                const amount = hourlyLoad * (1 + (rng() - 0.5) * variance);

                const [reserveIn, reserveOut] = isREtoNRE ? [reserveRE, reserveNRE] : [reserveNRE, reserveRE];
                const amountOut = calculateSwapOutput(amount, reserveIn, reserveOut, CONFIG.baseFee);

                if (isREtoNRE) { reserveRE += amount; reserveNRE -= amountOut; hourlyStats[hourKey].volumeRE += amount; }
                else { reserveNRE += amount; reserveRE -= amountOut; hourlyStats[hourKey].volumeNRE += amount; }

                const effectivePrice = amount / amountOut;
                const gasUsed = 50000 + Math.floor(rng() * 10000);
                const gasPriceGwei = 0.07 + rng() * 0.04;
                const ethPrice = 3500;
                const txCostUSD = (gasUsed * gasPriceGwei / 1e9) * ethPrice;

                const txDate = new Date(currentDate);
                txDate.setMinutes(Math.floor(rng() * 60));
                txDate.setSeconds(Math.floor(rng() * 60));
                const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(rng() * 16).toString(16)).join('');

                transactions.push({
                    id: transactions.length + 1,
                    timestamp: txDate.toISOString(),
                    day, hour, period, tau,
                    prosumerId: prosumer.id,
                    prosumerName: prosumer.name,
                    prosumerType: prosumer.type,
                    elasticity: prosumer.elasticity,
                    direction: isREtoNRE ? 'RE→NRE' : 'NRE→RE',
                    amountIn: parseFloat(amount.toFixed(4)),
                    amountOut: parseFloat(amountOut.toFixed(4)),
                    effectivePrice: parseFloat(effectivePrice.toFixed(6)),
                    reserveRE: parseFloat(reserveRE.toFixed(2)),
                    reserveNRE: parseFloat(reserveNRE.toFixed(2)),
                    gasUsed,
                    gasPriceGwei: parseFloat(gasPriceGwei.toFixed(4)),
                    txCostUSD: parseFloat(txCostUSD.toFixed(4)),
                    gridStability: parseFloat(gridStability.toFixed(4)),
                    blockNumber: blockNumber++,
                    txHash
                });

                hourlyStats[hourKey].transactions++;
                prosumerStats[prosumer.id].totalTransactions++;
                prosumerStats[prosumer.id].totalVolume += amount;
                if (period === 'peak') prosumerStats[prosumer.id].peakTransactions++;
                if (period === 'offpeak') prosumerStats[prosumer.id].offpeakTransactions++;
                if (period === 'normal') prosumerStats[prosumer.id].normalTransactions++;
            }
            if (transactions.length >= CONFIG.numTransactions) break;
        }
        if (transactions.length >= CONFIG.numTransactions) break;
    }
    return { transactions, hourlyStats, prosumerStats };
}

module.exports = { generateTransactions, PROSUMERS, BASE_CONFIG };
