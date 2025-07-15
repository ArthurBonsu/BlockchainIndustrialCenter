const { Web3 } = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class UncertaintyAnalyticsManager {
    constructor(web3, uncertaintyAddress, requestManagerAddress, responseManagerAddress) {
        this.web3 = web3;
        this.BASE_COST = this.web3.utils.toWei('0.001', 'ether');
        this.MAX_PROCESSING_TIME = 86400; // 1 day in seconds

        // Contract addresses from environment variables
        this.uncertaintyAddress = uncertaintyAddress;
        this.requestManagerAddress = requestManagerAddress;
        this.responseManagerAddress = responseManagerAddress;

        // Contract instances
        this.uncertaintyContract = null;
        this.requestManagerContract = null;
        this.responseManagerContract = null;

        // Account setup
        this.account = null;
    }

    // Contract ABIs (placeholder - replace with actual ABIs)
    _getUncertaintyAnalyticsABI() {
        return [
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_processingTime",
				"type": "uint256"
			}
		],
		"name": "calculateUnavailabilityCost",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "contract UncertaintyBase",
				"name": "_base",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "cost",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "costType",
				"type": "string"
			}
		],
		"name": "CostRecorded",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_cost",
				"type": "uint256"
			}
		],
		"name": "updateDataHoldingCost",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_level",
				"type": "uint256"
			}
		],
		"name": "updateDisruptionLevel",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_level",
				"type": "uint256"
			}
		],
		"name": "updateEscalationLevel",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "dataHoldingCost",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "disruptionLevel",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "escalationLevel",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "unavailabilityCost",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
    }

    _getRequestManagerABI() {
        return [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_analytics",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "FundsWithdrawn",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "requester",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "RequestSubmitted",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "submitRequest",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_additionalInfo",
				"type": "string"
			}
		],
		"name": "submitRequestWithInfo",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [],
		"name": "getAnalyticsMetrics",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "avgProcessingTime",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "successRate",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalCost",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "disruptionCount",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "VERSION",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
    }

    _getResponseManagerABI() {
        return [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_analytics",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "FundsWithdrawn",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "requestId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "responder",
				"type": "address"
			}
		],
		"name": "ResponseSubmitted",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "VERSION",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getAnalyticsMetrics",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "avgProcessingTime",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "successRate",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalCost",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "disruptionCount",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_responder",
				"type": "address"
			}
		],
		"name": "getResponderCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "count",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "processedRequests",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "responderCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_requestId",
				"type": "uint256"
			}
		],
		"name": "submitResponse",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_requestId",
				"type": "uint256"
			}
		],
		"name": "submitResponseWithCalculation",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
];
    }

    // Setup account method
    async setupAccount() {
        try {
            // Prioritize PRIVATE_KEY
            const privateKey = process.env.PRIVATE_KEY;
            const walletAddress = process.env.WALLET_ADDRESS;
            const mnemonic = process.env.MNEMONIC;

            if (privateKey) {
                // Ensure private key starts with 0x
                const formattedPrivateKey = privateKey.startsWith('0x') 
                    ? privateKey 
                    : `0x${privateKey}`;

                // Create account from private key
                const account = this.web3.eth.accounts.privateKeyToAccount(formattedPrivateKey);
                this.account = account.address;
                
                // Add to wallet
                this.web3.eth.accounts.wallet.add(account);
                this.web3.eth.defaultAccount = this.account;
            } else if (walletAddress) {
                // Use provided wallet address
                this.account = this.web3.utils.toChecksumAddress(walletAddress);
                this.web3.eth.defaultAccount = this.account;
            } else if (mnemonic) {
                // Fallback to mnemonic
                const provider = new HDWalletProvider({
                    mnemonic: mnemonic,
                    providerOrUrl: this.web3.currentProvider.host
                });

                // Get accounts from mnemonic
                const accounts = await provider.getAddresses();
                
                // Use the first account
                this.account = accounts[0];
                this.web3.eth.defaultAccount = this.account;
            } else {
                throw new Error('No account configuration found. Provide PRIVATE_KEY, WALLET_ADDRESS, or MNEMONIC');
            }

            console.log(`Using account: ${this.account}`);
            
            // Check account balance
            const balance = await this.web3.eth.getBalance(this.account);
            console.log(`Account Balance: ${this.web3.utils.fromWei(balance, 'ether')} ETH`);

            return this.account;
        } catch (error) {
            console.error('Error setting up account:', error);
            throw error;
        }
    }

    // Load contracts method
    async loadContracts() {
        try {
            // Ensure account is set up
            await this.setupAccount();

            this.uncertaintyContract = new this.web3.eth.Contract(
                this._getUncertaintyAnalyticsABI(), 
                this.uncertaintyAddress
            );
            
            this.requestManagerContract = new this.web3.eth.Contract(
                this._getRequestManagerABI(), 
                this.requestManagerAddress
            );
            
            this.responseManagerContract = new this.web3.eth.Contract(
                this._getResponseManagerABI(), 
                this.responseManagerAddress
            );

            console.log("Contracts loaded successfully");
            return {
                uncertaintyContract: this.uncertaintyContract,
                requestManagerContract: this.requestManagerContract,
                responseManagerContract: this.responseManagerContract
            };
        } catch (error) {
            console.error("Error loading contracts:", error);
            throw error;
        }
    }

    // Submit request method
    async submitRequest(valueInEth, additionalInfo = '') {
        console.log(`Submitting request with value ${valueInEth} ETH`);
        
        if (!this.account) {
            await this.setupAccount();
        }

        try {
            // Convert value to wei
            const valueInWei = this.web3.utils.toWei(valueInEth.toString(), 'ether');
            
            // Prepare transaction parameters
            const txParams = {
                from: this.account,
                value: valueInWei,
                gas: 200000
            };

            // Submit request
            let tx;
            if (additionalInfo) {
                console.log(`Using submitRequestWithInfo: ${additionalInfo}`);
                tx = await this.requestManagerContract.methods
                    .submitRequestWithInfo(additionalInfo)
                    .send(txParams);
            } else {
                console.log("Using standard submitRequest");
                tx = await this.requestManagerContract.methods
                    .submitRequest()
                    .send(txParams);
            }

            // Extract request ID 
            const requestId = tx.transactionHash; // or use event logs if available
            
            console.log(`Request submitted. Request Hash: ${requestId}`);
            return requestId;
        } catch (error) {
            console.error("Error submitting request:", error);
            throw error;
        }
    }

    // Submit response method
    async submitResponse(requestId, withCalculation = false) {
        console.log(`Submitting response for request ID ${requestId}`);
        
        if (!this.account) {
            await this.setupAccount();
        }

        try {
            // Prepare transaction parameters
            const txParams = {
                from: this.account,
                gas: 200000
            };

            // Submit response
            await this.responseManagerContract.methods
                .submitResponse(requestId)
                .send(txParams);

            console.log(`Response submitted for request ID: ${requestId}`);
            return true;
        } catch (error) {
            console.error("Error submitting response:", error);
            throw error;
        }
    }

    // Get metrics method
    async getMetrics() {
        console.log("Retrieving metrics");
        
        try {
            // Ensure contracts are loaded
            if (!this.uncertaintyContract) {
                await this.loadContracts();
            }

            // Get metrics from UncertaintyAnalytics contract
            const metrics = await this.uncertaintyContract.methods.getMetrics().call();
            
            const result = {
                avgProcessingTime: metrics[0],
                successRate: metrics[1],
                totalCost: this.web3.utils.fromWei(metrics[2], 'ether'),
                disruptionCount: metrics[3]
            };
            
            console.log("--- Analytics Metrics ---");
            console.log(`Average Processing Time: ${result.avgProcessingTime} seconds`);
            console.log(`Success Rate: ${result.successRate}%`);
            console.log(`Total Cost: ${result.totalCost} ETH`);
            console.log(`Disruption Count: ${result.disruptionCount}`);
            
            return result;
        } catch (error) {
            console.error("Error getting metrics:", error);
            throw error;
        }
    }
}

// Web3 connection function
// Web3 connection function
async function createWeb3Connection(network = 'sepolia') {
    const infuraProjectId = process.env.INFURA_PROJECT_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const walletAddress = process.env.WALLET_ADDRESS;
    const mnemonic = process.env.MNEMONIC;

    if (!infuraProjectId) {
        throw new Error('INFURA_PROJECT_ID not found in environment variables');
    }

    const providerUrl = `https://${network}.infura.io/v3/${infuraProjectId}`;
    
    let web3Provider;
    if (privateKey) {
        // Ensure private key starts with 0x
        const formattedPrivateKey = privateKey.startsWith('0x') 
            ? privateKey 
            : `0x${privateKey}`;

        // Use private key provider
        web3Provider = new HDWalletProvider({
            privateKeys: [formattedPrivateKey],
            providerOrUrl: providerUrl
        });
    } else if (walletAddress) {
        // Use standard HTTP provider if wallet address is provided
        web3Provider = new Web3.providers.HttpProvider(providerUrl);
    } else if (mnemonic) {
        // Create provider with mnemonic
        web3Provider = new HDWalletProvider({
            mnemonic: mnemonic,
            providerOrUrl: providerUrl
        });
    } else {
        throw new Error('No account configuration found. Provide PRIVATE_KEY, WALLET_ADDRESS, or MNEMONIC');
    }

    // Create Web3 instance
    const web3 = new Web3(web3Provider);

    return web3;
}

// Main execution function
async function main() {
    try {
        // Contract addresses
        const UNCERTAINTY_ANALYTICS_ADDRESS = "0xafb69d3380aa2a892625665803fca627fd65ec0f";
        const REQUEST_MANAGER_ADDRESS = "0xc5491f090181c8653ec0228d07499a51d7bf12bd";
        const RESPONSE_MANAGER_ADDRESS = "0xfda50ab71b0e577680c4afe29fdc2272ab19d89b";

        // Create Web3 connection
        const web3 = await createWeb3Connection('sepolia');

        // Initialize the manager
        const manager = new UncertaintyAnalyticsManager(
            web3, 
            UNCERTAINTY_ANALYTICS_ADDRESS,
            REQUEST_MANAGER_ADDRESS,
            RESPONSE_MANAGER_ADDRESS
        );

        // Load contracts
        await manager.loadContracts();

        // Sample requests
        const requests = [
            { value: 0.002, info: "High priority processing" },
            { value: 0.005, info: "Requires detailed analytics" },
            { value: 0.0015, info: "Standard processing" }
        ];

        // Process requests
        const requestIds = [];
        for (const req of requests) {
            try {
                const requestId = await manager.submitRequest(req.value, req.info);
                requestIds.push(requestId);
            } catch (reqError) {
                console.error('Request submission error:', reqError);
            }
        }

        // Submit responses
        for (const requestId of requestIds.slice(0, 3)) {
            try {
                await manager.submitResponse(requestId);
            } catch (respError) {
                console.error('Response submission error:', respError);
            }
        }

        // Get metrics
        try {
            const metrics = await manager.getMetrics();
            console.log('Metrics:', metrics);
        } catch (metricsError) {
            console.error('Metrics retrieval error:', metricsError);
        }

    } catch (error) {
        console.error('Main execution error:', error);
    }
}

// Run the main function
main();

module.exports = {
    UncertaintyAnalyticsManager,
    createWeb3Connection
};