// test/blockstream.js
const { ConsensusSimulator } = require('./strebacom-simulation.js');
const fs = require('fs');

async function runValidation() {
    console.log('=== STREAM-BASED CONSENSUS VALIDATION ===');
    console.log('Testing theoretical claims with comprehensive simulation...\n');
    
    const simulator = new ConsensusSimulator({
        validatorCount: 50,
        byzantineRatio: 0.2,
        consensusThreshold: 0.51,
        finalityThreshold: 0.90,
        networkLatency: 100
    });
    
    try {
        const results = await simulator.runBenchmarkSuite();
        
        console.log('\n=== VALIDATION RESULTS ===');
        console.log(`Timestamp: ${results.timestamp}`);
        console.log(`Total Experiments: ${results.summary.totalExperiments}`);
        console.log(`Overall Performance Score: ${results.summary.overallPerformance}%`);
        
        results.experimentResults.forEach(experiment => {
            console.log(`\n--- ${experiment.name} ---`);
            
            if (experiment.scalingResults) {
                console.log('Throughput Scaling:');
                experiment.scalingResults.forEach(result => {
                    console.log(`  ${result.transactionCount} txs: ${result.throughput} TPS (${result.processingTime}ms)`);
                });
            }
            
            if (experiment.byzantineResults) {
                console.log('Byzantine Resilience:');
                experiment.byzantineResults.forEach(result => {
                    console.log(`  ${(result.byzantineRatio * 100).toFixed(0)}% Byzantine: ${(result.consensusSuccessRate * 100).toFixed(1)}% success`);
                });
            }
            
            if (experiment.averageFinalityTime) {
                console.log(`Average Finality Time: ${experiment.averageFinalityTime.toFixed(2)}ms`);
            }
            
            if (experiment.successRate) {
                console.log(`Partition Tolerance: ${(experiment.successRate * 100).toFixed(1)}% success rate`);
            }
            
            if (experiment.stressResults) {
                console.log('Load Stress Testing:');
                experiment.stressResults.forEach(result => {
                    console.log(`  ${result.load} txs: ${result.throughput} TPS, ${(result.successRate * 100).toFixed(1)}% success`);
                });
            }
        });
        
        // Export results
        fs.writeFileSync('./test/consensus_validation_results.json', JSON.stringify(results, null, 2));
        console.log('\nDetailed results saved to ./test/consensus_validation_results.json');
        
        // Summary analysis
        console.log('\n=== THEORETICAL VALIDATION SUMMARY ===');
        
        const throughputExp = results.experimentResults.find(e => e.name === 'Throughput Scaling');
        if (throughputExp) {
            const maxThroughput = Math.max(...throughputExp.scalingResults.map(r => r.throughput));
            console.log(`Maximum Achieved Throughput: ${maxThroughput} TPS`);
            console.log(`Bitcoin Comparison (7 TPS): ${(maxThroughput / 7).toFixed(1)}x`);
            console.log(`Ethereum Comparison (15 TPS): ${(maxThroughput / 15).toFixed(1)}x`);
        }
        
        const byzantineExp = results.experimentResults.find(e => e.name === 'Byzantine Resilience');
        if (byzantineExp) {
            const maxByzantine = byzantineExp.byzantineResults
                .filter(r => r.systemStability)
                .reduce((max, r) => Math.max(max, r.byzantineRatio), 0);
            console.log(`Byzantine Fault Tolerance: Up to ${(maxByzantine * 100).toFixed(0)}% malicious nodes`);
        }
        
    } catch (error) {
        console.error('Validation failed:', error.message);
        console.error(error.stack);
    }
}

runValidation();