const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

const VEHICLE_REGISTRY_ADDRESS = '0x93C9164A7667aA62ad101940a5A9D2D21cCbCFEF';
const REVOCATION_MANAGER_ADDRESS = '0xbb6700BB98DA1E63B3dFb5Eb8Ca7EbB6E1d5Cd77';

// ✅ UPDATED ABIs from Remix
const VehicleRegistryABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRemoved","type":"event"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"getPseudonymByOwner","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"getVehicle","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"registrationTime","type":"uint256"},{"internalType":"bool","name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"isVehicleRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"ownerToPseudonym","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"registerVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"removeVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"vehicles","outputs":[{"internalType":"string","name":"pseudonym","type":"string"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"registrationTime","type":"uint256"},{"internalType":"bool","name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"}];

const RevocationManagerABI = [{"inputs":[{"internalType":"address","name":"_vehicleRegistryAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"reportId","type":"uint256"},{"indexed":false,"internalType":"string","name":"offender","type":"string"},{"indexed":false,"internalType":"string","name":"reporter","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ReportSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleReinstated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"string","name":"reason","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRevoked","type":"event"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_reportId","type":"uint256"}],"name":"getReport","outputs":[{"internalType":"string","name":"offender","type":"string"},{"internalType":"string","name":"reporter","type":"string"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"processed","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"getRevocationDetails","outputs":[{"internalType":"uint256","name":"revocationTime","type":"uint256"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"bool","name":"isRevoked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"identityRevocationList","outputs":[{"internalType":"string","name":"pseudonym","type":"string"},{"internalType":"uint256","name":"revocationTime","type":"uint256"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"bool","name":"isRevoked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"isRevoked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_reportId","type":"uint256"}],"name":"processRevocation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"reinstateVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"reportCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"reports","outputs":[{"internalType":"string","name":"offenderPseudonym","type":"string"},{"internalType":"string","name":"reporterPseudonym","type":"string"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"processed","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_offenderPseudonym","type":"string"},{"internalType":"string","name":"_reporterPseudonym","type":"string"},{"internalType":"string","name":"_reason","type":"string"}],"name":"submitRevocationReport","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"vehicleRegistry","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

class RevChainTest {
    constructor() {
        this.web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);

        const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
            ? process.env.PRIVATE_KEY
            : '0x' + process.env.PRIVATE_KEY;
        this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        this.web3.eth.accounts.wallet.add(this.account);

        this.vehicleRegistry = new this.web3.eth.Contract(VehicleRegistryABI, VEHICLE_REGISTRY_ADDRESS);
        this.revocationManager = new this.web3.eth.Contract(RevocationManagerABI, REVOCATION_MANAGER_ADDRESS);

        this.results = {
            metadata: {
                experimentName: "RevChain: Blockchain-based Identity Revocation for Vehicular Networks",
                timestamp: new Date().toISOString(),
                network: "Sepolia Testnet",
                account: this.account.address
            },
            experiments: {
                registration: [],
                revocation: [],
                blockHeaderValidation: []
            }
        };
    }

    generatePseudonym(index) {
        const timestamp = Date.now();
        const randomData = `vehicle_${timestamp}_${index}_${Math.random()}`;
        return this.web3.utils.keccak256(randomData).substring(0, 42);
    }

    async wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ✅ NEW: Remove existing vehicle if account already has one registered
    async clearExistingVehicle() {
        console.log('\n🧹 Checking for existing vehicle registration...');
        try {
            const existing = await this.vehicleRegistry.methods.getPseudonymByOwner(this.account.address).call();
            if (existing && existing !== '') {
                console.log(`⚠️  Found existing vehicle: ${existing}`);
                console.log('   Removing it first...');
                const tx = await this.vehicleRegistry.methods.removeVehicle(existing).send({
                    from: this.account.address,
                    gas: 200000
                });
                console.log(`✅ Removed | Tx: ${tx.transactionHash.substring(0, 20)}...`);
                await this.wait(3000);
            } else {
                console.log('✅ No existing vehicle found, ready to register');
            }
        } catch (error) {
            console.log(`ℹ️  Could not check existing vehicle: ${error.message.substring(0, 60)}`);
        }
    }

    async testRegistration(numVehicles = 5) {
        console.log('\n' + '='.repeat(60));
        console.log('📝 [Experiment 1] Vehicle Registration');
        console.log('='.repeat(60));

        const data = {
            type: "Vehicle Registration",
            transactions: [],
            metrics: { totalGas: 0, avgGas: 0, successRate: 0 }
        };

        let successCount = 0;
        const pseudonyms = [];

        for (let i = 0; i < numVehicles; i++) {
            const pseudonym = this.generatePseudonym(i);
            pseudonyms.push(pseudonym);
            console.log(`\n[${i + 1}/${numVehicles}] Registering vehicle...`);
            console.log(`   Pseudonym: ${pseudonym}`);

            try {
                // ✅ Step 1: Remove existing vehicle if any (contract allows 1 per owner)
                const existing = await this.vehicleRegistry.methods.getPseudonymByOwner(this.account.address).call();
                if (existing && existing !== '') {
                    console.log(`   ♻️  Removing previous vehicle first...`);
                    await this.vehicleRegistry.methods.removeVehicle(existing).send({
                        from: this.account.address,
                        gas: 200000
                    });
                    await this.wait(3000);
                }

                // ✅ Step 2: Register new vehicle
                const tx = await this.vehicleRegistry.methods.registerVehicle(pseudonym).send({
                    from: this.account.address,
                    gas: 300000
                });

                const gasUsed = parseInt(tx.gasUsed);
                data.transactions.push({
                    index: i + 1,
                    pseudonym,
                    txHash: tx.transactionHash,
                    gasUsed,
                    status: 'success'
                });

                data.metrics.totalGas += gasUsed;
                successCount++;

                console.log(`   ✅ Success | Gas: ${gasUsed} | Tx: ${tx.transactionHash.substring(0, 20)}...`);

            } catch (error) {
                console.log(`   ❌ Failed: ${error.message.substring(0, 80)}`);
                data.transactions.push({
                    index: i + 1,
                    pseudonym,
                    status: 'failed',
                    error: error.message
                });
            }

            if (i < numVehicles - 1) {
                console.log('   ⏳ Waiting 3 seconds...');
                await this.wait(3000);
            }
        }

        data.metrics.successRate = (successCount / numVehicles) * 100;
        data.metrics.avgGas = successCount > 0 ? Math.round(data.metrics.totalGas / successCount) : 0;
        this.results.experiments.registration.push(data);

        console.log(`\n📊 Summary: ${successCount}/${numVehicles} successful (${data.metrics.successRate.toFixed(1)}%)`);
        console.log(`   Avg Gas: ${data.metrics.avgGas}`);

        // ✅ Return ALL pseudonyms that were attempted (for revocation test)
        // The last registered one is still active on-chain
        return data;
    }

    async testRevocation(numRevocations = 3) {
        console.log('\n' + '='.repeat(60));
        console.log('🚫 [Experiment 2] Revocation');
        console.log('='.repeat(60));

        const data = {
            type: "Revocation",
            reports: [],
            processing: [],
            metrics: { successRate: 0 }
        };

        // ✅ Register fresh vehicles specifically for revocation test
        console.log('\n🔧 Preparing vehicles for revocation test...');
        const vehiclePseudonyms = [];

        // Register offender vehicles (register → save pseudonym → remove → register next)
        for (let i = 0; i < numRevocations + 1; i++) {
            const pseudonym = this.generatePseudonym(100 + i);

            try {
                // Remove existing if any
                const existing = await this.vehicleRegistry.methods.getPseudonymByOwner(this.account.address).call();
                if (existing && existing !== '') {
                    await this.vehicleRegistry.methods.removeVehicle(existing).send({
                        from: this.account.address,
                        gas: 200000
                    });
                    await this.wait(3000);
                }

                await this.vehicleRegistry.methods.registerVehicle(pseudonym).send({
                    from: this.account.address,
                    gas: 300000
                });

                vehiclePseudonyms.push(pseudonym);
                console.log(`   ✅ Vehicle ${i + 1} registered: ${pseudonym}`);
                await this.wait(3000);

            } catch (error) {
                console.log(`   ❌ Vehicle ${i + 1} failed: ${error.message.substring(0, 60)}`);
            }
        }

        if (vehiclePseudonyms.length < 2) {
            console.log('❌ Not enough vehicles registered for revocation test');
            this.results.experiments.revocation.push(data);
            return data;
        }

        const targetPseudonyms = vehiclePseudonyms.slice(0, numRevocations);
        const reporterPseudonym = vehiclePseudonyms[vehiclePseudonyms.length - 1];
        const reportIds = [];
        let successCount = 0;

        // Phase 1: Submit reports
        console.log('\n📋 Phase 1: Submitting Reports...');
        for (let i = 0; i < targetPseudonyms.length; i++) {
            console.log(`\n[${i + 1}/${targetPseudonyms.length}] Submitting report...`);

            try {
                const tx = await this.revocationManager.methods
                    .submitRevocationReport(targetPseudonyms[i], reporterPseudonym, "Malicious behavior")
                    .send({ from: this.account.address, gas: 300000 });

                const reportId = tx.events?.ReportSubmitted
                    ? parseInt(tx.events.ReportSubmitted.returnValues.reportId)
                    : null;

                if (reportId !== null) reportIds.push(reportId);

                data.reports.push({ index: i + 1, reportId, txHash: tx.transactionHash, status: 'success' });
                console.log(`   ✅ Report ID: ${reportId}`);

            } catch (error) {
                console.log(`   ❌ Failed: ${error.message.substring(0, 80)}`);
                data.reports.push({ index: i + 1, status: 'failed', error: error.message });
            }

            if (i < targetPseudonyms.length - 1) await this.wait(3000);
        }

        // Phase 2: Process revocations
        console.log('\n⚙️  Phase 2: Processing Revocations...');
        for (let i = 0; i < reportIds.length; i++) {
            console.log(`\n[${i + 1}/${reportIds.length}] Processing report ${reportIds[i]}...`);

            try {
                const tx = await this.revocationManager.methods
                    .processRevocation(reportIds[i])
                    .send({ from: this.account.address, gas: 300000 });

                data.processing.push({ index: i + 1, reportId: reportIds[i], txHash: tx.transactionHash, status: 'success' });
                successCount++;
                console.log(`   ✅ Processed`);

            } catch (error) {
                console.log(`   ❌ Failed: ${error.message.substring(0, 80)}`);
                data.processing.push({ index: i + 1, reportId: reportIds[i], status: 'failed', error: error.message });
            }

            if (i < reportIds.length - 1) await this.wait(3000);
        }

        // Phase 3: Validate
        console.log('\n🔍 Phase 3: Validating Revocations...');
        for (let i = 0; i < targetPseudonyms.length; i++) {
            try {
                const isRevoked = await this.revocationManager.methods.isRevoked(targetPseudonyms[i]).call();
                console.log(`   ${isRevoked ? '✅' : '❌'} Vehicle ${i + 1}: isRevoked = ${isRevoked}`);
            } catch (error) {
                console.log(`   ❌ Validation failed for vehicle ${i + 1}`);
            }
        }

        data.metrics.successRate = reportIds.length > 0 ? (successCount / reportIds.length) * 100 : 0;
        this.results.experiments.revocation.push(data);

        console.log(`\n📊 Summary: ${successCount}/${reportIds.length} revocations processed (${data.metrics.successRate.toFixed(1)}%)`);
        return data;
    }

    async testBlockValidation(numBlocks = 10) {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 [Experiment 3] Block Header Validation (PHNBH)');
        console.log('='.repeat(60) + '\n');

        const data = {
            type: "PHNBH",
            validations: [],
            metrics: { successRate: 0 }
        };

        const latestBlock = await this.web3.eth.getBlockNumber();
        let successCount = 0;

        for (let i = 0; i < numBlocks; i++) {
            const blockNum = latestBlock - BigInt(i);

            try {
                const [currentBlock, parentBlock] = await Promise.all([
                    this.web3.eth.getBlock(blockNum),
                    this.web3.eth.getBlock(blockNum - BigInt(1))
                ]);

                const isValid = parentBlock.hash === currentBlock.parentHash;
                if (isValid) successCount++;

                data.validations.push({ blockNumber: blockNum.toString(), isValid });
                console.log(`${isValid ? '✅' : '❌'} Block ${blockNum}`);

            } catch (error) {
                console.log(`❌ Block ${blockNum} failed`);
                data.validations.push({ blockNumber: blockNum.toString(), isValid: false });
            }
        }

        data.metrics.successRate = (successCount / numBlocks) * 100;
        this.results.experiments.blockHeaderValidation.push(data);

        console.log(`\n📊 Summary: ${successCount}/${numBlocks} valid (${data.metrics.successRate.toFixed(1)}%)`);
        return data;
    }

    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `results/revchain_${timestamp}.json`;

        if (!fs.existsSync('results')) fs.mkdirSync('results');

        fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
        console.log(`\n💾 Results saved: ${filename}`);
        return filename;
    }

    async runAllTests() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 RevChain Blockchain Identity Revocation Experiment');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`🌐 Network: Sepolia Testnet`);
        console.log(`👤 Account: ${this.account.address}`);
        console.log('='.repeat(60));

        try {
            // Experiment 1: Registration
            await this.testRegistration(5);

            // Experiment 2: Revocation
            await this.testRevocation(3);

            // Experiment 3: Block Validation
            await this.testBlockValidation(10);

            console.log('\n' + '='.repeat(60));
            console.log('✅ All experiments complete');
            console.log('='.repeat(60));

            this.saveResults();

        } catch (error) {
            console.error('\n❌ Experiment failed:', error.message);
            this.saveResults();
        }
    }
}

async function main() {
    const test = new RevChainTest();
    await test.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { RevChainTest };
