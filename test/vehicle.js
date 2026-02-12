const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const VEHICLE_REGISTRY_ADDRESS = '0x93C9164A7667aA62ad101940a5A9D2D21cCbCFEF';
const REVOCATION_MANAGER_ADDRESS = '0xbb6700BB98DA1E63B3dFb5Eb8Ca7EbB6E1d5Cd77';

const VehicleRegistryABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRemoved","type":"event"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"getPseudonymByOwner","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"getVehicle","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"registrationTime","type":"uint256"},{"internalType":"bool","name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"isVehicleRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"ownerToPseudonym","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"registerVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"removeVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"vehicles","outputs":[{"internalType":"string","name":"pseudonym","type":"string"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"registrationTime","type":"uint256"},{"internalType":"bool","name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"}];

const RevocationManagerABI = [{"inputs":[{"internalType":"address","name":"_vehicleRegistryAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"reportId","type":"uint256"},{"indexed":false,"internalType":"string","name":"offender","type":"string"},{"indexed":false,"internalType":"string","name":"reporter","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ReportSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleReinstated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"pseudonym","type":"string"},{"indexed":false,"internalType":"string","name":"reason","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRevoked","type":"event"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_reportId","type":"uint256"}],"name":"getReport","outputs":[{"internalType":"string","name":"offender","type":"string"},{"internalType":"string","name":"reporter","type":"string"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"processed","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"getRevocationDetails","outputs":[{"internalType":"uint256","name":"revocationTime","type":"uint256"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"bool","name":"isRevoked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"identityRevocationList","outputs":[{"internalType":"string","name":"pseudonym","type":"string"},{"internalType":"uint256","name":"revocationTime","type":"uint256"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"bool","name":"isRevoked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"isRevoked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_reportId","type":"uint256"}],"name":"processRevocation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_pseudonym","type":"string"}],"name":"reinstateVehicle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"reportCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"reports","outputs":[{"internalType":"string","name":"offenderPseudonym","type":"string"},{"internalType":"string","name":"reporterPseudonym","type":"string"},{"internalType":"string","name":"reason","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"bool","name":"processed","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_offenderPseudonym","type":"string"},{"internalType":"string","name":"_reporterPseudonym","type":"string"},{"internalType":"string","name":"_reason","type":"string"}],"name":"submitRevocationReport","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"vehicleRegistry","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

class RevChainTest {
    constructor() {
        this.web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);

        // Wallet 1 (Primary) - Reporter vehicle
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
            ? process.env.PRIVATE_KEY
            : '0x' + process.env.PRIVATE_KEY;
        this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        this.web3.eth.accounts.wallet.add(this.account);

        // Wallet 2 (Secondary) - Offender vehicles (if provided)
        this.account2 = null;
        if (process.env.WALLET2_MNEMONIC || process.env.WALLET2_PRIVATE_KEY) {
            if (process.env.WALLET2_MNEMONIC) {
                // Create from mnemonic
                const wallet2 = this.web3.eth.accounts.wallet.create(1, process.env.WALLET2_MNEMONIC);
                this.account2 = wallet2[0];
            } else if (process.env.WALLET2_PRIVATE_KEY) {
                // Create from private key
                const privKey2 = process.env.WALLET2_PRIVATE_KEY.startsWith('0x')
                    ? process.env.WALLET2_PRIVATE_KEY
                    : '0x' + process.env.WALLET2_PRIVATE_KEY;
                this.account2 = this.web3.eth.accounts.privateKeyToAccount(privKey2);
                this.web3.eth.accounts.wallet.add(this.account2);
            }
        }

        this.vehicleRegistry = new this.web3.eth.Contract(VehicleRegistryABI, VEHICLE_REGISTRY_ADDRESS);
        this.revocationManager = new this.web3.eth.Contract(RevocationManagerABI, REVOCATION_MANAGER_ADDRESS);

        this.results = {
            metadata: {
                experimentName: "RevChain: Blockchain-based Identity Revocation for Vehicular Networks",
                timestamp: new Date().toISOString(),
                network: "Sepolia Testnet",
                contractAddresses: {
                    vehicleRegistry: VEHICLE_REGISTRY_ADDRESS,
                    revocationManager: REVOCATION_MANAGER_ADDRESS
                },
                accounts: {
                    primary: this.account.address,
                    secondary: this.account2 ? this.account2.address : null
                }
            },
            experiments: {
                registration: [],
                revocation: [],
                blockHeaderValidation: [],
                contractState: [],
                performanceMetrics: []
            }
        };

        // Results folder setup
        this.resultsDir = path.join(process.cwd(), 'revchain-results');
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    generatePseudonym(index) {
        const timestamp = Date.now();
        const randomData = `vehicle_${timestamp}_${index}_${Math.random()}`;
        return this.web3.utils.keccak256(randomData).substring(0, 42);
    }

    async wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async estimateGasWithBuffer(method, params = {}) {
        try {
            const estimated = await method.estimateGas(params);
            return Math.floor(Number(estimated) * 1.2); // 20% buffer
        } catch (error) {
            console.log(`   ⚠️  Gas estimation failed: ${error.message.substring(0, 50)}...`);
            return 500000; // Increased fallback gas limit
        }
    }

    async clearExistingVehicle() {
        try {
            const existing = await this.vehicleRegistry.methods.getPseudonymByOwner(this.account.address).call();
            if (existing && existing !== '') {
                console.log(`   ♻️  Removing existing vehicle: ${existing.substring(0, 20)}...`);
                await this.vehicleRegistry.methods.removeVehicle(existing).send({
                    from: this.account.address,
                    gas: 200000
                });
                await this.wait(3000);
            }
        } catch (error) {
            // Ignore errors - vehicle might not exist
        }
    }

    async testRegistration(numVehicles = 5) {
        console.log('\n' + '='.repeat(60));
        console.log('📝 [Experiment 1] Vehicle Registration');
        console.log('='.repeat(60));

        const data = {
            type: "Vehicle Registration",
            transactions: [],
            metrics: { totalGas: 0, avgGas: 0, successRate: 0, totalTime: 0 }
        };

        let successCount = 0;
        const startTime = Date.now();

        for (let i = 0; i < numVehicles; i++) {
            const pseudonym = this.generatePseudonym(i);
            console.log(`\n[${i + 1}/${numVehicles}] Registering vehicle...`);
            console.log(`   Pseudonym: ${pseudonym}`);

            try {
                await this.clearExistingVehicle();

                const txStartTime = Date.now();
                const tx = await this.vehicleRegistry.methods.registerVehicle(pseudonym).send({
                    from: this.account.address,
                    gas: 300000
                });
                const txTime = Date.now() - txStartTime;

                const gasUsed = parseInt(tx.gasUsed);
                data.transactions.push({
                    index: i + 1,
                    pseudonym,
                    txHash: tx.transactionHash,
                    gasUsed,
                    timeMs: txTime,
                    blockNumber: tx.blockNumber,
                    status: 'success'
                });

                data.metrics.totalGas += gasUsed;
                successCount++;

                console.log(`   ✅ Success | Gas: ${gasUsed} | Time: ${txTime}ms | Tx: ${tx.transactionHash.substring(0, 20)}...`);

            } catch (error) {
                console.log(`   ❌ Failed: ${error.message.substring(0, 80)}`);
                data.transactions.push({
                    index: i + 1,
                    pseudonym,
                    status: 'failed',
                    error: error.message
                });
            }

            if (i < numVehicles - 1) await this.wait(3000);
        }

        data.metrics.totalTime = Date.now() - startTime;
        data.metrics.avgGas = successCount > 0 ? Math.floor(data.metrics.totalGas / successCount) : 0;
        data.metrics.successRate = (successCount / numVehicles) * 100;
        this.results.experiments.registration.push(data);

        console.log(`\n📊 Summary: ${successCount}/${numVehicles} successful (${data.metrics.successRate.toFixed(1)}%)`);
        console.log(`   Avg Gas: ${data.metrics.avgGas}`);
        console.log(`   Total Time: ${data.metrics.totalTime}ms`);
        return data;
    }

    // ✅ OPTIMIZED: Two-wallet revocation approach
    async testRevocation(numTests = 3) {
        console.log('\n' + '='.repeat(60));
        console.log('🚫 [Experiment 2] Identity Revocation');
        console.log('='.repeat(60));

        const data = {
            type: "Identity Revocation",
            setup: [],
            reports: [],
            processing: [],
            validation: [],
            metrics: { setupSuccess: 0, reportsSuccess: 0, processSuccess: 0, totalTime: 0 }
        };

        const startTime = Date.now();

        // Check if second wallet is available
        if (!this.account2) {
            console.log('\n⚠️  WARNING: Second wallet not configured!');
            console.log('   Add WALLET2_MNEMONIC or WALLET2_PRIVATE_KEY to .env file');
            console.log('   Falling back to single-wallet mode (may have limitations)');
            console.log('');
        }

        // Step 1: Setup - Register reporter (Wallet 1) and offenders (Wallet 2)
        console.log('\n🔧 Phase 1: Setup - Registering vehicles...');
        
        const reporterPseudonym = this.generatePseudonym(9999);
        const offenderPseudonyms = [];
        
        // Register reporter with Wallet 1
        try {
            console.log(`   📝 [Wallet 1] Registering reporter: ${reporterPseudonym.substring(0, 22)}...`);
            
            // Clear any existing vehicle for wallet 1
            const existing1 = await this.vehicleRegistry.methods.getPseudonymByOwner(this.account.address).call();
            if (existing1 && existing1 !== '') {
                console.log(`      ♻️  Removing existing vehicle first...`);
                await this.vehicleRegistry.methods.removeVehicle(existing1).send({
                    from: this.account.address,
                    gas: 200000
                });
                await this.wait(3000);
            }
            
            const tx = await this.vehicleRegistry.methods.registerVehicle(reporterPseudonym).send({
                from: this.account.address,
                gas: 300000
            });
            
            data.setup.push({
                type: 'reporter',
                wallet: 'primary',
                pseudonym: reporterPseudonym,
                txHash: tx.transactionHash,
                status: 'success'
            });
            data.metrics.setupSuccess++;
            
            console.log(`      ✅ Reporter registered | Tx: ${tx.transactionHash.substring(0, 22)}...`);
            await this.wait(5000);
            
        } catch (error) {
            console.log(`      ❌ Failed: ${error.message.substring(0, 60)}`);
            data.setup.push({
                type: 'reporter',
                wallet: 'primary',
                status: 'failed',
                error: error.message
            });
        }

        // Register offender vehicles with Wallet 2 (or Wallet 1 if Wallet 2 not available)
        const offenderWallet = this.account2 || this.account;
        const walletLabel = this.account2 ? 'Wallet 2' : 'Wallet 1 (fallback)';
        
        if (this.account2) {
            console.log(`\n   💡 Using secondary wallet for offenders: ${this.account2.address}`);
        }
        
        for (let i = 0; i < numTests; i++) {
            const offenderPseudonym = this.generatePseudonym(8000 + i);
            offenderPseudonyms.push(offenderPseudonym);
            
            try {
                console.log(`\n   📝 [${walletLabel}] Registering offender ${i + 1}: ${offenderPseudonym.substring(0, 22)}...`);
                
                // Check if already registered
                const isRegistered = await this.vehicleRegistry.methods.isVehicleRegistered(offenderPseudonym).call();
                
                if (!isRegistered) {
                    // If using Wallet 2, check and clear its existing vehicle
                    if (this.account2 && i === 0) {
                        const existing2 = await this.vehicleRegistry.methods.getPseudonymByOwner(offenderWallet.address).call();
                        if (existing2 && existing2 !== '') {
                            console.log(`      ♻️  Clearing Wallet 2's existing vehicle...`);
                            await this.vehicleRegistry.methods.removeVehicle(existing2).send({
                                from: offenderWallet.address,
                                gas: 200000
                            });
                            await this.wait(3000);
                        }
                    }
                    
                    // If using same wallet (Wallet 1) for offenders, need to clear before each
                    if (!this.account2 && i > 0) {
                        await this.vehicleRegistry.methods.removeVehicle(offenderPseudonyms[i - 1]).send({
                            from: offenderWallet.address,
                            gas: 200000
                        });
                        await this.wait(3000);
                    }
                    
                    const tx = await this.vehicleRegistry.methods.registerVehicle(offenderPseudonym).send({
                        from: offenderWallet.address,
                        gas: 300000
                    });
                    
                    data.setup.push({
                        type: 'offender',
                        wallet: this.account2 ? 'secondary' : 'primary',
                        index: i + 1,
                        pseudonym: offenderPseudonym,
                        txHash: tx.transactionHash,
                        status: 'registered'
                    });
                    data.metrics.setupSuccess++;
                    
                    console.log(`      ✅ Registered | Tx: ${tx.transactionHash.substring(0, 22)}...`);
                    await this.wait(3000);
                } else {
                    data.setup.push({
                        type: 'offender',
                        index: i + 1,
                        pseudonym: offenderPseudonym,
                        status: 'already_exists'
                    });
                    console.log(`      ℹ️  Already registered`);
                }
                
            } catch (error) {
                console.log(`      ❌ Failed: ${error.message.substring(0, 60)}`);
                data.setup.push({
                    type: 'offender',
                    index: i + 1,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        // If using single wallet mode, re-register reporter
        if (!this.account2) {
            console.log(`\n   📝 [Wallet 1] Re-registering reporter (single-wallet mode)...`);
            try {
                if (offenderPseudonyms.length > 0) {
                    await this.vehicleRegistry.methods.removeVehicle(offenderPseudonyms[offenderPseudonyms.length - 1]).send({
                        from: this.account.address,
                        gas: 200000
                    });
                    await this.wait(3000);
                }
                
                await this.vehicleRegistry.methods.registerVehicle(reporterPseudonym).send({
                    from: this.account.address,
                    gas: 300000
                });
                console.log(`      ✅ Reporter re-registered`);
                await this.wait(5000);
            } catch (error) {
                console.log(`      ⚠️  Re-registration issue: ${error.message.substring(0, 60)}`);
            }
        }

        // Step 2: Submit reports
        console.log('\n📋 Phase 2: Submitting Revocation Reports...');
        const reportIds = [];

        for (let i = 0; i < offenderPseudonyms.length; i++) {
            console.log(`\n[${i + 1}/${numTests}] Submitting report...`);
            console.log(`   Reporter: ${reporterPseudonym.substring(0, 20)}...`);
            console.log(`   Offender: ${offenderPseudonyms[i].substring(0, 20)}...`);
            
            try {
                const reason = `Malicious behavior detected - Test ${i + 1}`;
                
                // ✅ FIX: Add detailed error logging
                const method = this.revocationManager.methods.submitRevocationReport(
                    offenderPseudonyms[i],
                    reporterPseudonym,
                    reason
                );
                
                // Estimate gas first
                let gasEstimate;
                try {
                    gasEstimate = await this.estimateGasWithBuffer(method, { from: this.account.address });
                    console.log(`   💡 Estimated gas: ${gasEstimate}`);
                } catch (estError) {
                    console.log(`   ⚠️  Gas estimation error: ${estError.message}`);
                    gasEstimate = 500000; // Increased fallback gas limit
                }
                
                const tx = await method.send({
                    from: this.account.address,
                    gas: gasEstimate
                });

                // Extract report ID from events
                const reportId = tx.events?.ReportSubmitted?.returnValues?.reportId || 
                                (await this.revocationManager.methods.reportCount().call()) - 1n;
                
                reportIds.push(reportId);

                data.reports.push({
                    index: i + 1,
                    reportId: reportId.toString(),
                    offender: offenderPseudonyms[i],
                    reporter: reporterPseudonym,
                    reason,
                    txHash: tx.transactionHash,
                    gasUsed: tx.gasUsed,
                    status: 'success'
                });
                data.metrics.reportsSuccess++;

                console.log(`   ✅ Report submitted | ID: ${reportId} | Tx: ${tx.transactionHash.substring(0, 20)}...`);

            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                // Log more details for debugging
                if (error.message.includes('revert')) {
                    console.log(`   🔍 Revert reason: Check contract requirements`);
                }
                data.reports.push({
                    index: i + 1,
                    offender: offenderPseudonyms[i],
                    reporter: reporterPseudonym,
                    status: 'failed',
                    error: error.message
                });
            }

            if (i < numTests - 1) await this.wait(5000);
        }

        // Step 3: Process revocations (only if we have successful reports)
        if (reportIds.length > 0) {
            console.log('\n⚙️  Phase 3: Processing Revocations...');
            
            for (let i = 0; i < reportIds.length; i++) {
                console.log(`\n[${i + 1}/${reportIds.length}] Processing report ID ${reportIds[i]}...`);
                
                try {
                    const tx = await this.revocationManager.methods.processRevocation(reportIds[i]).send({
                        from: this.account.address,
                        gas: 500000 // Increased from 400000
                    });

                    data.processing.push({
                        index: i + 1,
                        reportId: reportIds[i].toString(),
                        txHash: tx.transactionHash,
                        gasUsed: tx.gasUsed,
                        status: 'success'
                    });
                    data.metrics.processSuccess++;

                    console.log(`   ✅ Processed | Tx: ${tx.transactionHash.substring(0, 20)}...`);

                } catch (error) {
                    console.log(`   ❌ Failed: ${error.message.substring(0, 80)}`);
                    data.processing.push({
                        index: i + 1,
                        reportId: reportIds[i].toString(),
                        status: 'failed',
                        error: error.message
                    });
                }

                if (i < reportIds.length - 1) await this.wait(5000);
            }
        } else {
            console.log('\n⚠️  No reports to process - skipping processing phase');
        }

        // Step 4: Validate revocations
        console.log('\n🔍 Phase 4: Validating Revocation Status...');
        
        for (let i = 0; i < offenderPseudonyms.length; i++) {
            try {
                const isRevoked = await this.revocationManager.methods.isRevoked(offenderPseudonyms[i]).call();
                const details = await this.revocationManager.methods.getRevocationDetails(offenderPseudonyms[i]).call();
                
                data.validation.push({
                    index: i + 1,
                    pseudonym: offenderPseudonyms[i],
                    isRevoked,
                    revocationTime: details.revocationTime?.toString() || '0',
                    reason: details.reason || 'N/A'
                });
                
                console.log(`   ${isRevoked ? '✅' : '❌'} Vehicle ${i + 1}: ${isRevoked ? 'REVOKED' : 'NOT REVOKED'}`);
                if (isRevoked) {
                    console.log(`      Reason: ${details.reason}`);
                    console.log(`      Time: ${new Date(Number(details.revocationTime) * 1000).toLocaleString()}`);
                }
                
            } catch (error) {
                console.log(`   ❌ Validation failed for vehicle ${i + 1}: ${error.message.substring(0, 60)}`);
                data.validation.push({
                    index: i + 1,
                    pseudonym: offenderPseudonyms[i],
                    error: error.message
                });
            }
        }

        data.metrics.totalTime = Date.now() - startTime;
        this.results.experiments.revocation.push(data);

        console.log(`\n📊 Summary:`);
        console.log(`   Setup: ${data.metrics.setupSuccess} vehicles`);
        console.log(`   Reports: ${data.metrics.reportsSuccess}/${numTests} successful (${((data.metrics.reportsSuccess/numTests)*100).toFixed(1)}%)`);
        console.log(`   Processing: ${data.metrics.processSuccess}/${reportIds.length} successful (${reportIds.length > 0 ? ((data.metrics.processSuccess/reportIds.length)*100).toFixed(1) : 0}%)`);
        console.log(`   Total Time: ${data.metrics.totalTime}ms`);
        
        return data;
    }

    async testBlockValidation(numBlocks = 10) {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 [Experiment 3] Block Header Validation (PHNBH)');
        console.log('='.repeat(60) + '\n');

        const data = {
            type: "PHNBH Block Validation",
            validations: [],
            metrics: { successRate: 0, avgValidationTimeMs: 0 }
        };

        const latestBlock = await this.web3.eth.getBlockNumber();
        let successCount = 0;
        let totalTime = 0;

        for (let i = 0; i < numBlocks; i++) {
            const blockNum = latestBlock - BigInt(i);
            const startTime = Date.now();

            try {
                const [currentBlock, parentBlock] = await Promise.all([
                    this.web3.eth.getBlock(blockNum),
                    this.web3.eth.getBlock(blockNum - BigInt(1))
                ]);

                const validationTime = Date.now() - startTime;
                totalTime += validationTime;

                const isValid = parentBlock.hash === currentBlock.parentHash;
                if (isValid) successCount++;

                data.validations.push({
                    blockNumber: blockNum.toString(),
                    currentHash: currentBlock.hash,
                    parentHashInCurrent: currentBlock.parentHash,
                    actualParentHash: parentBlock.hash,
                    isValid,
                    validationTimeMs: validationTime
                });

                console.log(`${isValid ? '✅' : '❌'} Block ${blockNum} | Time: ${validationTime}ms`);

            } catch (error) {
                console.log(`❌ Block ${blockNum} failed: ${error.message.substring(0, 60)}`);
                data.validations.push({
                    blockNumber: blockNum.toString(),
                    isValid: false,
                    error: error.message
                });
            }
        }

        data.metrics.successRate = (successCount / numBlocks) * 100;
        data.metrics.avgValidationTimeMs = Math.floor(totalTime / numBlocks);
        this.results.experiments.blockHeaderValidation.push(data);

        console.log(`\n📊 Summary: ${successCount}/${numBlocks} valid (${data.metrics.successRate.toFixed(1)}%)`);
        console.log(`   Avg Validation Time: ${data.metrics.avgValidationTimeMs}ms`);
        return data;
    }

    // ✅ NEW: Contract state inspection
    async testContractState() {
        console.log('\n' + '='.repeat(60));
        console.log('🔎 [Experiment 4] Contract State Inspection');
        console.log('='.repeat(60) + '\n');

        const data = {
            type: "Contract State",
            registryState: {},
            revocationState: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Get admin address
            const admin = await this.revocationManager.methods.admin().call();
            console.log(`👤 Admin Address: ${admin}`);
            console.log(`👤 Test Account: ${this.account.address}`);
            console.log(`   Is Admin: ${admin.toLowerCase() === this.account.address.toLowerCase() ? '✅ Yes' : '❌ No'}`);

            // Get report count
            const reportCount = await this.revocationManager.methods.reportCount().call();
            console.log(`\n📊 Total Reports: ${reportCount}`);

            // Get current vehicle registration
            try {
                const currentPseudonym = await this.vehicleRegistry.methods.getPseudonymByOwner(this.account.address).call();
                if (currentPseudonym && currentPseudonym !== '') {
                    console.log(`\n🚗 Currently Registered Vehicle:`);
                    console.log(`   Pseudonym: ${currentPseudonym}`);
                    
                    const vehicleInfo = await this.vehicleRegistry.methods.getVehicle(currentPseudonym).call();
                    console.log(`   Owner: ${vehicleInfo.owner}`);
                    console.log(`   Registration Time: ${new Date(Number(vehicleInfo.registrationTime) * 1000).toLocaleString()}`);
                    console.log(`   Is Registered: ${vehicleInfo.isRegistered}`);
                    
                    // Check if revoked
                    const isRevoked = await this.revocationManager.methods.isRevoked(currentPseudonym).call();
                    console.log(`   Is Revoked: ${isRevoked}`);
                }
            } catch (error) {
                console.log(`\n🚗 No vehicle currently registered for this account`);
            }

            // Get recent reports
            if (reportCount > 0n) {
                console.log(`\n📋 Recent Reports:`);
                const recentCount = reportCount > 5n ? 5n : reportCount;
                for (let i = reportCount - recentCount; i < reportCount; i++) {
                    try {
                        const report = await this.revocationManager.methods.getReport(i).call();
                        console.log(`\n   Report #${i}:`);
                        console.log(`   Offender: ${report.offender.substring(0, 20)}...`);
                        console.log(`   Reporter: ${report.reporter.substring(0, 20)}...`);
                        console.log(`   Reason: ${report.reason}`);
                        console.log(`   Processed: ${report.processed}`);
                    } catch (error) {
                        console.log(`   ⚠️  Could not fetch report #${i}`);
                    }
                }
            }

            data.registryState = {
                contractAddress: VEHICLE_REGISTRY_ADDRESS
            };

            data.revocationState = {
                contractAddress: REVOCATION_MANAGER_ADDRESS,
                admin,
                reportCount: reportCount.toString(),
                isTestAccountAdmin: admin.toLowerCase() === this.account.address.toLowerCase()
            };

        } catch (error) {
            console.log(`\n❌ Error inspecting state: ${error.message}`);
            data.error = error.message;
        }

        this.results.experiments.contractState.push(data);
        return data;
    }

    // ✅ NEW: Performance metrics analysis
    async testPerformanceMetrics() {
        console.log('\n' + '='.repeat(60));
        console.log('⚡ [Experiment 5] Performance Metrics Analysis');
        console.log('='.repeat(60) + '\n');

        const data = {
            type: "Performance Metrics",
            operations: [],
            summary: {}
        };

        // Test 1: Single registration time
        console.log('📊 Testing single registration...');
        const regPseudonym = this.generatePseudonym(7777);
        await this.clearExistingVehicle();
        
        const regStart = Date.now();
        try {
            const tx = await this.vehicleRegistry.methods.registerVehicle(regPseudonym).send({
                from: this.account.address,
                gas: 300000
            });
            const regTime = Date.now() - regStart;
            
            data.operations.push({
                operation: 'register_vehicle',
                timeMs: regTime,
                gasUsed: parseInt(tx.gasUsed),
                blockNumber: tx.blockNumber,
                success: true
            });
            
            console.log(`   ✅ Registration: ${regTime}ms | Gas: ${tx.gasUsed}`);
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message.substring(0, 60)}`);
        }

        await this.wait(3000);

        // Test 2: Revocation check time
        console.log('\n📊 Testing revocation check...');
        const checkStart = Date.now();
        try {
            const isRevoked = await this.revocationManager.methods.isRevoked(regPseudonym).call();
            const checkTime = Date.now() - checkStart;
            
            data.operations.push({
                operation: 'check_revocation',
                timeMs: checkTime,
                result: isRevoked,
                success: true
            });
            
            console.log(`   ✅ Revocation Check: ${checkTime}ms | Result: ${isRevoked}`);
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message.substring(0, 60)}`);
        }

        // Test 3: Block retrieval time
        console.log('\n📊 Testing block retrieval...');
        const blockStart = Date.now();
        try {
            const block = await this.web3.eth.getBlock('latest');
            const blockTime = Date.now() - blockStart;
            
            data.operations.push({
                operation: 'get_block',
                timeMs: blockTime,
                blockNumber: block.number.toString(),
                success: true
            });
            
            console.log(`   ✅ Block Retrieval: ${blockTime}ms | Block: ${block.number}`);
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message.substring(0, 60)}`);
        }

        // Calculate summary
        const successful = data.operations.filter(op => op.success);
        if (successful.length > 0) {
            const avgTime = successful.reduce((sum, op) => sum + op.timeMs, 0) / successful.length;
            const avgGas = successful
                .filter(op => op.gasUsed)
                .reduce((sum, op) => sum + op.gasUsed, 0) / successful.filter(op => op.gasUsed).length;
            
            data.summary = {
                totalOperations: data.operations.length,
                successfulOperations: successful.length,
                avgTimeMs: Math.floor(avgTime),
                avgGas: Math.floor(avgGas)
            };
            
            console.log(`\n📊 Summary:`);
            console.log(`   Successful Operations: ${successful.length}/${data.operations.length}`);
            console.log(`   Average Time: ${Math.floor(avgTime)}ms`);
            console.log(`   Average Gas: ${Math.floor(avgGas)}`);
        }

        this.results.experiments.performanceMetrics.push(data);
        return data;
    }

    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sessionDir = path.join(this.resultsDir, `session_${timestamp}`);
        
        // Create session directory
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        // Custom JSON serializer that handles BigInt
        const jsonSerializer = (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        };

        // Save main results
        const mainResultsFile = path.join(sessionDir, 'complete_results.json');
        fs.writeFileSync(mainResultsFile, JSON.stringify(this.results, jsonSerializer, 2));

        // Save individual experiment results
        Object.keys(this.results.experiments).forEach(expType => {
            if (this.results.experiments[expType].length > 0) {
                const expFile = path.join(sessionDir, `${expType}.json`);
                fs.writeFileSync(expFile, JSON.stringify({
                    experimentType: expType,
                    data: this.results.experiments[expType],
                    metadata: this.results.metadata
                }, jsonSerializer, 2));
            }
        });

        // Save summary report
        const summary = this.generateSummaryReport();
        const summaryFile = path.join(sessionDir, 'SUMMARY.txt');
        fs.writeFileSync(summaryFile, summary);

        // Save session info
        const sessionInfo = {
            timestamp,
            directory: sessionDir,
            files: fs.readdirSync(sessionDir)
        };
        const sessionFile = path.join(this.resultsDir, 'latest_session.json');
        fs.writeFileSync(sessionFile, JSON.stringify(sessionInfo, jsonSerializer, 2));

        console.log(`\n💾 Results saved to: ${sessionDir}`);
        console.log(`   📄 Complete results: complete_results.json`);
        console.log(`   📄 Summary report: SUMMARY.txt`);
        console.log(`   📁 Individual experiments: ${Object.keys(this.results.experiments).length} files`);
        
        return sessionDir;
    }

    generateSummaryReport() {
        let report = '='.repeat(70) + '\n';
        report += 'RevChain Blockchain Identity Revocation - Experimental Results\n';
        report += '='.repeat(70) + '\n\n';
        
        report += `Experiment Date: ${new Date(this.results.metadata.timestamp).toLocaleString()}\n`;
        report += `Network: ${this.results.metadata.network}\n`;
        report += `Account: ${this.results.metadata.account}\n`;
        report += `Vehicle Registry: ${this.results.metadata.contractAddresses.vehicleRegistry}\n`;
        report += `Revocation Manager: ${this.results.metadata.contractAddresses.revocationManager}\n`;
        report += '\n' + '='.repeat(70) + '\n\n';

        // Registration summary
        if (this.results.experiments.registration.length > 0) {
            const regData = this.results.experiments.registration[0];
            report += 'EXPERIMENT 1: Vehicle Registration\n';
            report += '-'.repeat(70) + '\n';
            report += `Total Vehicles: ${regData.transactions.length}\n`;
            report += `Success Rate: ${regData.metrics.successRate.toFixed(1)}%\n`;
            report += `Average Gas: ${regData.metrics.avgGas}\n`;
            report += `Total Time: ${regData.metrics.totalTime}ms\n\n`;
        }

        // Revocation summary
        if (this.results.experiments.revocation.length > 0) {
            const revData = this.results.experiments.revocation[0];
            report += 'EXPERIMENT 2: Identity Revocation\n';
            report += '-'.repeat(70) + '\n';
            report += `Setup Success: ${revData.metrics.setupSuccess} vehicles\n`;
            report += `Reports Submitted: ${revData.metrics.reportsSuccess}\n`;
            report += `Revocations Processed: ${revData.metrics.processSuccess}\n`;
            report += `Total Time: ${revData.metrics.totalTime}ms\n\n`;
        }

        // Block validation summary
        if (this.results.experiments.blockHeaderValidation.length > 0) {
            const blockData = this.results.experiments.blockHeaderValidation[0];
            report += 'EXPERIMENT 3: Block Header Validation\n';
            report += '-'.repeat(70) + '\n';
            report += `Blocks Validated: ${blockData.validations.length}\n`;
            report += `Success Rate: ${blockData.metrics.successRate.toFixed(1)}%\n`;
            report += `Average Validation Time: ${blockData.metrics.avgValidationTimeMs}ms\n\n`;
        }

        // Performance metrics summary
        if (this.results.experiments.performanceMetrics.length > 0) {
            const perfData = this.results.experiments.performanceMetrics[0];
            if (perfData.summary) {
                report += 'EXPERIMENT 5: Performance Metrics\n';
                report += '-'.repeat(70) + '\n';
                report += `Total Operations: ${perfData.summary.totalOperations}\n`;
                report += `Successful Operations: ${perfData.summary.successfulOperations}\n`;
                report += `Average Time: ${perfData.summary.avgTimeMs}ms\n`;
                report += `Average Gas: ${perfData.summary.avgGas}\n\n`;
            }
        }

        report += '='.repeat(70) + '\n';
        report += 'End of Report\n';
        report += '='.repeat(70) + '\n';

        return report;
    }

    async runAllTests() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 RevChain Blockchain Identity Revocation Experiment');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`🌐 Network: Sepolia Testnet`);
        console.log(`👤 Primary Account: ${this.account.address}`);
        if (this.account2) {
            console.log(`👤 Secondary Account: ${this.account2.address}`);
        } else {
            console.log(`⚠️  Secondary Account: Not configured (add WALLET2_MNEMONIC or WALLET2_PRIVATE_KEY)`);
        }
        console.log(`📁 Results Directory: ${this.resultsDir}`);
        console.log('='.repeat(60));

        try {
            // Experiment 1: Registration
            await this.testRegistration(5);

            // Experiment 2: Revocation (with fixes)
            await this.testRevocation(3);

            // Experiment 3: Block Validation
            await this.testBlockValidation(10);

            // Experiment 4: Contract State
            await this.testContractState();

            // Experiment 5: Performance Metrics
            await this.testPerformanceMetrics();

            console.log('\n' + '='.repeat(60));
            console.log('✅ All experiments complete');
            console.log('='.repeat(60));

            const savedLocation = this.saveResults();
            
            // Print final summary
            console.log('\n' + '='.repeat(60));
            console.log('📊 FINAL SUMMARY');
            console.log('='.repeat(60));
            console.log(`Results saved in: ${savedLocation}`);
            console.log(`View complete results: ${path.join(savedLocation, 'complete_results.json')}`);
            console.log(`View summary: ${path.join(savedLocation, 'SUMMARY.txt')}`);
            console.log('='.repeat(60) + '\n');

        } catch (error) {
            console.error('\n❌ Experiment failed:', error.message);
            console.error('Stack trace:', error.stack);
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