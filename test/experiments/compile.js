// Compile both contract sets with solc-js. Usage: node compile.js  -> build/<set>/<Contract>.json
const solc = require('solc'), fs = require('fs'), path = require('path');
for (const set of ['original', 'secured']) {
  const dir = path.join(__dirname, 'contracts', set);
  const sources = {};
  for (const f of fs.readdirSync(dir)) sources[f] = { content: fs.readFileSync(path.join(dir, f), 'utf8') };
  const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: false }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter(e => e.severity === 'error');
  if (errs.length) { console.error(set, errs.map(e => e.formattedMessage).join('\n')); process.exit(1); }
  fs.mkdirSync(path.join(__dirname, 'build', set), { recursive: true });
  for (const f in out.contracts) for (const c in out.contracts[f]) {
    const o = out.contracts[f][c];
    fs.writeFileSync(path.join(__dirname, 'build', set, c + '.json'), JSON.stringify({ abi: o.abi, bytecode: '0x' + o.evm.bytecode.object }));
    console.log(set, c, (o.evm.bytecode.object.length / 2) + ' bytes');
  }
}
