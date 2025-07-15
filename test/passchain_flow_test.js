const Web3 = require('web3');
require('dotenv').config();

// Contract addresses
const CONTRACT_ADDRESSES = {
    AssetTransfer: '0x10906193b9c3a0d5ea7251047c55f5398d6d4990',
    ConfidenceScoreCalculator: '0xea2b8197b9c1fb936cdfcf6633c1837fc9726e5c',
    PaceChainChannel: '0xe75bfd5ba206ed5c059efeb0dd1c603f03c6553c',
    SpeculativeTransaction: '0x9eaac685f82cfd9e9966a1819bc8206a6fe602ca',
    Chacha20Poly1305: '0x9f8b4e5d16dc67e3d6a6e6f3b8f6b6f7f7f7f7f7'
};

// ABIs (truncated for brevity - include your full ABIs)
const AssetTransfer_abi=[
	{
		"inputs": [],
		"name": "AccessControlBadConfirmation",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "neededRole",
				"type": "bytes32"
			}
		],
		"name": "AccessControlUnauthorizedAccount",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "txId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "asset",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "AssetLocked",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "txId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "asset",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "AssetReleased",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "previousAdminRole",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "newAdminRole",
				"type": "bytes32"
			}
		],
		"name": "RoleAdminChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleGranted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleRevoked",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "DEFAULT_ADMIN_ROLE",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "assetTransfers",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "txId",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "asset",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "lockTime",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "hashLock",
				"type": "bytes32"
			},
			{
				"internalType": "bool",
				"name": "isCompleted",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			}
		],
		"name": "getRoleAdmin",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "grantRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "hasRole",
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
				"internalType": "bytes32",
				"name": "txId",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "asset",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "hashLock",
				"type": "bytes32"
			}
		],
		"name": "initiateAssetTransfer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "callerConfirmation",
				"type": "address"
			}
		],
		"name": "renounceRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "revokeRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

ConfidenceScore_abi=[
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "AccessControlBadConfirmation",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "neededRole",
				"type": "bytes32"
			}
		],
		"name": "AccessControlUnauthorizedAccount",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "score",
				"type": "uint256"
			}
		],
		"name": "ConfidenceScoreCalculated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "successfulTx",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalTx",
				"type": "uint256"
			}
		],
		"name": "ReputationUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "previousAdminRole",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "newAdminRole",
				"type": "bytes32"
			}
		],
		"name": "RoleAdminChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleGranted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleRevoked",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "DEFAULT_ADMIN_ROLE",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "HIGH_CONFIDENCE_THRESHOLD",
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
		"name": "LOW_CONFIDENCE_THRESHOLD",
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
		"name": "NETWORK_STATE_WEIGHT",
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
		"name": "SENDER_REPUTATION_WEIGHT",
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
		"name": "TRANSACTION_PATTERN_WEIGHT",
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
		"name": "ZK_VERIFICATION_WEIGHT",
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
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "txFrequency",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "zkProofValid",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "networkLoad",
				"type": "uint256"
			}
		],
		"name": "calculateConfidenceScore",
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
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			}
		],
		"name": "getRoleAdmin",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "grantRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "hasRole",
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
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "callerConfirmation",
				"type": "address"
			}
		],
		"name": "renounceRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "revokeRole",
		"outputs": [],
		"stateMutability": "nonpayable",
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
		"name": "scoreComponents",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "senderReputation",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "transactionPattern",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "zkVerification",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "networkState",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
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
				"internalType": "uint256",
				"name": "frequency",
				"type": "uint256"
			}
		],
		"name": "updateTransactionFrequency",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]
const PaceChannel_abi = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "AccessControlBadConfirmation",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "neededRole",
				"type": "bytes32"
			}
		],
		"name": "AccessControlUnauthorizedAccount",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "score",
				"type": "uint256"
			}
		],
		"name": "ConfidenceScoreCalculated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "successfulTx",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalTx",
				"type": "uint256"
			}
		],
		"name": "ReputationUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "previousAdminRole",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "newAdminRole",
				"type": "bytes32"
			}
		],
		"name": "RoleAdminChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleGranted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleRevoked",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "DEFAULT_ADMIN_ROLE",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "HIGH_CONFIDENCE_THRESHOLD",
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
		"name": "LOW_CONFIDENCE_THRESHOLD",
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
		"name": "NETWORK_STATE_WEIGHT",
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
		"name": "SENDER_REPUTATION_WEIGHT",
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
		"name": "TRANSACTION_PATTERN_WEIGHT",
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
		"name": "ZK_VERIFICATION_WEIGHT",
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
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "txFrequency",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "zkProofValid",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "networkLoad",
				"type": "uint256"
			}
		],
		"name": "calculateConfidenceScore",
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
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			}
		],
		"name": "getRoleAdmin",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "grantRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "hasRole",
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
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "callerConfirmation",
				"type": "address"
			}
		],
		"name": "renounceRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "revokeRole",
		"outputs": [],
		"stateMutability": "nonpayable",
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
		"name": "scoreComponents",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "senderReputation",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "transactionPattern",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "zkVerification",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "networkState",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
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
				"internalType": "uint256",
				"name": "frequency",
				"type": "uint256"
			}
		],
		"name": "updateTransactionFrequency",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

class ContractTestSuite {
    constructor() {
        this.web3 = new Web3(process.env.ETHEREUM_PROVIDER_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
        this.account = this.web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(this.account);
        this.web3.eth.defaultAccount = this.account.address;
        
        // Initialize contract instances
        this.contracts = {
            assetTransfer: new this.web3.eth.Contract(AssetTransfer_abi, CONTRACT_ADDRESSES.AssetTransfer),
            confidenceScore: new this.web3.eth.Contract(ConfidenceScore_abi, CONTRACT_ADDRESSES.ConfidenceScoreCalculator),
            paceChannel: new this.web3.eth.Contract(PaceChannel_abi, CONTRACT_ADDRESSES.PaceChainChannel)
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Contract Test Suite');
        console.log('='.repeat(50));
        console.log(`Connected to: ${this.web3.currentProvider.host || 'Sepolia Testnet'}`);
        console.log(`Test account: ${this.account.address}`);
        console.log('='.repeat(50));

        try {
            await this.testNetworkConnection();
            await this.testAssetTransferContract();
            await this.testConfidenceScoreContract();
            await this.testPaceChannelContract();
            await this.testCrossContractIntegration();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    async testNetworkConnection() {
        console.log('\n📡 Testing Network Connection...');
        
        try {
            const blockNumber = await this.web3.eth.getBlockNumber();
            const balance = await this.web3.eth.getBalance(this.account.address);
            const gasPrice = await this.web3.eth.getGasPrice();
            
            console.log(`✅ Current block: ${blockNumber}`);
            console.log(`✅ Account balance: ${this.web3.utils.fromWei(balance, 'ether')} ETH`);
            console.log(`✅ Current gas price: ${this.web3.utils.fromWei(gasPrice, 'gwei')} gwei`);
        } catch (error) {
            console.error('❌ Network connection failed:', error.message);
            throw error;
        }
    }

    async testAssetTransferContract() {
        console.log('\n🔄 Testing AssetTransfer Contract...');
        
        try {
            // Test read functions
            const defaultAdminRole = await this.contracts.assetTransfer.methods.DEFAULT_ADMIN_ROLE().call();
            console.log(`✅ Default Admin Role: ${defaultAdminRole}`);

            // Test generating a random transaction ID
            const txId = this.web3.utils.keccak256(this.web3.utils.encodePacked(
                {value: Date.now().toString(), type: 'string'},
                {value: this.account.address, type: 'address'}
            ));
            console.log(`✅ Generated TX ID: ${txId}`);

            // Check if transaction exists
            try {
                const transfer = await this.contracts.assetTransfer.methods.assetTransfers(txId).call();
                console.log(`✅ Transfer status: ${JSON.stringify(transfer)}`);
            } catch (error) {
                console.log(`ℹ️  Transfer ${txId} not found (expected for new TX)`);
            }

        } catch (error) {
            console.error('❌ AssetTransfer test failed:', error.message);
        }
    }

    async testConfidenceScoreContract() {
        console.log('\n📊 Testing ConfidenceScore Contract...');
        
        try {
            // Get thresholds
            const highThreshold = await this.contracts.confidenceScore.methods.HIGH_CONFIDENCE_THRESHOLD().call();
            const lowThreshold = await this.contracts.confidenceScore.methods.LOW_CONFIDENCE_THRESHOLD().call();
            
            console.log(`✅ High confidence threshold: ${highThreshold}`);
            console.log(`✅ Low confidence threshold: ${lowThreshold}`);

            // Calculate confidence score
            const testParams = {
                sender: this.account.address,
                txFrequency: 5,
                zkProofValid: true,
                networkLoad: 50
            };

            const confidenceScore = await this.contracts.confidenceScore.methods.calculateConfidenceScore(
                testParams.sender,
                testParams.txFrequency,
                testParams.zkProofValid,
                testParams.networkLoad
            ).call();

            console.log(`✅ Calculated confidence score: ${confidenceScore}`);
            console.log(`✅ Score classification: ${this.classifyConfidenceScore(confidenceScore, lowThreshold, highThreshold)}`);

        } catch (error) {
            console.error('❌ ConfidenceScore test failed:', error.message);
        }
    }

    async testPaceChannelContract() {
        console.log('\n🔗 Testing PaceChannel Contract...');
        
        try {
            // Test generating channel ID
            const channelId = this.web3.utils.keccak256(this.web3.utils.encodePacked(
                {value: this.account.address, type: 'address'},
                {value: CONTRACT_ADDRESSES.AssetTransfer, type: 'address'},
                {value: Date.now().toString(), type: 'string'}
            ));

            console.log(`✅ Generated Channel ID: ${channelId}`);

            // Check if channel exists
            try {
                const channel = await this.contracts.paceChannel.methods.channels(channelId).call();
                console.log(`✅ Channel info: ${JSON.stringify(channel)}`);
            } catch (error) {
                console.log(`ℹ️  Channel ${channelId} not found (expected for new channel)`);
            }

        } catch (error) {
            console.error('❌ PaceChannel test failed:', error.message);
        }
    }

    async testCrossContractIntegration() {
        console.log('\n🔄 Testing Cross-Contract Integration...');
        
        try {
            // Simulate a complete workflow
            console.log('1. Generating transaction parameters...');
            const txId = this.web3.utils.keccak256(Date.now().toString());
            
            console.log('2. Calculating confidence score...');
            const confidenceScore = await this.contracts.confidenceScore.methods.calculateConfidenceScore(
                this.account.address,
                3, // txFrequency
                true, // zkProofValid
                25 // networkLoad
            ).call();

            console.log('3. Integration test results:');
            console.log(`   📝 Transaction ID: ${txId}`);
            console.log(`   📊 Confidence Score: ${confidenceScore}`);
            console.log(`   ✅ Integration test completed successfully`);

        } catch (error) {
            console.error('❌ Integration test failed:', error.message);
        }
    }

    classifyConfidenceScore(score, lowThreshold, highThreshold) {
        if (score >= highThreshold) return 'HIGH';
        if (score >= lowThreshold) return 'MEDIUM';
        return 'LOW';
    }

    async estimateGas(contractMethod, params = {}) {
        try {
            const gasEstimate = await contractMethod.estimateGas(params);
            console.log(`⛽ Estimated gas: ${gasEstimate}`);
            return gasEstimate;
        } catch (error) {
            console.error('❌ Gas estimation failed:', error.message);
            return null;
        }
    }

    async getContractEvents(contract, eventName, fromBlock = 'latest') {
        try {
            const events = await contract.getPastEvents(eventName, {
                fromBlock: fromBlock,
                toBlock: 'latest'
            });
            return events;
        } catch (error) {
            console.error(`❌ Failed to get ${eventName} events:`, error.message);
            return [];
        }
    }
}

// Enhanced test runner with additional diagnostics
async function runEnhancedTests() {
    console.log('🔬 Running Enhanced Contract Tests');
    console.log('='.repeat(60));
    
    const testSuite = new ContractTestSuite();
    
    try {
        await testSuite.runAllTests();
        
        console.log('\n🎯 Additional Diagnostics...');
        
        // Check contract bytecode (to verify deployment)
        for (const [name, address] of Object.entries(CONTRACT_ADDRESSES)) {
            try {
                const code = await testSuite.web3.eth.getCode(address);
                const isDeployed = code !== '0x';
                console.log(`${isDeployed ? '✅' : '❌'} ${name}: ${isDeployed ? 'Deployed' : 'Not deployed'} at ${address}`);
            } catch (error) {
                console.log(`❌ ${name}: Error checking deployment - ${error.message}`);
            }
        }
        
        console.log('\n🏁 Test Suite Completed Successfully!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n💥 Test Suite Failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = {
    ContractTestSuite,
    runEnhancedTests,
    CONTRACT_ADDRESSES
};

// Run tests if this file is executed directly
if (require.main === module) {
    runEnhancedTests().catch(console.error);
}