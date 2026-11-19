// verify_swap_v2.js  (checks the swaps of the NEW TimeWeightedAMMV2; verify_swap_prices.js stays as the v1 check)
// -----------------------------------------------------------------------------
// Read-only check of the price direction / size of the deployed TimeWeightedAMM.
// For each real time-weighted swap in onchain_validation_run1/run2.json it reads
// the SwapExecuted event from the transaction receipt and prints tau, amountIn,
// amountOut and effectivePrice (= amountOut / amountIn, as the contract defines it).
//
// Works for the v2 contract (default) and for the original v1 contract
// (pass --twamm=0xd85499cb852d582a26570f1c2b391c513ace78a2).
//
// With near-equal reserves and a 5-token swap in a ~1000-token pool, v2 follows Eq. 6:
//   RE -> NRE : effectivePrice * tau  ~ 0.99   (payout falls as tau rises)
//   NRE -> RE : effectivePrice / tau  ~ 0.99   (payout rises with tau)
// The "design" column shows that value for each swap's direction. The older
// eff*tau^2 column is kept for comparison with the original contract.
//
// Usage (project root):  node test/energytest/verify_swap_v2.js test/energyresults/<onchain_v2_*.json> [more.json ...]
// With no arguments it reads every test/energyresults/onchain_v2_*.json. Needs INFURA_PROJECT_ID (or RPC_URL) in .env.
// No private key, no gas.
// -----------------------------------------------------------------------------
try { require('dotenv').config(); require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); } catch (e) {}
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

// Pass --twamm=0x... (or set TWAMM_V2) to check the v2 contract; default is the v2 address deployed on 2026-11-18.
const _arg = process.argv.find(x => x.startsWith('--twamm='));
const TWAMM = ((_arg && _arg.slice(8)) || process.env.TWAMM_V2 || '0x8df62b24137bc1739a65a08267c5948192e3f38c').toLowerCase();
const SIG = 'SwapExecuted(address,bool,uint256,uint256,uint256,uint256,uint256)';
const EVENT_INPUTS = [
  { type: 'address', name: 'user', indexed: true },
  { type: 'bool', name: 'isREtoNRE' },
  { type: 'uint256', name: 'amountIn' },
  { type: 'uint256', name: 'amountOut' },
  { type: 'uint256', name: 'tau' },
  { type: 'uint256', name: 'effectivePrice' },
  { type: 'uint256', name: 'timestamp' },
];

function decodeSwap(web3, log) {
  const d = web3.eth.abi.decodeLog(EVENT_INPUTS, log.data, log.topics.slice(1));
  const f = (x) => Number(x) / 1e18;
  return { outWei: String(d.amountOut), isREtoNRE: d.isREtoNRE, amountIn: f(d.amountIn), amountOut: f(d.amountOut), tau: f(d.tau), effectivePrice: f(d.effectivePrice), timestamp: Number(d.timestamp) };
}

function collectSwapTxs(run) {
  const out = [];
  const tw = run.timeWeightedAMM || {};
  for (const [k, v] of Object.entries(tw)) if (/^swap_\d/.test(k) && v && v.txHash) out.push({ label: k, txHash: v.txHash });
  return out;
}

async function main() {
  const web3 = new Web3(process.env.RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
  web3.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
  const topic = web3.utils.keccak256(SIG);
  const resDir = path.join(__dirname, '..', 'energyresults');
  let files = process.argv.slice(2).filter(x => !x.startsWith('--'));
  if (!files.length) files = (fs.existsSync(resDir) ? fs.readdirSync(resDir).filter(f => /^onchain_v2_.*\.json$/.test(f)).map(f => path.join(resDir, f)) : []);
  if (!files.length) { console.error('No result JSON found; pass paths as arguments.'); process.exit(1); }
  console.log('file                          swap                tau    in      out(tokens) out(wei)              effPrice  eff*tau^2  design');
  console.log('-'.repeat(102));
  for (const file of files) {
    const run = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const t of collectSwapTxs(run)) {
      const rc = await web3.eth.getTransactionReceipt(t.txHash);
      const log = (rc.logs || []).find(l => l.address.toLowerCase() === TWAMM && l.topics[0] === topic);
      if (!log) { console.log(`${path.basename(file).padEnd(30)}${t.label.padEnd(20)}no SwapExecuted event in receipt`); continue; }
      const s = decodeSwap(web3, log);
      console.log(`${path.basename(file).padEnd(30)}${t.label.padEnd(20)}${s.tau.toFixed(2).padStart(5)} ${s.amountIn.toFixed(3).padStart(7)} ${s.amountOut.toFixed(4).padStart(8)} ${s.outWei.padStart(22)} ${s.effectivePrice.toFixed(4).padStart(9)} ${(s.effectivePrice * s.tau * s.tau).toFixed(4).padStart(10)} ${(s.isREtoNRE ? s.effectivePrice * s.tau : s.effectivePrice / s.tau).toFixed(4).padStart(8)}`);
    }
  }
  console.log('\nNOTE: a 5-token swap into a ~1000-token pool should return a few tokens (about 3e18 to 7e18 wei, depending on tau). A single-digit out(wei) means the old scaling bug.');
  console.log('For v2, the "design" column (eff*tau for RE->NRE, eff/tau for NRE->RE) should be ~0.99 in every period.');
}
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
module.exports = { decodeSwap };