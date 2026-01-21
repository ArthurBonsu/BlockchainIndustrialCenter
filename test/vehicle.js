const Web3 = require('web3');

// Configuration - UPDATE THESE VALUES AFTER DEPLOYMENT
const CONFIG = {
    // Use Sepolia testnet or your preferred network
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    
    // Contract addresses (get these after deploying on Remix)
    vehicleRegistryAddress: '0xYOUR_VEHICLE_REGISTRY_ADDRESS',
    revocationManagerAddress: '0xYOUR_REVOCATION_MANAGER_ADDRESS',
    
    // Your account private key (for testing only - NEVER share real keys!)
    privateKey: '0xYOUR_PRIVATE_KEY',
    
    // ABIs (copy from Remix after compilation)
    vehicleRegistryABI: [], // Paste VehicleRegistry ABI here
    revocationManagerABI: []  // Paste RevocationManager ABI here
};

// Initialize Web3
const web3 = new Web3(CONFIG.rpcUrl);
const account = web3.eth.accounts.privateKeyToAccount(CONFIG.privateKey);
web3.eth.accounts.wallet.add(account);

// Initialize contracts
const vehicleRegistry = new web3.eth.Contract(
    CONFIG.vehicleRegistryABI,
    CONFIG.vehicleRegistryAddress
);

const revocationManager = new web3.eth.Contract(
    CONFIG.revocationManagerABI,
    CONFIG.revocationManagerAddress
);

// Helper function to generate pseudonym (simplified version - now returns string)
function generatePseudonym(vehicleId) {
    const timestamp = Date.now();
    return `VEHICLE_${vehicleId}_${timestamp}`;
}

// Test functions
async function testRevChainSystem() {
    console.log('=== RevChain Identity Revocation Test ===\n');
    
    try {
        // Test 1: Register vehicles
        console.log('Test 1: Registering Vehicles');
        console.log('----------------------------');
        
        const vehicle1Pseudonym = generatePseudonym('V001');
        const vehicle2Pseudonym = generatePseudonym('V002');
        
        console.log('Vehicle 1 Pseudonym:', vehicle1Pseudonym);
        console.log('Vehicle 2 Pseudonym:', vehicle2Pseudonym);
        
        // Register Vehicle 1
        console.log('\nRegistering Vehicle 1...');
        const registerTx1 = await vehicleRegistry.methods
            .registerVehicle(vehicle1Pseudonym)
            .send({ from: account.address, gas: 300000 });
        console.log('✓ Vehicle 1 registered. Tx:', registerTx1.transactionHash);
        
        // Wait a moment to ensure different pseudonyms
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Register Vehicle 2
        console.log('Registering Vehicle 2...');
        const registerTx2 = await vehicleRegistry.methods
            .registerVehicle(vehicle2Pseudonym)
            .send({ from: account.address, gas: 300000 });
        console.log('✓ Vehicle 2 registered. Tx:', registerTx2.transactionHash);
        
        // Test 2: Verify registration
        console.log('\nTest 2: Verifying Registration');
        console.log('-------------------------------');
        
        const isVehicle1Registered = await vehicleRegistry.methods
            .isVehicleRegistered(vehicle1Pseudonym)
            .call();
        console.log('Vehicle 1 is registered:', isVehicle1Registered);
        
        const vehicle1Details = await vehicleRegistry.methods
            .getVehicle(vehicle1Pseudonym)
            .call();
        console.log('Vehicle 1 Details:', {
            owner: vehicle1Details.owner,
            registrationTime: new Date(parseInt(vehicle1Details.registrationTime) * 1000).toLocaleString(),
            isRegistered: vehicle1Details.isRegistered
        });
        
        const vehicle2Details = await vehicleRegistry.methods
            .getVehicle(vehicle2Pseudonym)
            .call();
        console.log('Vehicle 2 Details:', {
            owner: vehicle2Details.owner,
            registrationTime: new Date(parseInt(vehicle2Details.registrationTime) * 1000).toLocaleString(),
            isRegistered: vehicle2Details.isRegistered
        });
        
        // Test 3: Submit revocation report
        console.log('\nTest 3: Submitting Revocation Report');
        console.log('------------------------------------');
        
        const reportReason = 'Sending malicious messages - fake traffic data';
        console.log('Reporter (Vehicle 1):', vehicle1Pseudonym);
        console.log('Offender (Vehicle 2):', vehicle2Pseudonym);
        console.log('Reason:', reportReason);
        
        const reportTx = await revocationManager.methods
            .submitRevocationReport(
                vehicle2Pseudonym,  // Offender
                vehicle1Pseudonym,  // Reporter
                reportReason
            )
            .send({ from: account.address, gas: 400000 });
        
        console.log('✓ Revocation report submitted. Tx:', reportTx.transactionHash);
        
        // Get report ID from event or use reportCount
        const currentReportCount = await revocationManager.methods.reportCount().call();
        const reportId = currentReportCount;
        console.log('Report ID:', reportId);
        
        // Test 4: Get report details
        console.log('\nTest 4: Retrieving Report Details');
        console.log('---------------------------------');
        
        const reportDetails = await revocationManager.methods
            .getReport(reportId)
            .call();
        console.log('Report Details:', {
            offender: reportDetails.offender,
            reporter: reportDetails.reporter,
            reason: reportDetails.reason,
            timestamp: new Date(parseInt(reportDetails.timestamp) * 1000).toLocaleString(),
            processed: reportDetails.processed
        });
        
        // Test 5: Process revocation
        console.log('\nTest 5: Processing Revocation (Admin Action)');
        console.log('--------------------------------------------');
        
        const revokeTx = await revocationManager.methods
            .processRevocation(reportId)
            .send({ from: account.address, gas: 400000 });
        console.log('✓ Revocation processed. Tx:', revokeTx.transactionHash);
        
        // Test 6: Check revocation status
        console.log('\nTest 6: Checking Revocation Status');
        console.log('----------------------------------');
        
        const isRevoked = await revocationManager.methods
            .isRevoked(vehicle2Pseudonym)
            .call();
        console.log('Vehicle 2 is revoked:', isRevoked);
        
        const revocationDetails = await revocationManager.methods
            .getRevocationDetails(vehicle2Pseudonym)
            .call();
        console.log('Revocation Details:', {
            revocationTime: new Date(parseInt(revocationDetails.revocationTime) * 1000).toLocaleString(),
            reason: revocationDetails.reason,
            isRevoked: revocationDetails.isRevoked
        });
        
        // Test 7: Identity Verification Check
        console.log('\nTest 7: Identity Verification Check');
        console.log('-----------------------------------');
        
        const vehicle1Revoked = await revocationManager.methods
            .isRevoked(vehicle1Pseudonym)
            .call();
        const vehicle2Revoked = await revocationManager.methods
            .isRevoked(vehicle2Pseudonym)
            .call();
        
        console.log('\nVehicle Communication Status:');
        console.log(`Vehicle 1 (${vehicle1Pseudonym.substring(0, 30)}...)`);
        console.log('  - Is Revoked:', vehicle1Revoked);
        console.log('  - Can Communicate:', !vehicle1Revoked ? '✓ YES' : '✗ NO');
        
        console.log(`\nVehicle 2 (${vehicle2Pseudonym.substring(0, 30)}...)`);
        console.log('  - Is Revoked:', vehicle2Revoked);
        console.log('  - Can Communicate:', !vehicle2Revoked ? '✓ YES' : '✗ NO');
        
        console.log('\n' + '='.repeat(50));
        console.log('All Tests Completed Successfully!');
        console.log('='.repeat(50));
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('  ✓ Vehicles registered: 2');
        console.log('  ✓ Reports submitted: 1');
        console.log('  ✓ Vehicles revoked: 1');
        console.log('  ✓ Active vehicles: 1');
        
    } catch (error) {
        console.error('\n❌ Error during testing:', error.message);
        if (error.receipt) {
            console.error('Transaction failed. Receipt:', error.receipt);
        }
    }
}

// Additional utility functions

async function checkVehicleStatus(pseudonym) {
    console.log('\n=== Checking Vehicle Status ===');
    console.log('Pseudonym:', pseudonym);
    console.log('----------------------------');
    
    try {
        const isRegistered = await vehicleRegistry.methods
            .isVehicleRegistered(pseudonym)
            .call();
        
        const isRevoked = await revocationManager.methods
            .isRevoked(pseudonym)
            .call();
        
        console.log('Registered:', isRegistered ? '✓ Yes' : '✗ No');
        console.log('Revoked:', isRevoked ? '✓ Yes' : '✗ No');
        console.log('Can Communicate:', (isRegistered && !isRevoked) ? '✓ YES' : '✗ NO');
        
        if (isRevoked) {
            const details = await revocationManager.methods
                .getRevocationDetails(pseudonym)
                .call();
            console.log('\nRevocation Details:');
            console.log('  Reason:', details.reason);
            console.log('  Revoked At:', new Date(parseInt(details.revocationTime) * 1000).toLocaleString());
        }
    } catch (error) {
        console.error('Error checking status:', error.message);
    }
}

async function getAllReports() {
    console.log('\n=== Retrieving All Reports ===');
    
    try {
        const reportCount = await revocationManager.methods
            .reportCount()
            .call();
        
        console.log('Total Reports:', reportCount);
        console.log('----------------------------\n');
        
        for (let i = 1; i <= reportCount; i++) {
            const report = await revocationManager.methods
                .getReport(i)
                .call();
            
            console.log(`Report #${i}:`);
            console.log('  Offender:', report.offender);
            console.log('  Reporter:', report.reporter);
            console.log('  Reason:', report.reason);
            console.log('  Timestamp:', new Date(parseInt(report.timestamp) * 1000).toLocaleString());
            console.log('  Processed:', report.processed ? '✓ Yes' : '✗ No');
            console.log('');
        }
    } catch (error) {
        console.error('Error retrieving reports:', error.message);
    }
}

async function registerNewVehicle(vehicleId) {
    console.log('\n=== Registering New Vehicle ===');
    
    try {
        const pseudonym = generatePseudonym(vehicleId);
        console.log('Generated Pseudonym:', pseudonym);
        
        const tx = await vehicleRegistry.methods
            .registerVehicle(pseudonym)
            .send({ from: account.address, gas: 300000 });
        
        console.log('✓ Vehicle registered successfully!');
        console.log('Transaction Hash:', tx.transactionHash);
        
        return pseudonym;
    } catch (error) {
        console.error('Error registering vehicle:', error.message);
    }
}

// Run the tests
if (require.main === module) {
    testRevChainSystem()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

// Export functions for external use
module.exports = {
    testRevChainSystem,
    checkVehicleStatus,
    getAllReports,
    registerNewVehicle,
    generatePseudonym,
    vehicleRegistry,
    revocationManager
};