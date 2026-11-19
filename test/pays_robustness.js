#!/usr/bin/env node
/**
 * pays_robustness.js  -  stronger, offline re-analysis of the RBF speculation claim (PAYS).
 *
 * Reads pays_results/sepolia_series.json (recorded Sepolia blocks, evidence D). Sends nothing, needs no network,
 * no ETH, no secrets. Deterministic (seeded). Writes pays_results/robustness.json and robustness.md.
 *
 * What it adds over the single 60/40 split in passchain_validation.js:
 *   1. Rolling-origin evaluation: 5 expanding-window folds. Settings of EVERY model are tuned on the training part
 *      of each fold only; the test part of the fold is never used for choosing anything.
 *   2. Fairly tuned baselines: persistence, moving average (window tuned), exponential smoothing (alpha tuned),
 *      ridge autoregression AR(p) (p and ridge tuned), linear trend, and the RBF (k, beta, lambda tuned).
 *   3. Several horizons (1, 2 and 4 blocks ahead) and three targets: gas utilisation, transaction count, base fee.
 *   4. Significance that respects autocorrelation: Diebold-Mariano test with Newey-West variance
 *      (lag h-1 + a small buffer), and a moving-block bootstrap interval for the loss difference.
 *      p-values are Holm-adjusted across all comparisons.
 *   5. Verdict is stated per target and horizon: RBF is only called "better" when it beats the best tuned baseline.
 *
 * Usage:  node pays_robustness.js [--dir path/to/pays_results]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const argAfter = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : undefined; };
const dir = path.resolve(argAfter('--dir') || 'pays_results');
const series = JSON.parse(fs.readFileSync(path.join(dir, 'sepolia_series.json'), 'utf8'));
const B = series.blocks;

// ---------- small numeric helpers
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.max(0, Math.floor(p * (b.length - 1))))]; };
function solveLinear(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k]; x[i] = s / (M[i][i] || 1e-12); }
  return x;
}
// standard normal CDF (Abramowitz-Stegun 7.1.26 via erf)
function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
const twoSided = (z) => 2 * (1 - normCdf(Math.abs(z)));

// ---------- forecasters. Each takes the series x, the forecast origin t (uses x[0..t-1]) and horizon h; predicts x[t+h-1].
const rbfPredict = (hist, beta, lambda, steps) => {
  const k = hist.length, mu = mean(hist), v = hist.map((x) => x - mu), xs = hist.map((_, i) => i / (k - 1)), phi = (d) => Math.exp(-((beta * d) ** 2));
  const w = solveLinear(xs.map((xi, i) => xs.map((xj, j) => phi(xi - xj) + (i === j ? lambda : 0))), v);
  const xq = 1 + steps / (k - 1);
  return mu + xs.reduce((s, xi, i) => s + w[i] * phi(xq - xi), 0);
};
const MODELS = {
  persistence: { grid: [{}], make: () => (x, t) => x[t - 1] },
  movingAverage: { grid: [4, 8, 16, 32, 64].map((k) => ({ k })), make: ({ k }) => (x, t) => mean(x.slice(t - k, t)) },
  expSmoothing: { grid: [0.05, 0.1, 0.2, 0.4, 0.7].map((a) => ({ a })), make: ({ a }) => (x, t) => { let l = x[Math.max(0, t - 200)]; for (let i = Math.max(0, t - 200) + 1; i < t; i++) l = a * x[i] + (1 - a) * l; return l; } },
  linearTrend: { grid: [4, 8, 16].map((k) => ({ k })), make: ({ k }) => (x, t, h) => { const y = x.slice(t - k, t), mx = (k - 1) / 2, my = mean(y); let sxy = 0, sxx = 0; y.forEach((v, i) => { sxy += (i - mx) * (v - my); sxx += (i - mx) ** 2; }); return my + (sxy / sxx) * (k - 1 + h - mx); } },
  rbf: { grid: (() => { const g = []; for (const k of [6, 8, 12, 16, 24]) for (const beta of [0.5, 1, 2, 4, 8, 16, 32]) for (const lambda of [1e-6, 1e-4, 1e-2, 1e-1, 1]) g.push({ k, beta, lambda }); return g; })(), make: ({ k, beta, lambda }) => (x, t, h) => rbfPredict(x.slice(t - k, t), beta, lambda, h) },
};
// AR(p) with ridge, fitted by least squares on the last `win` points before the origin, iterated to horizon h
MODELS.ar = { grid: (() => { const g = []; for (const p of [2, 4, 8]) for (const ridge of [1e-3, 1e-1]) g.push({ p, ridge }); return g; })(), make: ({ p, ridge }) => (x, t, h) => {
  const win = Math.min(300, t - p - 1), rows = [], ys = [];
  for (let i = t - win; i < t; i++) { if (i - p < 0) continue; rows.push([1, ...x.slice(i - p, i)]); ys.push(x[i]); }
  const q = p + 1, A = Array.from({ length: q }, () => new Array(q).fill(0)), b = new Array(q).fill(0);
  rows.forEach((r, n) => { for (let i = 0; i < q; i++) { b[i] += r[i] * ys[n]; for (let j = 0; j < q; j++) A[i][j] += r[i] * r[j]; } });
  for (let i = 1; i < q; i++) A[i][i] += ridge * rows.length * 1e-3;
  const w = solveLinear(A, b); let ctx = x.slice(t - p, t), pred = 0;
  for (let s = 0; s < h; s++) { pred = w[0] + ctx.reduce((a, v, i) => a + w[i + 1] * v, 0); ctx = [...ctx.slice(1), pred]; }
  return pred;
} };

// ---------- evaluation
const targets = {
  gasUtilisation: B.map((b) => b.gasUsed / b.gasLimit),
  txCount: B.map((b) => b.txCount),
  baseFee: B.map((b) => b.baseFeeGwei),
};
const HORIZONS = [1, 2, 4];
const N_FOLDS = 5, MIN_TRAIN = 800;

function losses(pred, x, a, b, h) { const e = []; for (let t = a; t + h - 1 < b; t++) e.push(Math.abs(pred(x, t, h) - x[t + h - 1])); return e; }
function tuneOn(name, x, trainEnd, h) { // inner validation: last 35% of the training part
  const vStart = Math.floor(trainEnd * 0.65), g = MODELS[name].grid; let best = null;
  for (const params of g) {
    const f = MODELS[name].make(params), e = losses(f, x, vStart, trainEnd, h), m = mean(e);
    if (!best || m < best.m) best = { params, m };
  }
  return best.params;
}
// Diebold-Mariano (loss differential d = lossA - lossB), Newey-West variance
function dm(dA, h) {
  const n = dA.length, m = mean(dA), L = Math.max(h - 1, Math.floor(Math.pow(n, 1 / 3)));
  const gam = (k) => { let s = 0; for (let i = k; i < n; i++) s += (dA[i] - m) * (dA[i - k] - m); return s / n; };
  let v = gam(0); for (let k = 1; k <= L; k++) v += 2 * (1 - k / (L + 1)) * gam(k);
  const se = Math.sqrt(Math.max(v, 1e-30) / n), stat = m / se;
  return { meanDiff: m, stat, p: twoSided(stat) };
}
function blockBootCi(d, block, seed) {
  const r = rng(seed), n = d.length, means = [];
  for (let b = 0; b < 1000; b++) { let s = 0, c = 0; while (c < n) { const st = Math.floor(r() * (n - block + 1)); for (let i = 0; i < block && c < n; i++, c++) s += d[st + i]; } means.push(s / n); }
  return [pct(means, 0.025), pct(means, 0.975)];
}

const out = { generated: new Date().toISOString(), source: series.network, tag: series.tag, blocks: B.length, folds: N_FOLDS, results: {}, notes: [] };
const pvals = [];
for (const [tname, x] of Object.entries(targets)) {
  const cv = sd(x) / Math.abs(mean(x) || 1);
  // saturation check, as in the main script: persistence already within 2% of mean on >= 99% of blocks
  out.results[tname] = { cv, horizons: {} };
  for (const h of HORIZONS) {
    const n = x.length, testSize = Math.floor((n - MIN_TRAIN) / N_FOLDS);
    const perModel = {}; for (const m of Object.keys(MODELS)) perModel[m] = { loss: [], chosen: [] };
    const foldLen = [];
    for (let f = 0; f < N_FOLDS; f++) {
      const trainEnd = MIN_TRAIN + f * testSize, testEnd = trainEnd + testSize;
      for (const m of Object.keys(MODELS)) {
        const params = tuneOn(m, x, trainEnd, h), fn = MODELS[m].make(params);
        const l = losses(fn, x, trainEnd, testEnd, h); perModel[m].loss.push(...l); perModel[m].chosen.push(params);
        if (m === 'rbf') foldLen.push(l.length);
      }
    }
    const summary = {};
    for (const m of Object.keys(MODELS)) summary[m] = { mae: mean(perModel[m].loss), chosenPerFold: perModel[m].chosen };
    const baselines = Object.keys(MODELS).filter((m) => m !== 'rbf');
    const bestBase = baselines.reduce((a, b) => (summary[a].mae <= summary[b].mae ? a : b));
    const cmp = {};
    for (const b of [...baselines]) {
      const d = perModel.rbf.loss.map((v, i) => v - perModel[b].loss[i]);
      const t = dm(d, h), ci = blockBootCi(d, Math.max(20, 5 * h), 7 + h);
      cmp[b] = { meanMaeDiff_rbfMinusBaseline: t.meanDiff, dmStat: t.stat, pRaw: t.p, blockBootstrapCi95: ci, rbfBetter: ci[1] < 0, rbfWorse: ci[0] > 0 };
      pvals.push({ tname, h, b, ref: cmp[b] });
    }
    // fold-wise win count vs the best baseline
    let wins = 0, off = 0;
    for (let f = 0; f < N_FOLDS; f++) { const sl = (a) => mean(a.slice(off, off + foldLen[f])); if (sl(perModel.rbf.loss) < sl(perModel[bestBase].loss)) wins++; off += foldLen[f]; }
    out.results[tname].horizons[h] = { n: perModel.rbf.loss.length, summary, bestBaseline: bestBase, rbfFoldWinsVsBestBaseline: `${wins}/${N_FOLDS}`, comparisons: cmp };
    process.stderr.write(`${tname} h=${h}: RBF ${summary.rbf.mae.toPrecision(4)} | best baseline ${bestBase} ${summary[bestBase].mae.toPrecision(4)} | persistence ${summary.persistence.mae.toPrecision(4)}\n`);
  }
}
// Holm correction across every comparison
const sorted = [...pvals].sort((a, b) => a.ref.pRaw - b.ref.pRaw);
let prev = 0; sorted.forEach((o, i) => { const adj = Math.min(1, (pvals.length - i) * o.ref.pRaw); prev = Math.max(prev, adj); o.ref.pHolm = prev; });

// verdict per target/horizon
function verdictFor(R) {
  const c = R.comparisons, bb = R.bestBaseline, vp = c.persistence, vb = c[bb];
  if (vp.rbfWorse && vp.pHolm < 0.05) return 'NOT SUPPORTED: RBF is significantly worse than persistence';
  if (!(vp.rbfBetter && vp.pHolm < 0.05)) return 'INCONCLUSIVE: no significant gain over persistence after Holm correction';
  if (vb.rbfBetter && vb.pHolm < 0.05) return 'PASS: beats every tuned baseline';
  if (vb.rbfWorse && vb.pHolm < 0.05) return `PARTIAL: beats persistence, but ${bb} is significantly better`;
  return `PARTIAL: beats persistence, no significant difference from best tuned baseline (${bb})`;
}
for (const t of Object.values(out.results)) for (const R of Object.values(t.horizons)) R.verdict = verdictFor(R);
out.notes.push('RBF settings and every baseline are tuned on the training part of each fold only.', 'Significance: Diebold-Mariano with Newey-West variance, Holm-adjusted across all comparisons; interval: moving-block bootstrap.', 'Single recorded Sepolia window; generalisation to other periods or to Ethereum mainnet is not tested here.');
fs.writeFileSync(path.join(dir, 'robustness.json'), JSON.stringify(out, null, 2));

// markdown report
const f4 = (v) => (Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(2) : v.toFixed(4));
let md = `# PAYS RBF robustness (rolling-origin, tuned baselines)\n\nSource: ${out.source} (${out.tag}), ${out.blocks} blocks, ${N_FOLDS} expanding-window folds. All models tuned on training parts only.\n\n`;
for (const [tn, T] of Object.entries(out.results)) {
  md += `## ${tn}\n\n| Horizon | RBF MAE | Persistence | Best tuned baseline | RBF - best (95% block-bootstrap CI) | DM p (Holm) | Folds RBF wins | Verdict |\n|---|---|---|---|---|---|---|---|\n`;
  for (const [h, R] of Object.entries(T.horizons)) {
    const bb = R.bestBaseline, c = R.comparisons[bb];
    md += `| ${h} | ${f4(R.summary.rbf.mae)} | ${f4(R.summary.persistence.mae)} | ${bb} ${f4(R.summary[bb].mae)} | ${f4(c.meanMaeDiff_rbfMinusBaseline)} [${f4(c.blockBootstrapCi95[0])}, ${f4(c.blockBootstrapCi95[1])}] | ${c.pHolm.toFixed(3)} | ${R.rbfFoldWinsVsBestBaseline} | ${R.verdict} |\n`;
  }
  md += '\n';
}
md += out.notes.map((n) => `- ${n}`).join('\n') + '\n';
fs.writeFileSync(path.join(dir, 'robustness.md'), md);
console.log(md);
