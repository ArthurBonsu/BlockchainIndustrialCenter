// setup_liquidity.js - Add liquidity to vault before experiments
// Run this ONCE before running experiments

require('dotenv').config();
const { Web3 } = require('web3');

// Your deployed contract addresses
const CONTRACT_ADDRESSES = {
    EnergyTokenRE: "0xa78fc8e55a017cb5659476f6d67fe77c22b4c59a",
    EnergyTokenNRE: "0x8b8d7b0d8f38488f56454337205e269c20892e6c",
    EnergyTokenVault: "0x7467290233c25966453889423Bded7Aa20e042D1"
};

// Minimal ABIs (only the methods we need)
const ABIS = {
    ERC20: [
        {
            "inputs": [{"internalType": "address", "name": "spender", "type": "address"},
                       {"internalType": "uint256", "name": "amount", "type": "uint256"}],
            "name": "approve",
            "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "address", "name": "to", "type": "address"},
                       {"internalType": "uint256", "name": "amount", "type": "uint256"}],
            "name": "mint",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ],
    Vault: [
        {
            "inputs": [{"internalType": "uint256", "name": "amountRE", "type": "uint256"},
                       {"internalType": "uint256", "name": "amountNRE", "type": "uint256"}],
            "name": "addLiquidity",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getReserves",
            "outputs": [{"internalType": "uint256", "name": "_reserveRE", "type": "uint256"},
                       {"internalType": "uint256", "name": "_reserveNRE", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

async function main() {
    console.log('🚀 Setting up liquidity for Energy AMM experiments\n');
    
    // Initialize Web3
    const providerUrl = process.env.ETHEREUM_PROVIDER_URL || 
                       `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
    const web3 = new Web3(providerUrl);
    web3.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
    
    // Setup account
    let privateKey = process.env.PRIVATE_KEY || process.env.ETHEREUM_PRIVATE_KEY;
    privateKey = privateKey.trim().replace(/\s/g, '');
    if (privateKey.length === 64) privateKey = '0x' + privateKey;
    
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);
    web3.eth.defaultAccount = account.address;
    
    console.log(`✅ Account: ${account.address}\n`);
    
    // Initialize contracts
    const tokenRE = new web3.eth.Contract(ABIS.ERC20, CONTRACT_ADDRESSES.EnergyTokenRE);
    const tokenNRE = new web3.eth.Contract(ABIS.ERC20, CONTRACT_ADDRESSES.EnergyTokenNRE);
    const vault = new web3.eth.Contract(ABIS.Vault, CONTRACT_ADDRESSES.EnergyTokenVault);
    
    tokenRE.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
    tokenNRE.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
    vault.defaultReturnFormat = { number: 'str', bytes: 'HEX' };
    
    try {
        // Check current reserves
        console.log('📊 Checking current vault reserves...');
        const reserves = await vault.methods.getReserves().call();
        const currentRE = web3.utils.fromWei(reserves._reserveRE, 'ether');
        const currentNRE = web3.utils.fromWei(reserves._reserveNRE, 'ether');
        
        console.log(`   Current RE:  ${currentRE} tokens`);
        console.log(`   Current NRE: ${currentNRE} tokens\n`);
        
        if (parseFloat(currentRE) > 0 && parseFloat(currentNRE) > 0) {
            console.log('✅ Vault already has liquidity!');
            console.log('   You can now run experiments: node energy_amm_complete.js\n');
            return;
        }
        
        // Check token balances
        console.log('💰 Checking your token balances...');
        const balanceRE = await tokenRE.methods.balanceOf(account.address).call();
        const balanceNRE = await tokenNRE.methods.balanceOf(account.address).call();
        
        console.log(`   Your RE:  ${web3.utils.fromWei(balanceRE, 'ether')} tokens`);
        console.log(`   Your NRE: ${web3.utils.fromWei(balanceNRE, 'ether')} tokens\n`);
        
        // Mint tokens if needed
        const needRE = parseFloat(web3.utils.fromWei(balanceRE, 'ether')) < 10000;
        const needNRE = parseFloat(web3.utils.fromWei(balanceNRE, 'ether')) < 10000;
        
        if (needRE || needNRE) {
            console.log('🪙 Minting tokens...');
            
            if (needRE) {
                try {
                    console.log('   Minting 100,000 RE tokens...');
                    const tx = await tokenRE.methods.mint(account.address, 100000)
                        .send({ from: account.address, gas: 200000 });
                    console.log(`   ✅ RE minted: ${tx.transactionHash.substring(0, 10)}...`);
                } catch (error) {
                    console.log(`   ⚠️  RE mint failed: ${error.message}`);
                    console.log('   You may not be the token owner. Use existing tokens or ask owner to mint.');
                }
            }
            
            if (needNRE) {
                try {
                    console.log('   Minting 100,000 NRE tokens...');
                    const tx = await tokenNRE.methods.mint(account.address, 100000)
                        .send({ from: account.address, gas: 200000 });
                    console.log(`   ✅ NRE minted: ${tx.transactionHash.substring(0, 10)}...`);
                } catch (error) {
                    console.log(`   ⚠️  NRE mint failed: ${error.message}`);
                    console.log('   You may not be the token owner. Use existing tokens or ask owner to mint.');
                }
            }
            console.log('');
        }
        
        // Approve vault to spend tokens
        console.log('✍️  Approving vault to spend tokens...');
        
        const amountToAdd = web3.utils.toWei('10000', 'ether'); // 10,000 of each token
        
        console.log('   Approving RE...');
        const approveRE = await tokenRE.methods.approve(CONTRACT_ADDRESSES.EnergyTokenVault, amountToAdd)
            .send({ from: account.address, gas: 100000 });
        console.log(`   ✅ RE approved: ${approveRE.transactionHash.substring(0, 10)}...`);
        
        console.log('   Approving NRE...');
        const approveNRE = await tokenNRE.methods.approve(CONTRACT_ADDRESSES.EnergyTokenVault, amountToAdd)
            .send({ from: account.address, gas: 100000 });
        console.log(`   ✅ NRE approved: ${approveNRE.transactionHash.substring(0, 10)}...\n`);
        
        // Add liquidity
        console.log('💧 Adding liquidity to vault...');
        console.log(`   Amount: 10,000 RE + 10,000 NRE`);
        
        const addLiq = await vault.methods.addLiquidity(amountToAdd, amountToAdd)
            .send({ from: account.address, gas: 300000 });
        
        console.log(`   ✅ Liquidity added: ${addLiq.transactionHash.substring(0, 10)}...\n`);
        
        // Verify new reserves
        console.log('✅ Verifying new vault reserves...');
        const newReserves = await vault.methods.getReserves().call();
        console.log(`   RE Reserve:  ${web3.utils.fromWei(newReserves._reserveRE, 'ether')} tokens`);
        console.log(`   NRE Reserve: ${web3.utils.fromWei(newReserves._reserveNRE, 'ether')} tokens\n`);
        
        console.log('='.repeat(80));
        console.log('🎉 SETUP COMPLETE!');
        console.log('='.repeat(80));
        console.log('\n✅ Your vault now has liquidity');
        console.log('✅ You can now run experiments:\n');
        console.log('   node energy_amm_complete.js\n');
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.error('\n🔍 Possible issues:');
        console.error('1. You may not own the tokens (need to mint from owner account)');
        console.error('2. Contract addresses may be incorrect');
        console.error('3. Contracts may not be properly deployed');
        console.error('4. Account may not have enough Sepolia ETH for gas\n');
    }
}

if (require.main === module) {
    main();
}