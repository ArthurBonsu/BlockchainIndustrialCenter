// read_onchain_price_quotes.js
// -----------------------------------------------------------------------------
// Read-only. Reads the deployed TimeWeightedAMM's own price function,
// getTimeWeightedPrices() (paper Eq. 6: P = (R_beta / R_alpha) / tau), at one
// block from each hour of a past UTC day, using eth_call at that block.
// No transaction, no private key, no gas, no redeployment.
//
// The contract picks tau from block.timestamp, and an eth_call at a historical
// block runs with THAT block's timestamp, so one run can read all three periods
// (off-peak 23:00-06:59, normal 07:00-16:59, peak 17:00-21:59 UTC) without
// waiting for the right hour.
//
// getTimeWeightedPrices() reads only the vault reserves and tau. It does not
// call the vault's getAmountOut, so it is not affected by the output-scaling
// error found in the swap path. For transparency the script also prints what
// the swap quote getAmountOut(5 tokens) returns at the same block.
//
// Usage (project root):
//   node test/energytest/read_onchain_price_quotes.js [--date=YYYY-MM-DD]
// Default date: the day before today (UTC). The date must be after the
// liquidity was added (Sepolia block 11691111, 2026-09-12).
// Needs INFURA_PROJECT_ID (or RPC_URL) in .env, and a provider that serves
// archive state for past blocks. If it reports "missing trie node" or similar,
// use an archive-capable RPC_URL, or pass a recent date within the provider's
// state window.
// Output: console table + test/energyresults/onchain_price_quotes_<date>.json
// -----------------------------------------------------------------------------
try { require('dotenv').config(); require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); } catch (e) {}
const fs = require('fs');
const path = require('path');

const TWAMM = '0xd85499cb852d582a26570f1c2b391c513ace78a2';
const FIRST_BLOCK_WITH_LIQUIDITY = 11691111;

const ABI = [
  { inputs: [], name: 'getTimeWeightedPrices', outputs: [{ type: 'uint256', name: 'priceRE' }, { type: 'uint256', name: 'priceNRE' }, { type: 'uint256', name: 'tau' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getCurrentPeriod', outputs: [{ type: 'string', name: 'period' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'uint256', name: 'amountIn' }, { type: 'bool', name: 'isREtoNRE' }], name: 'getAmountOut', outputs: [{ type: 'uint256', name: 'amountOut' }, { type: 'uint256', name: 'effectiveFee' }], stateMutability: 'view', type: 'function' },
];

// First block (within [lo, hi]) whose timestamp is >= target. getTs(n) -> Number seconds.
async function firstBlockAtOrAfter(getTs, target, lo, hi) {
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await getTs(mid)) >= target) hi = mid; else lo = mid + 1;
  }
  return lo;
}

function parseDate(argv) {
  const a = argv.find(x => x.startsWith('--date='));
  if (a) return a.slice(7);
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { Web3 } = require('web3');
  const web3 = new Web3(process.env.RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
  web3.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
  const date = parseDate(process.argv.slice(2));
  const dayStart = Math.floor(Date.parse(date + 'T00:00:00Z') / 1000);
  if (!Number.isFinite(dayStart)) { console.error('Bad --date, use YYYY-MM-DD'); process.exit(1); }

  const head = Number(await web3.eth.getBlockNumber());
  const getTs = async (n) => Number((await web3.eth.getBlock(n)).timestamp);
  const headTs = await getTs(head);
  if (dayStart + 24 * 3600 > headTs) { console.error('That day is not complete yet; choose an earlier date.'); process.exit(1); }
  const firstTs = await getTs(FIRST_BLOCK_WITH_LIQUIDITY);
  if (dayStart + 3600 < firstTs) { console.error('Date is before liquidity was added (2026-09-12); choose a later date.'); process.exit(1); }

  const c = new web3.eth.Contract(ABI, TWAMM);
  const f = (x) => Number(x) / 1e18;
  const rows = [];
  let lo = FIRST_BLOCK_WITH_LIQUIDITY;
  console.log(`TimeWeightedAMM ${TWAMM} -- UTC day ${date}, one block per hour (eth_call at that block)\n`);
  console.log('hourUTC  block      period    tau    priceRE   priceNRE  swapQuote(5 in) wei');
  console.log('-'.repeat(88));
  for (let h = 0; h < 24; h++) {
    const target = dayStart + h * 3600 + 60; // one minute into the hour, safely inside it
    const blk = await firstBlockAtOrAfter(getTs, target, lo, head);
    lo = blk;
    const ts = await getTs(blk);
    const hourOfBlock = Math.floor(ts / 3600) % 24;
    try {
      const p = await c.methods.getTimeWeightedPrices().call({}, blk);
      const period = await c.methods.getCurrentPeriod().call({}, blk);
      const q = await c.methods.getAmountOut('5000000000000000000', true).call({}, blk);
      const tau = f(p.tau), priceRE = f(p.priceRE), priceNRE = f(p.priceNRE);
      rows.push({ hourUTC: hourOfBlock, block: blk, timestamp: ts, period, tau, priceRE, priceNRE, swapQuoteOutWei: String(q.amountOut) });
      console.log(`${String(hourOfBlock).padStart(5)}    ${String(blk).padEnd(10)} ${period.padEnd(8)} ${tau.toFixed(2).padStart(5)} ${priceRE.toFixed(4).padStart(9)} ${priceNRE.toFixed(4).padStart(10)}  ${String(q.amountOut).padStart(10)}`);
    } catch (e) {
      console.log(`${String(hourOfBlock).padStart(5)}    ${String(blk).padEnd(10)} read failed: ${(e.message || e).toString().slice(0, 90)}`);
      rows.push({ hourUTC: hourOfBlock, block: blk, timestamp: ts, error: String(e.message || e) });
    }
  }
  const ok = rows.filter(r => !r.error);
  const normal = ok.find(r => r.period === 'normal');
  if (normal) {
    for (const r of ok) r.priceRatioVsNormal = r.priceRE / normal.priceRE;
    const peak = ok.find(r => r.period === 'peak'), off = ok.find(r => r.period === 'offpeak');
    console.log('\nPrice (received per unit paid) relative to the normal hour:');
    if (peak) console.log(`  peak     x${peak.priceRatioVsNormal.toFixed(4)}  (Eq. 6 predicts 1/1.35 = 0.7407)`);
    if (off) console.log(`  off-peak x${off.priceRatioVsNormal.toFixed(4)}  (Eq. 6 predicts 1/0.75 = 1.3333)`);
    if (peak && off) console.log(`  peak / off-peak = ${(peak.priceRE / off.priceRE).toFixed(4)}  (Eq. 6 predicts 0.5556)`);
  }
  const out = path.join(__dirname, '..', 'energyresults', `onchain_price_quotes_${date}.json`);
  try { fs.mkdirSync(path.dirname(out), { recursive: true }); } catch (e) {}
  fs.writeFileSync(out, JSON.stringify({ contract: TWAMM, network: 'Sepolia', utcDay: date, note: 'eth_call at one block per hour; read-only; getTimeWeightedPrices() is Eq. 6, swapQuoteOutWei is getAmountOut(5e18, RE->NRE) at the same block', rows }, null, 2));
  console.log(`\nSaved ${out}`);
}

if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
module.exports = { firstBlockAtOrAfter };