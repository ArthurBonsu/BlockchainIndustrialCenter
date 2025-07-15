// analytics/carbon-data-processor.js
// Fixed version with proper data processing and BigInt safety
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

class CarbonDataProcessor {
    constructor() {
        this.rawData = [];
        this.processedData = {};
        this.cityBaselines = {};
    }

    async loadCarbonMonitorData(filePath = '../data/carbonmonitor-cities_datas_2025-01-13.csv') {
        return new Promise((resolve) => {
            this.rawData = [];
            
            if (!fs.existsSync(filePath)) {
                console.log('📊 Carbon monitor data not found, generating synthetic data...');
                this.generateSyntheticData();
                this.processData();
                resolve(this.rawData);
                return;
            }

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Handle carbon monitor format: city,date,sector,value
                    const cleanedRow = {
                        city: row.city ? row.city.replace(/['"]/g, '').trim() : '',
                        date: row.date ? row.date.replace(/['"]/g, '').trim() : '',
                        sector: row.sector ? row.sector.replace(/['"]/g, '').trim() : '',
                        emissions: parseFloat(row.value || 0)
                    };
                    
                    // Scale and validate emissions for blockchain simulation
                    if (cleanedRow.city && cleanedRow.emissions > 0) {
                        // Scale small emissions (Aviation: 0.000736959) for blockchain demo
                        if (cleanedRow.emissions < 1) {
                            cleanedRow.emissions = cleanedRow.emissions * 1000;
                        }
                        // Further scale for realistic blockchain values
                        cleanedRow.emissions = Math.round(cleanedRow.emissions * 100);
                        this.rawData.push(cleanedRow);
                    }
                })
                .on('end', () => {
                    console.log(`✓ Loaded ${this.rawData.length} carbon monitor data points`);
                    if (this.rawData.length === 0) {
                        this.generateSyntheticData();
                    }
                    this.processData();
                    resolve(this.rawData);
                })
                .on('error', () => {
                    console.log('📊 Using synthetic carbon data for testing');
                    this.generateSyntheticData();
                    this.processData();
                    resolve(this.rawData);
                });
        });
    }

    generateSyntheticData() {
        const cities = ['Melbourne', 'Sydney', 'Brisbane', 'New York', 'London', 'Tokyo', 'Shanghai', 'Mumbai'];
        const sectors = ['Aviation', 'Industry', 'Power', 'Ground Transport', 'Residential'];
        
        cities.forEach(city => {
            sectors.forEach(sector => {
                for (let month = 0; month < 24; month++) {
                    let baseEmission;
                    switch (sector) {
                        case 'Aviation': baseEmission = 50 + Math.random() * 100; break;
                        case 'Industry': baseEmission = 2000 + Math.random() * 1500; break;
                        case 'Power': baseEmission = 1500 + Math.random() * 1000; break;
                        case 'Ground Transport': baseEmission = 800 + Math.random() * 600; break;
                        case 'Residential': baseEmission = 400 + Math.random() * 300; break;
                        default: baseEmission = 500 + Math.random() * 500;
                    }
                    
                    const seasonalFactor = 1 + 0.2 * Math.sin((month * Math.PI) / 6);
                    const trendFactor = 1 - (month * 0.01);
                    const emission = Math.round(baseEmission * seasonalFactor * trendFactor);
                    
                    this.rawData.push({
                        city: city,
                        emissions: emission,
                        date: `2024-${String(month + 1).padStart(2, '0')}-01`,
                        sector: sector
                    });
                }
            });
        });
    }

    processData() {
        // Group by city and calculate baselines
        const cityGroups = {};
        this.rawData.forEach(row => {
            if (!cityGroups[row.city]) {
                cityGroups[row.city] = [];
                this.processedData[row.city] = []; // Fix: populate processedData
            }
            cityGroups[row.city].push(row.emissions);
            this.processedData[row.city].push(row); // Fix: add processed data
        });

        Object.keys(cityGroups).forEach(city => {
            const emissions = cityGroups[city];
            const avgEmission = emissions.reduce((sum, val) => sum + val, 0) / emissions.length;
            
            // Scale for blockchain simulation
            let baseline = Math.round(avgEmission);
            if (baseline < 100) baseline = baseline * 10;
            if (baseline > 10000) baseline = Math.round(baseline / 10);
            
            this.cityBaselines[city] = {
                averageEmissions: baseline,
                originalAverage: Math.round(avgEmission),
                dataPoints: emissions.length,
                sectors: [...new Set(this.rawData.filter(r => r.city === city).map(r => r.sector))]
            };
        });
    }

    getTopEmittingCities(count = 5) {
        return Object.entries(this.cityBaselines)
            .sort(([,a], [,b]) => b.averageEmissions - a.averageEmissions)
            .slice(0, count)
            .map(([city, data]) => ({
                city,
                averageEmissions: data.averageEmissions,
                dataPoints: data.dataPoints
            }));
    }

    // Additional methods for compatibility with integration script
    calculateCityTrend(cityName) {
        const cityData = this.processedData[cityName];
        if (!cityData || cityData.length < 5) {
            // Return a default trend for cities without enough data
            return {
                trend: 'stable',
                percentChange: '0.00'
            };
        }
        
        // Simple trend calculation
        const sortedData = cityData.sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
        const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, row) => sum + row.emissions, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, row) => sum + row.emissions, 0) / secondHalf.length;
        
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        return {
            trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
            percentChange: change.toFixed(2)
        };
    }

    generateAnalyticsReport() {
        return {
            dataOverview: {
                totalDataPoints: this.rawData.length,
                citiesAnalyzed: Object.keys(this.cityBaselines).length, // Fix: use cityBaselines instead of processedData
                sectorsIncluded: [...new Set(this.rawData.map(row => row.sector))]
            },
            topEmitters: this.getTopEmittingCities(5),
            cityBaselines: this.cityBaselines
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const topEmitters = this.getTopEmittingCities(3);
        
        if (topEmitters.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Target Focus',
                message: `Focus regulatory efforts on top emitting cities: ${topEmitters.map(c => c.city).join(', ')}`,
                targetCities: topEmitters.map(c => c.city)
            });
        }
        
        return recommendations;
    }

    exportResults(outputDir = 'analytics_output') {
        try {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const report = this.generateAnalyticsReport();
            
            // Safe JSON serialization
            const safeReport = JSON.stringify(report, (key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                if (typeof value === 'number' && !isFinite(value)) {
                    return 0;
                }
                return value;
            }, 2);
            
            fs.writeFileSync(
                path.join(outputDir, 'comprehensive_analytics_report.json'),
                safeReport
            );

            const safeBaselines = JSON.stringify(this.cityBaselines, (key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                if (typeof value === 'number' && !isFinite(value)) {
                    return 0;
                }
                return value;
            }, 2);

            fs.writeFileSync(
                path.join(outputDir, 'city_baselines.json'),
                safeBaselines
            );

            console.log(`✓ Analytics results exported to ${outputDir}/`);
            return outputDir;
        } catch (error) {
            console.log(`⚠️  Analytics export failed: ${error.message}`);
            return outputDir;
        }
    }
}

// Performance Analyzer with BigInt safety
class PerformanceAnalyzer {
    constructor() {
        this.gasMetrics = [];
        this.transactionMetrics = [];
        this.startTime = null;
        this.systemMetrics = {
            startTime: null,
            endTime: null,
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0
        };
    }

    startMonitoring() {
        this.startTime = Date.now();
        this.systemMetrics.startTime = Date.now();
        console.log('🔍 Performance monitoring started');
    }

    stopMonitoring() {
        this.systemMetrics.endTime = Date.now();
        console.log('⏹️ Performance monitoring stopped');
    }

    recordGasUsage(operation, gasUsed, gasPrice = 20000000000) { // 20 Gwei default
        try {
            // Convert BigInt values safely
            const safeGasUsed = typeof gasUsed === 'bigint' ? Number(gasUsed) : gasUsed;
            const safeGasPrice = typeof gasPrice === 'bigint' ? Number(gasPrice) : gasPrice;
            
            const costInGwei = (safeGasUsed * safeGasPrice) / 1e9;
            this.gasMetrics.push({
                operation,
                gasUsed: safeGasUsed,
                gasPrice: safeGasPrice,
                costInGwei,
                timestamp: Date.now()
            });
            console.log(`⛽ ${operation}: ${safeGasUsed} gas (${costInGwei.toFixed(6)} Gwei)`);
        } catch (error) {
            console.log(`⚠️  Gas recording failed for ${operation}: ${error.message}`);
        }
    }

    recordTransaction(operation, success, duration, blockNumber = null) {
        try {
            const safeBlockNumber = typeof blockNumber === 'bigint' ? Number(blockNumber) : blockNumber;
            
            this.transactionMetrics.push({
                operation,
                success,
                duration,
                blockNumber: safeBlockNumber,
                timestamp: Date.now()
            });

            this.systemMetrics.totalTransactions++;
            if (success) {
                this.systemMetrics.successfulTransactions++;
            } else {
                this.systemMetrics.failedTransactions++;
            }

            console.log(`📊 ${operation}: ${success ? '✅' : '❌'} (${duration}ms)`);
        } catch (error) {
            console.log(`⚠️  Transaction recording failed for ${operation}: ${error.message}`);
        }
    }

    getAverageGasCost() {
        if (this.gasMetrics.length === 0) return 0;
        const totalCost = this.gasMetrics.reduce((sum, m) => sum + (m.costInGwei || 0), 0);
        return totalCost / this.gasMetrics.length;
    }

    getSystemPerformance() {
        try {
            const duration = (this.systemMetrics.endTime || Date.now()) - (this.systemMetrics.startTime || Date.now());
            const successRate = this.systemMetrics.totalTransactions > 0 
                ? (this.systemMetrics.successfulTransactions / this.systemMetrics.totalTransactions) * 100 
                : 0;
            
            return {
                totalDuration: duration,
                totalTransactions: this.systemMetrics.totalTransactions,
                successfulTransactions: this.systemMetrics.successfulTransactions,
                failedTransactions: this.systemMetrics.failedTransactions,
                successRate: successRate.toFixed(2),
                transactionsPerSecond: duration > 0 ? (this.systemMetrics.totalTransactions / (duration / 1000)).toFixed(2) : '0',
                avgGasUsed: this.getOverallAvgGas(),
                totalGasCost: this.getTotalGasCost()
            };
        } catch (error) {
            console.log(`⚠️  System performance calculation failed: ${error.message}`);
            return {
                totalDuration: 0,
                totalTransactions: 0,
                successfulTransactions: 0,
                failedTransactions: 0,
                successRate: '0',
                transactionsPerSecond: '0',
                avgGasUsed: 0,
                totalGasCost: '0'
            };
        }
    }

    getOverallAvgGas() {
        if (this.gasMetrics.length === 0) return 0;
        const totalGas = this.gasMetrics.reduce((sum, m) => sum + (m.gasUsed || 0), 0);
        return Math.round(totalGas / this.gasMetrics.length);
    }

    getTotalGasCost() {
        const totalCost = this.gasMetrics.reduce((sum, m) => sum + (m.costInGwei || 0), 0);
        return totalCost.toFixed(6);
    }

    generateReport() {
        try {
            const avgGas = this.gasMetrics.length > 0 
                ? this.gasMetrics.reduce((sum, m) => sum + (m.gasUsed || 0), 0) / this.gasMetrics.length 
                : 0;
            const avgCost = this.getAverageGasCost();
            const successRate = this.transactionMetrics.length > 0 
                ? this.transactionMetrics.filter(t => t.success).length / this.transactionMetrics.length * 100 
                : 0;
            
            return {
                averageGasUsed: Math.round(avgGas),
                averageCostGwei: avgCost.toFixed(6),
                successRate: successRate.toFixed(1),
                totalTransactions: this.transactionMetrics.length
            };
        } catch (error) {
            console.log(`⚠️  Report generation failed: ${error.message}`);
            return {
                averageGasUsed: 0,
                averageCostGwei: '0.000000',
                successRate: '0.0',
                totalTransactions: 0
            };
        }
    }

    generatePerformanceReport() {
        try {
            return {
                systemPerformance: this.getSystemPerformance(),
                gasAnalytics: this.getGasAnalytics(),
                recommendations: this.generatePerformanceRecommendations()
            };
        } catch (error) {
            console.log(`⚠️  Performance report generation failed: ${error.message}`);
            return {
                systemPerformance: this.getSystemPerformance(),
                gasAnalytics: {},
                recommendations: []
            };
        }
    }

    getGasAnalytics() {
        try {
            const operationGroups = {};
            
            this.gasMetrics.forEach(metric => {
                if (!operationGroups[metric.operation]) {
                    operationGroups[metric.operation] = [];
                }
                operationGroups[metric.operation].push(metric);
            });

            const analytics = {};
            Object.keys(operationGroups).forEach(operation => {
                const metrics = operationGroups[operation];
                const totalGas = metrics.reduce((sum, m) => sum + (m.gasUsed || 0), 0);
                const totalCost = metrics.reduce((sum, m) => sum + (m.costInGwei || 0), 0);
                
                analytics[operation] = {
                    count: metrics.length,
                    avgGasUsed: metrics.length > 0 ? Math.round(totalGas / metrics.length) : 0,
                    maxGasUsed: metrics.length > 0 ? Math.max(...metrics.map(m => m.gasUsed || 0)) : 0,
                    minGasUsed: metrics.length > 0 ? Math.min(...metrics.map(m => m.gasUsed || 0)) : 0,
                    avgCostGwei: metrics.length > 0 ? (totalCost / metrics.length).toFixed(6) : '0.000000',
                    totalCostGwei: totalCost.toFixed(6)
                };
            });

            return analytics;
        } catch (error) {
            console.log(`⚠️  Gas analytics calculation failed: ${error.message}`);
            return {};
        }
    }

    generatePerformanceRecommendations() {
        try {
            const recommendations = [];
            const gasAnalytics = this.getGasAnalytics();

            // Gas optimization recommendations
            const highGasOperations = Object.entries(gasAnalytics)
                .filter(([, data]) => (data.avgGasUsed || 0) > 300000)
                .map(([op]) => op);

            if (highGasOperations.length > 0) {
                recommendations.push({
                    category: 'Gas Optimization',
                    priority: 'HIGH',
                    message: `Optimize high gas operations: ${highGasOperations.join(', ')}`,
                    operations: highGasOperations
                });
            }

            return recommendations;
        } catch (error) {
            console.log(`⚠️  Performance recommendations failed: ${error.message}`);
            return [];
        }
    }

    exportPerformanceData(outputDir = 'performance_output') {
        try {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const report = this.generatePerformanceReport();
            
            // Safe JSON serialization
            const safeReport = JSON.stringify(report, (key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                if (typeof value === 'number' && !isFinite(value)) {
                    return 0;
                }
                return value;
            }, 2);
            
            fs.writeFileSync(
                path.join(outputDir, 'performance_report.json'),
                safeReport
            );

            const safeMetrics = JSON.stringify(this.gasMetrics, (key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                if (typeof value === 'number' && !isFinite(value)) {
                    return 0;
                }
                return value;
            }, 2);

            fs.writeFileSync(
                path.join(outputDir, 'gas_metrics.json'),
                safeMetrics
            );

            console.log(`📈 Performance data exported to ${outputDir}/`);
            return outputDir;
        } catch (error) {
            console.log(`⚠️  Performance export failed: ${error.message}`);
            return outputDir;
        }
    }
}

module.exports = { CarbonDataProcessor, PerformanceAnalyzer };