// verify_swap_prices.js
// -----------------------------------------------------------------------------
// Read-only check of the price direction / size of the deployed TimeWeightedAMM.
// For each real time-weighted swap in onchain_validation_run1/run2.json it reads
// the SwapExecuted event from the transaction receipt and prints tau, amountIn,
// amountOut and effectivePrice (= amountOut / amountIn, as the contract defines it).
//
// With near-equal reserves and a 5-token swap in a ~1000-token pool:
//   if the swap rate scales as 1/tau^2 (what the contract code does):
//        effectivePrice * tau^2  ~ 0.99
//   if it scaled as 1/tau (what Eq. 6 of the draft says):
//        effectivePrice * tau    ~ 0.99
// The last two columns show both so you can see which law the chain follows.
//
// Usage (project root):  node test/energytest/verify_swap_prices.js [run1.json run2.json ...]
// Defaults look for test/energyresults/onchain_validation_run1.json / _run2.json
// and onchain_validation_results.json. Needs INFURA_PROJECT_ID (or RPC_URL) in .env.
// No private key, no gas.
// -----------------------------------------------------------------------------
try { require('dotenv').config(); require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); } catch (e) {}
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

const TWAMM = '0xd85499cb852d582a26570f1c2b391c513ace78a2';
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
  let files = process.argv.slice(2);
  if (!files.length) files = ['onchain_validation_run1.json', 'onchain_validation_run2.json', 'onchain_validation_results.json'].map(f => path.join(resDir, f)).filter(fs.existsSync);
  if (!files.length) { console.error('No result JSON found; pass paths as arguments.'); process.exit(1); }
  console.log('file                          swap                tau    in      out(tokens) out(wei)              effPrice  eff*tau^2  eff*tau');
  console.log('-'.repeat(102));
  for (const file of files) {
    const run = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const t of collectSwapTxs(run)) {
      const rc = await web3.eth.getTransactionReceipt(t.txHash);
      const log = (rc.logs || []).find(l => l.address.toLowerCase() === TWAMM && l.topics[0] === topic);
      if (!log) { console.log(`${path.basename(file).padEnd(30)}${t.label.padEnd(20)}no SwapExecuted event in receipt`); continue; }
      const s = decodeSwap(web3, log);
      console.log(`${path.basename(file).padEnd(30)}${t.label.padEnd(20)}${s.tau.toFixed(2).padStart(5)} ${s.amountIn.toFixed(3).padStart(7)} ${s.amountOut.toFixed(4).padStart(8)} ${s.outWei.padStart(22)} ${s.effectivePrice.toFixed(4).padStart(9)} ${(s.effectivePrice * s.tau * s.tau).toFixed(4).padStart(10)} ${(s.effectivePrice * s.tau).toFixed(4).padStart(8)}`);
    }
  }
  console.log('\nNOTE: a 5-token swap into a ~1000-token pool should return about 4.9 tokens (about 4.9e18 wei). If out(wei) is a single-digit number, the vault getAmountOut scaling bug is confirmed on chain.');
  console.log('If "eff*tau^2" is ~0.99 the chain follows 1/tau^2; if "eff*tau" is ~0.99 it follows 1/tau.');
}
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
module.exports = { decodeSwap };