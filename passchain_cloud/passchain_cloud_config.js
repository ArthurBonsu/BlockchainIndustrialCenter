/**
 * PassChain Cloud Configuration
 * 
 * Configuration settings for Google Cloud Run deployment
 * Reads from root .env file using PASSCHAIN_GCP_PROJECT_ID to avoid naming conflicts
 */

module.exports = {
    // Cloud Run Configuration
    cloudRun: {
        serviceName: 'passchain-cloud-service',
        region: process.env.PASSCHAIN_CLOUD_RUN_REGION || 'us-central1',
        platform: 'managed',
        memory: '2Gi',
        cpu: '2',
        concurrency: 10,
        maxInstances: 5,
        minInstances: 0,
        timeout: 900 // 15 minutes
    },

    // Google Cloud Project Settings (uses custom env var to avoid conflicts)
    googleCloud: {
        projectId: process.env.PASSCHAIN_GCP_PROJECT_ID,
        region: process.env.PASSCHAIN_CLOUD_RUN_REGION || 'us-central1',
        serviceName: 'passchain-cloud-service'
    },

    // Blockchain Configuration (from root .env)
    blockchains: {
        ethereum: {
            network: 'sepolia',
            rpcUrl: process.env.ETHEREUM_RPC_URL,
            privateKey: process.env.ETHEREUM_PRIVATE_KEY,
            contracts: {
                AssetTransfer: process.env.ASSET_TRANSFER_ADDRESS || '0x10906193b9c3a0d5ea7251047c55f5398d6d4990',
                ConfidenceScoreCalculator: process.env.CONFIDENCE_CALCULATOR_ADDRESS || '0xea2b8197b9c1fb936cdfcf6633c1837fc9726e5c',
                PaceChainChannel: process.env.PACCHAIN_CHANNEL_ADDRESS || '0xe75bfd5ba206ed5c059efeb0dd1c603f03c6553c',
                SpeculativeTransaction: process.env.SPECULATIVE_TX_ADDRESS || '0x9eaac685f82cfd9e9966a1819bc8206a6fe602ca'
            }
        },
        polkadot: {
            network: 'rococo',
            wsUrl: process.env.POLKADOT_WS_URL || 'wss://rococo-rpc.polkadot.io'
        }
    },

    // Test Configuration (from root .env)
    testing: {
        maxConcurrentTests: parseInt(process.env.PASSCHAIN_MAX_CONCURRENT_TESTS) || 5,
        testTimeout: parseInt(process.env.PASSCHAIN_TEST_TIMEOUT) || 300000, // 5 minutes
        retryAttempts: 3,
        cleanupInterval: 3600000, // 1 hour
        resultRetentionTime: 86400000 // 24 hours
    },

    // Environment Variables Required (with PassChain prefixes to avoid conflicts)
    requiredEnvVars: [
        'ETHEREUM_RPC_URL',
        'POLKADOT_WS_URL',
        'PASSCHAIN_GCP_PROJECT_ID'
    ],

    // Optional Environment Variables
    optionalEnvVars: {
        PASSCHAIN_LOG_LEVEL: process.env.PASSCHAIN_LOG_LEVEL || 'info',
        NODE_ENV: process.env.NODE_ENV || 'production',
        PASSCHAIN_MAX_PAYLOAD_SIZE: process.env.PASSCHAIN_MAX_PAYLOAD_SIZE || '10mb',
        PASSCHAIN_CORS_ORIGIN: process.env.PASSCHAIN_CORS_ORIGIN || '*'
    },

    // Monitoring & Metrics
    monitoring: {
        healthCheckInterval: 30000, // 30 seconds
        metricsRetentionTime: 3600000, // 1 hour
        enableDetailedLogging: process.env.NODE_ENV !== 'production'
    },

    // Security Settings
    security: {
        enableCors: true,
        corsOrigin: process.env.PASSCHAIN_CORS_ORIGIN || '*',
        rateLimiting: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        }
    }
};