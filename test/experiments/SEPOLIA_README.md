# Run the experiment on Sepolia (on your own machine)

The script talks to the five contracts that are already deployed (see `sepolia_addresses.json`) and uses the ABI in `abi_sepolia/`.
Your `.env` is read locally by the script; it is never sent anywhere, never printed, and not written to the result file.

PowerShell, from this folder:

    npm install
    node run_deployed_version.js --live --env "C:\Users\admin\Documents\Blockchain Multi Industrial Service Center\Blockchain MultiIndustrial Projects\BlockchainIndustrialPlatform\.env"

Accepted variable names in the .env: RPC_URL / SEPOLIA_RPC_URL / INFURA_URL / ALCHEMY_URL (or INFURA_PROJECT_ID / INFURA_API_KEY) and PRIVATE_KEY / DEPLOYER_PRIVATE_KEY / SEPOLIA_PRIVATE_KEY.
Optional: `TRIALS=20` (default 20 mappings and paths; a trial costs about 0.3M gas per mapping and 0.7M per path, so 20 trials is roughly 25M gas), `ADDRESSES=path` to use another address file.

Output: `../data/deployed_version_sepolia.json` (every transaction hash, block, gas and confirmation time). It contains no secrets. Send that file back and the paper is updated with the real confirmation times.
