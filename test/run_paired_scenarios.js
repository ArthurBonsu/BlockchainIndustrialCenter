const fs = require('fs');
const path = require('path');
const { generateTransactions, PROSUMERS, BASE_CONFIG } = require('./generate_scenarios_v2.js');

const HEADLINE_SEED = 20260810; // one illustrative paired run, for a concrete example
const N_SEEDS = 150;             // repeated paired runs, averaged, for stable estimates

const treatmentConfig = { ...BASE_CONFIG, tauPeak: 1.35, tauOffPeak: 0.75 };
const baselineConfig  = { ...BASE_CONFIG, tauPeak: 1.0,  tauOffPeak: 1.0  };

// Headline single paired run (kept for an illustrative, inspectable dataset)
const treatment = generateTransactions(treatmentConfig, HEADLINE_SEED);
const baseline  = generateTransactions(baselineConfig, HEADLINE_SEED);

// Averaged over many paired seeds — each seed shared between baseline and
// treatment so the comparison is always apples-to-apples, then averaged
// across seeds to wash out single-draw Monte Carlo noise (520 tx over 10
// prosumers is not enough for stable per-prosumer estimates from one run).
const aggT = {}; // prosumerId -> {total, peak, offpeak, tauSum, volSum}
const aggB = {};
function addTo(agg, txs) {
    for (const t of txs) {
        if (!agg[t.prosumerId]) agg[t.prosumerId] = { total: 0, peak: 0, offpeak: 0, tauVolSum: 0, volSum: 0 };
        const a = agg[t.prosumerId];
        a.total++; a.volSum += t.amountIn; a.tauVolSum += t.tau * t.amountIn;
        if (t.period === 'peak') a.peak++;
        if (t.period === 'offpeak') a.offpeak++;
    }
}
let sysT = { total: 0, peak: 0, offpeak: 0 };
let sysB = { total: 0, peak: 0, offpeak: 0 };
for (let s = 0; s < N_SEEDS; s++) {
    const seed = 1000 + s;
    const tRun = generateTransactions(treatmentConfig, seed);
    const bRun = generateTransactions(baselineConfig, seed);
    addTo(aggT, tRun.transactions);
    addTo(aggB, bRun.transactions);
    sysT.total += tRun.transactions.length;
    sysT.peak += tRun.transactions.filter(t => t.period === 'peak').length;
    sysT.offpeak += tRun.transactions.filter(t => t.period === 'offpeak').length;
    sysB.total += bRun.transactions.length;
    sysB.peak += bRun.transactions.filter(t => t.period === 'peak').length;
    sysB.offpeak += bRun.transactions.filter(t => t.period === 'offpeak').length;
}
const avgPeakShareT = sysT.peak / sysT.total, avgPeakShareB = sysB.peak / sysB.total;
const avgOffShareT = sysT.offpeak / sysT.total, avgOffShareB = sysB.offpeak / sysB.total;
const avgPeakReduction = (avgPeakShareB - avgPeakShareT) / avgPeakShareB * 100;
const avgOffpeakIncrease = (avgOffShareT - avgOffShareB) / avgOffShareB * 100;

const perProsumerAveraged = PROSUMERS.map(p => {
    const t = aggT[p.id], b = aggB[p.id];
    const tPeakShare = t.peak / t.total, bPeakShare = b.peak / b.total;
    const tOffShare = t.offpeak / t.total, bOffShare = b.offpeak / b.total;
    const tTau = t.tauVolSum / t.volSum, bTau = b.tauVolSum / b.volSum;
    return {
        id: p.id, name: p.name, type: p.type, elasticity: p.elasticity,
        n_treatment: t.total, n_baseline: b.total,
        peakReduction_pct: +(((bPeakShare - tPeakShare) / bPeakShare) * 100).toFixed(1),
        offpeakIncrease_pct: +(((tOffShare - bOffShare) / bOffShare) * 100).toFixed(1),
        tauExposureChange_pct: +(((tTau - bTau) / bTau) * 100).toFixed(1)
    };
}).sort((a, b) => b.elasticity - a.elasticity);

const elasVals = PROSUMERS.map(p => p.elasticity);
const redVals = perProsumerAveraged.map(p => p.peakReduction_pct);
function corr(x, y) {
    const mx = x.reduce((a,b)=>a+b,0)/x.length, my = y.reduce((a,b)=>a+b,0)/y.length;
    const num = x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0);
    const den = Math.sqrt(x.reduce((s,xi)=>s+(xi-mx)**2,0) * y.reduce((s,yi)=>s+(yi-my)**2,0));
    return num/den;
}
const elasReductionCorr = corr(elasVals, redVals);

function summarize(run) {
    const byPeriod = { peak: [], normal: [], offpeak: [] };
    run.transactions.forEach(t => byPeriod[t.period].push(t));
    const total = run.transactions.length;
    const peakShare = byPeriod.peak.length / total;
    const offpeakShare = byPeriod.offpeak.length / total;
    const peakVolume = byPeriod.peak.reduce((s, t) => s + t.amountIn, 0);
    const offpeakVolume = byPeriod.offpeak.reduce((s, t) => s + t.amountIn, 0);
    const totalVolume = run.transactions.reduce((s, t) => s + t.amountIn, 0);
    return { total, peakShare, offpeakShare, peakVolumeShare: peakVolume / totalVolume, offpeakVolumeShare: offpeakVolume / totalVolume };
}

const tSum = summarize(treatment);
const bSum = summarize(baseline);

const systemPeakReduction = (bSum.peakShare - tSum.peakShare) / bSum.peakShare * 100;
const systemOffpeakIncrease = (tSum.offpeakShare - bSum.offpeakShare) / bSum.offpeakShare * 100;

// Per-prosumer table (real epsilon values, real logged baseline)
const perProsumer = PROSUMERS.map(p => {
    const tTx = treatment.transactions.filter(t => t.prosumerId === p.id);
    const bTx = baseline.transactions.filter(t => t.prosumerId === p.id);

    const tPeakShare = tTx.filter(t => t.period === 'peak').length / tTx.length;
    const bPeakShare = bTx.filter(t => t.period === 'peak').length / bTx.length;
    const tOffShare = tTx.filter(t => t.period === 'offpeak').length / tTx.length;
    const bOffShare = bTx.filter(t => t.period === 'offpeak').length / bTx.length;

    const peakReduction = (bPeakShare - tPeakShare) / bPeakShare * 100;
    const offpeakIncrease = (tOffShare - bOffShare) / bOffShare * 100;

    // cost-exposure proxy: volume-weighted average tau experienced
    const wavgTau = (txs) => txs.reduce((s, t) => s + t.tau * t.amountIn, 0) / txs.reduce((s, t) => s + t.amountIn, 0);
    const tTau = wavgTau(tTx);
    const bTau = wavgTau(bTx);
    const tauExposureChange = (tTau - bTau) / bTau * 100; // negative = shifted toward cheaper (lower-tau) periods

    return {
        id: p.id, name: p.name, type: p.type, elasticity: p.elasticity,
        n_treatment: tTx.length, n_baseline: bTx.length,
        peakShare_treatment: +(tPeakShare * 100).toFixed(2),
        peakShare_baseline: +(bPeakShare * 100).toFixed(2),
        peakReduction_pct: +peakReduction.toFixed(1),
        offpeakShare_treatment: +(tOffShare * 100).toFixed(2),
        offpeakShare_baseline: +(bOffShare * 100).toFixed(2),
        offpeakIncrease_pct: +offpeakIncrease.toFixed(1),
        avgTau_treatment: +tTau.toFixed(4),
        avgTau_baseline: +bTau.toFixed(4),
        tauExposureChange_pct: +tauExposureChange.toFixed(1)
    };
}).sort((a, b) => b.elasticity - a.elasticity);

const outDir = path.join(__dirname, 'results_v2');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'treatment_run_illustrative.json'), JSON.stringify(treatment, null, 2));
fs.writeFileSync(path.join(outDir, 'baseline_run_illustrative.json'), JSON.stringify(baseline, null, 2));

// CSV
const csvLines = ['Prosumer,Type,Elasticity,N_Treatment,N_Baseline,PeakReduction_pct,OffpeakIncrease_pct,TauExposureChange_pct'];
perProsumerAveraged.forEach(r => {
    csvLines.push([r.name, r.type, r.elasticity, r.n_treatment, r.n_baseline, r.peakReduction_pct, r.offpeakIncrease_pct, r.tauExposureChange_pct].join(','));
});
fs.writeFileSync(path.join(outDir, 'table4_replacement.csv'), csvLines.join('\n') + '\n');

// LaTeX (drop-in replacement for Table 4)
const texLines = [];
texLines.push('\\begin{table}[h]');
texLines.push(`\\caption{Load Shifting Performance by Prosumer (per-entity, N=${N_SEEDS} paired seeded runs, real elasticity values)}`);
texLines.push('\\label{tab:load_shifting_results}');
texLines.push('\\centering');
texLines.push('\\footnotesize');
texLines.push('\\resizebox{\\columnwidth}{!}{%');
texLines.push('\\begin{tabular}{lcccc}');
texLines.push('\\toprule');
texLines.push('\\textbf{Prosumer} & \\textbf{$\\epsilon$} & \\textbf{Peak Red.} & \\textbf{Off-Peak Inc.} & \\textbf{Type} \\\\');
texLines.push('\\midrule');
perProsumerAveraged.forEach(r => {
    const type = r.type.charAt(0).toUpperCase() + r.type.slice(1);
    texLines.push(`${r.name} & ${r.elasticity.toFixed(2)} & ${r.peakReduction_pct.toFixed(1)}\\% & ${r.offpeakIncrease_pct.toFixed(1)}\\% & ${type} \\\\`);
});
texLines.push('\\midrule');
texLines.push(`\\textbf{System-Wide Avg.} & \\textbf{--} & \\textbf{${avgPeakReduction.toFixed(1)}\\%} & \\textbf{${avgOffpeakIncrease.toFixed(1)}\\%} & \\textbf{--} \\\\`);
texLines.push('\\bottomrule');
texLines.push('\\end{tabular}');
texLines.push('}');
texLines.push('\\end{table}');
fs.writeFileSync(path.join(outDir, 'table4_replacement.tex'), texLines.join('\n') + '\n');

fs.writeFileSync(path.join(outDir, 'table4_replacement.json'), JSON.stringify({
    note: 'perProsumerAveraged and systemWideAveraged are averaged over N_SEEDS paired baseline/treatment runs. illustrativeSingleRun is one concrete paired draw (headline seed) kept for inspection, analogous to the original synthetic_transactions_520.json format.',
    N_SEEDS,
    headlineSeed: HEADLINE_SEED,
    treatmentConfig, baselineConfig,
    systemWideAveraged: {
        n_treatment_total_across_seeds: sysT.total, n_baseline_total_across_seeds: sysB.total,
        peakShare_treatment_pct: +(avgPeakShareT * 100).toFixed(2),
        peakShare_baseline_pct: +(avgPeakShareB * 100).toFixed(2),
        peakReduction_pct: +avgPeakReduction.toFixed(1),
        offpeakShare_treatment_pct: +(avgOffShareT * 100).toFixed(2),
        offpeakShare_baseline_pct: +(avgOffShareB * 100).toFixed(2),
        offpeakIncrease_pct: +avgOffpeakIncrease.toFixed(1)
    },
    elasticityVsPeakReductionCorrelation: +elasReductionCorr.toFixed(3),
    perProsumerAveraged,
    illustrativeSingleRun: {
        n_treatment: tSum.total, n_baseline: bSum.total,
        peakShare_treatment_pct: +(tSum.peakShare * 100).toFixed(2),
        peakShare_baseline_pct: +(bSum.peakShare * 100).toFixed(2),
        peakReduction_pct: +systemPeakReduction.toFixed(1),
        offpeakShare_treatment_pct: +(tSum.offpeakShare * 100).toFixed(2),
        offpeakShare_baseline_pct: +(bSum.offpeakShare * 100).toFixed(2),
        offpeakIncrease_pct: +systemOffpeakIncrease.toFixed(1)
    }
}, null, 2));

console.log('=== AVERAGED OVER ' + N_SEEDS + ' PAIRED SEEDS ===');
console.log('SYSTEM-WIDE:');
console.log('  peak share: baseline ' + (avgPeakShareB*100).toFixed(2) + '% -> treatment ' + (avgPeakShareT*100).toFixed(2) + '%  => reduction ' + avgPeakReduction.toFixed(1) + '%');
console.log('  offpeak share: baseline ' + (avgOffShareB*100).toFixed(2) + '% -> treatment ' + (avgOffShareT*100).toFixed(2) + '%  => increase ' + avgOffpeakIncrease.toFixed(1) + '%');
console.log('  correlation(elasticity, peak reduction) = ' + elasReductionCorr.toFixed(3));
console.log('');
console.log('PER-PROSUMER (averaged, sorted by elasticity, high to low):');
console.log('name'.padEnd(14), 'eps'.padStart(6), 'n(trt)'.padStart(8), 'peakRed%'.padStart(10), 'offInc%'.padStart(10), 'tauExpChg%'.padStart(12));
perProsumerAveraged.forEach(p => {
    console.log(p.name.padEnd(14), p.elasticity.toFixed(2).padStart(6), String(p.n_treatment).padStart(8), String(p.peakReduction_pct).padStart(10), String(p.offpeakIncrease_pct).padStart(10), String(p.tauExposureChange_pct).padStart(12));
});
console.log('');
console.log('=== SINGLE ILLUSTRATIVE RUN (seed=' + HEADLINE_SEED + ', n=520 each, for inspection) ===');
console.log('  peak reduction: ' + systemPeakReduction.toFixed(1) + '%   offpeak increase: ' + systemOffpeakIncrease.toFixed(1) + '%');
console.log('');
console.log('Files written to ' + outDir + ':');
console.log('  table4_replacement.json / .csv / .tex');
console.log('  baseline_run_illustrative.json');
console.log('  treatment_run_illustrative.json');
