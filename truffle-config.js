require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

/**
 * Builds an HDWalletProvider from whichever wallet secret is set in .env —
 * MNEMONIC or PRIVATE_KEY, matching what each network below already used.
 *
 * `rpcUrl` is checked here too, so a network whose RPC URL didn't resolve
 * (no INFURA_PROJECT_ID, or no NEXT_PUBLIC_TATUM_API_KEY) fails with one
 * clear message instead of a cryptic error from deep inside
 * HDWalletProvider/web3.
 */
function walletProvider(rpcUrl, missingRpcMessage) {
  return () => {
    if (!rpcUrl) {
      throw new Error(missingRpcMessage);
    }
    if (process.env.MNEMONIC) {
      return new HDWalletProvider(process.env.MNEMONIC, rpcUrl);
    }
    if (process.env.PRIVATE_KEY) {
      return new HDWalletProvider([process.env.PRIVATE_KEY], rpcUrl);
    }
    throw new Error(
      "Set either MNEMONIC or PRIVATE_KEY in .env before deploying to a public network."
    );
  };
}

const sepoliaRpcUrl = process.env.INFURA_PROJECT_ID
  ? `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
  : undefined;

// FIX: Tatum's gateway needs its API key on every request, but
// @truffle/hdwallet-provider has no native `headers` option (confirmed by
// reading its installed source — there's no `headers` field anywhere in
// its constructor types or implementation). The original version of this
// file passed `headers: { 'x-api-key': ... }` into HDWalletProvider's
// constructor — that gets silently ignored, so the request goes out
// unauthenticated and fails (typically a 401/403 from Tatum, or a vague
// "could not connect" from Truffle). Fixed by putting the key in the URL
// instead, via Tatum's own documented `?xApiKey=` query-param fallback
// (checked against Tatum's auth docs) — no extra dependency needed.
const tatumRpcUrl = process.env.NEXT_PUBLIC_TATUM_API_KEY
  ? `https://ethereum-sepolia.gateway.tatum.io/?xApiKey=${encodeURIComponent(
      process.env.NEXT_PUBLIC_TATUM_API_KEY
    )}`
  : undefined;

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      gas: 6721975,
      gasPrice: 20000000000,
    },

    sepolia: {
      provider: walletProvider(
        sepoliaRpcUrl,
        "No Sepolia RPC URL configured — set INFURA_PROJECT_ID in .env."
      ),
      network_id: 11155111, // Correct for Sepolia
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },

    tatum_testnet: {
      provider: walletProvider(
        tatumRpcUrl,
        "No Tatum API key configured — set NEXT_PUBLIC_TATUM_API_KEY in .env."
      ),
      network_id: 11155111, // Same chain as `sepolia` — different RPC provider only
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true, // added for parity with `sepolia` — original file didn't set this here
    },
  },

  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  ccontracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",
  migrations_directory: "./migrations",

  db: {
    enabled: false,
  },
};