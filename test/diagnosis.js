const { Web3 } = require('web3');
require('dotenv').config();

const VEHICLE_REGISTRY_ADDRESS = '0xF5c8ced708eE27B1a5F0DF54FDCeb77cc2007986';
const REVOCATION_MANAGER_ADDRESS = '0x830e941CB3A3CDAE9a4e2e2F37340c7aF6f32aA0';

const VehicleRegistryABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRemoved","type":"event"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"getPseudonymByOwner","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"getVehicle","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"registrationTime","type":"uint256"},{"internalType":"bool","name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"isVehicleRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"registerVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"removeVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"}];

async function diagnose() {
    console.log('🔍 RevChain Diagnostic Tool\n');
    console.log('='.repeat(60));
    
    const web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
    
    const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
        ? process.env.PRIVATE_KEY 
        : '0x' + process.env.PRIVATE_KEY;
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    
    console.log(`\n1️⃣  NETWORK CHECK`);
    console.log('─'.repeat(60));
    try {
        const chainId = await web3.eth.getChainId();
        const blockNumber = await web3.eth.getBlockNumber();
        console.log(`✅ Connected to chain ID: ${chainId} (${chainId === 11155111n ? 'Sepolia' : 'Unknown'})`);
        console.log(`✅ Latest block: ${blockNumber}`);
    } catch (error) {
        console.log(`❌ Network connection failed: ${error.message}`);
        return;
    }
    
    console.log(`\n2️⃣  ACCOUNT CHECK`);
    console.log('─'.repeat(60));
    console.log(`📍 Address: ${account.address}`);
    
    try {
        const balance = await web3.eth.getBalance(account.address);
        const ethBalance = web3.utils.fromWei(balance, 'ether');
        console.log(`💰 Balance: ${ethBalance} ETH`);
        
        if (parseFloat(ethBalance) < 0.001) {
            console.log(`⚠️  WARNING: Low balance! Need at least 0.001 ETH for testing`);
            console.log(`   Get Sepolia ETH from: https://sepoliafaucet.com/`);
        } else {
            console.log(`✅ Sufficient balance for testing`);
        }
    } catch (error) {
        console.log(`❌ Balance check failed: ${error.message}`);
    }
    
    console.log(`\n3️⃣  CONTRACT CHECK: VehicleRegistry`);
    console.log('─'.repeat(60));
    console.log(`📍 Address: ${VEHICLE_REGISTRY_ADDRESS}`);
    
    try {
        const code = await web3.eth.getCode(VEHICLE_REGISTRY_ADDRESS);
        if (code === '0x' || code === '0x0') {
            console.log(`❌ NO CONTRACT at this address!`);
            console.log(`   This is the MAIN ISSUE - contract not deployed on Sepolia`);
            console.log(`   Solutions:`);
            console.log(`   1. Deploy the contract to Sepolia`);
            console.log(`   2. Use the correct contract address if already deployed`);
        } else {
            console.log(`✅ Contract exists (${code.length} bytes)`);
            
            // Try to call a read function
            const vehicleRegistry = new web3.eth.Contract(VehicleRegistryABI, VEHICLE_REGISTRY_ADDRESS);
            try {
                const testPseudonym = "0x0000000000000000000000000000000000000000";
                const isRegistered = await vehicleRegistry.methods.isVehicleRegistered(testPseudonym).call();
                console.log(`✅ Contract is callable (test read successful)`);
            } catch (readError) {
                console.log(`⚠️  Contract exists but read call failed: ${readError.message}`);
            }
        }
    } catch (error) {
        console.log(`❌ Contract check failed: ${error.message}`);
    }
    
    console.log(`\n4️⃣  CONTRACT CHECK: RevocationManager`);
    console.log('─'.repeat(60));
    console.log(`📍 Address: ${REVOCATION_MANAGER_ADDRESS}`);
    
    try {
        const code = await web3.eth.getCode(REVOCATION_MANAGER_ADDRESS);
        if (code === '0x' || code === '0x0') {
            console.log(`❌ NO CONTRACT at this address!`);
        } else {
            console.log(`✅ Contract exists (${code.length} bytes)`);
        }
    } catch (error) {
        console.log(`❌ Contract check failed: ${error.message}`);
    }
    
    console.log(`\n5️⃣  TRANSACTION SIMULATION`);
    console.log('─'.repeat(60));
    
    try {
        const code = await web3.eth.getCode(VEHICLE_REGISTRY_ADDRESS);
        if (code !== '0x' && code !== '0x0') {
            const vehicleRegistry = new web3.eth.Contract(VehicleRegistryABI, VEHICLE_REGISTRY_ADDRESS);
            const testPseudonym = web3.utils.keccak256(`test_${Date.now()}`).substring(0, 42);
            
            console.log(`Testing registration with pseudonym: ${testPseudonym}`);
            
            try {
                // Try to estimate gas
                const gasEstimate = await vehicleRegistry.methods
                    .registerVehicle(testPseudonym)
                    .estimateGas({ from: account.address });
                    
                console.log(`✅ Gas estimate successful: ${gasEstimate}`);
                console.log(`   This means the transaction SHOULD work!`);
            } catch (estimateError) {
                console.log(`❌ Gas estimation failed (transaction would revert):`);
                console.log(`   ${estimateError.message}`);
                
                // Try to extract revert reason
                if (estimateError.message.includes('revert')) {
                    console.log(`\n   Common reasons for revert:`);
                    console.log(`   • Vehicle already registered`);
                    console.log(`   • Owner already has a vehicle registered`);
                    console.log(`   • Contract is paused`);
                    console.log(`   • Access control restrictions`);
                }
            }
        } else {
            console.log(`⏭️  Skipped (contract doesn't exist)`);
        }
    } catch (error) {
        console.log(`❌ Simulation failed: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSIS COMPLETE\n');
}
diagnose().catch(console.error);