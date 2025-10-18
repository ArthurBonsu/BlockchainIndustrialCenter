// scripts/deploy.js
const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying UIS Orchestrator to Sepolia...");
    
    // Get the contract factory
    const UISOrchestrator = await hre.ethers.getContractFactory("UISOrchestrator");
    
    // Deploy the contract
    console.log("📦 Deploying contract...");
    const uisContract = await UISOrchestrator.deploy();
    
    // Wait for deployment
    await uisContract.deployed();
    
    console.log("✅ UIS Orchestrator deployed to:", uisContract.address);
    
    // Wait for block confirmations
    console.log("⏳ Waiting for block confirmations...");
    await uisContract.deployTransaction.wait(5);
    
    // Verify on Etherscan
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("🔍 Verifying contract on Etherscan...");
        await hre.run("verify:verify", {
            address: uisContract.address,
            constructorArguments: [],
        });
    }
    
    console.log("\n📋 DEPLOYMENT COMPLETE");
    console.log("=" .repeat(50));
    console.log("Contract Address:", uisContract.address);
    console.log("Transaction Hash:", uisContract.deployTransaction.hash);
    console.log("=" .repeat(50));
    console.log("\n⚡ Next Steps:");
    console.log("1. Copy the contract address above");
    console.log("2. Update CONTRACT_ADDRESS in UISTest.js");
    console.log("3. Copy the ABI from artifacts/contracts/UISOrchestrator.sol/UISOrchestrator.json");
    console.log("4. Update UISOrchestrator_ABI in UISTest.js");
    console.log("5. Run: npm test");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
