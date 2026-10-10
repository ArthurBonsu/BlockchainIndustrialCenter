// Compile contracts/sepolia_version (repo folder SecondN2NContracts) under several settings and measure deployment gas locally.
// Compare with the Sepolia receipts to identify which source/settings were deployed.
const solc = require(process.env.SOLC_PATH || 'solc'), fs = require('fs'), path = require('path'), ganache = require('ganache'), { ethers } = require('ethers');
const dir = path.join(__dirname, 'contracts', 'sepolia_version');
const sources = {}; for (const f of fs.readdirSync(dir)) sources[f] = { content: fs.readFileSync(path.join(dir, f), 'utf8') };
const find = p => { for (const b of [process.env.NODE_PATH, '/tmp/claude-0/lab/node_modules']) { if (b && fs.existsSync(path.join(b, p))) return { contents: fs.readFileSync(path.join(b, p), 'utf8') }; } return { error: 'nf ' + p }; };
const SEP = { ABATLTranslation: 2469024, NIASRegistry: 2235243, NIDRegistry: 1930371, ClusteringContract: 506267, SequencePathRouter: 3355414 };
(async () => {
  for (const [label, opt] of [['opt off', { enabled: false }], ['opt 200', { enabled: true, runs: 200 }], ['opt 1', { enabled: true, runs: 1 }]]) {
    const input = { language: 'Solidity', sources, settings: { evmVersion: 'shanghai', optimizer: opt, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
    const out = JSON.parse(solc.compile(JSON.stringify(input), { import: find }));
    const errs = (out.errors || []).filter(e => e.severity === 'error'); if (errs.length) { console.log(label, errs.map(e => e.formattedMessage).join('\n').slice(0, 800)); continue; }
    const g = ganache.provider({ logging: { quiet: true }, miner: { blockGasLimit: 60000000 }, chain: { allowUnlimitedContractSize: true } }); const p = new ethers.BrowserProvider(g); const s = await p.getSigner(0);
    const res = {};
    for (const n of Object.keys(SEP)) { const c = out.contracts[n + '.sol'][n]; const f = new ethers.ContractFactory(c.abi, '0x' + c.evm.bytecode.object, s); const k = await f.deploy(); const r = await k.deploymentTransaction().wait(); res[n] = Number(r.gasUsed); if (!global.abis) global.abis = {}; if (label === 'opt off') { fs.mkdirSync(path.join(__dirname, 'build', 'sepolia_version'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'build', 'sepolia_version', n + '.json'), JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object })); } }
    console.log(label, JSON.stringify(res), 'total', Object.values(res).reduce((a, b) => a + b, 0), 'sepolia total', Object.values(SEP).reduce((a, b) => a + b, 0));
  }
  console.log('Sepolia', JSON.stringify(SEP));
})();
