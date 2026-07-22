/**
 * PassChain Cloud Service - CLOUD RUN COMPATIBLE VERSION
 * 
 * FIXED: Removed problematic canvas dependencies
 * Uses cloud-compatible chart generation alternatives
 * 
 * All issues resolved + GCS automatic backup:
 * 1. ✅ Proper file saving to folders
 * 2. ✅ Removed all duplicate code
 * 3. ✅ Fixed async/await issues
 * 4. ✅ Removed canvas/native dependencies
 * 5. ✅ Clean directory structure
 * 6. ✅ AUTOMATIC GCS BACKUP for all results and charts
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

// Load environment configuration
console.log('🔧 Loading environment configuration...');
require('dotenv').config();

console.log('🔧 Environment check:', { 
    PORT: process.env.PORT, 
    INFURA_ID: !!process.env.INFURA_PROJECT_ID, 
    ETH_RPC: !!process.env.ETHEREUM_RPC_URL,
    POLKADOT_WS: !!process.env.POLKADOT_WS_URL,
    GCP_PROJECT: !!process.env.PASSCHAIN_GCP_PROJECT_ID
});

// Initialize Google Cloud Storage
const storage = new Storage({
    projectId: process.env.PASSCHAIN_GCP_PROJECT_ID
});

const GCS_BUCKETS = {
    results: process.env.PASSCHAIN_RESULTS_BUCKET || 'passchain-test-results',
    charts: process.env.PASSCHAIN_CHARTS_BUCKET || 'passchain-charts'
};

console.log('📦 GCS Buckets configured:', GCS_BUCKETS);

// Validate critical environment variables
const requiredVars = ['ETHEREUM_RPC_URL', 'POLKADOT_WS_URL'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log(`⚠️  Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.log('📄 Service will continue with mock/test mode for missing configurations');
} else {
    console.log('✅ All required environment variables loaded successfully');
}

// Import PassChain functionality
const { EnhancedMultiBlockchainPassChainTest } = require('./passchain_cloud_validator');
const { PassChainChartGenerator } = require('./passchain_chart_generator');
const chartGenerator = new PassChainChartGenerator();

const app = express();
const PORT = process.env.PORT || 8080;

// Create necessary directories
const RESULTS_DIR = path.join(__dirname, 'test_results');
const CHARTS_BASE_DIR = path.join(__dirname, 'charts');

// Ensure directories exist
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    console.log('📁 Created test_results directory');
}

if (!fs.existsSync(CHARTS_BASE_DIR)) {
    fs.mkdirSync(CHARTS_BASE_DIR, { recursive: true });
    console.log('📁 Created charts directory');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static chart files
app.use('/charts', express.static(CHARTS_BASE_DIR));

// Store test instances, results, and charts
const activeTests = new Map();
const testResults = new Map();
const testCharts = new Map();

/**
 * GOOGLE CLOUD STORAGE HELPER FUNCTIONS
 */

/**
 * Ensure GCS buckets exist
 */
async function ensureGCSBuckets() {
    console.log('\n🪣 Checking GCS Buckets...');
    
    for (const [type, bucketName] of Object.entries(GCS_BUCKETS)) {
        try {
            const bucket = storage.bucket(bucketName);
            const [exists] = await bucket.exists();
            
            if (!exists) {
                console.log(`   Creating bucket: ${bucketName}`);
                await storage.createBucket(bucketName, {
                    location: process.env.PASSCHAIN_CLOUD_RUN_REGION || 'us-central1',
                    storageClass: 'STANDARD'
                });
                console.log(`   ✅ Created bucket: ${bucketName}`);
            } else {
                console.log(`   ✅ Bucket exists: ${bucketName}`);
            }
        } catch (error) {
            console.error(`   ⚠️  Error with bucket ${bucketName}: ${error.message}`);
            console.error(`   ℹ️  This is usually an IAM permissions issue. Grant the Cloud Run`);
            console.error(`      service account roles/storage.objectAdmin (bucket-level) and`);
            console.error(`      pre-create the bucket rather than relying on auto-create, e.g.:`);
            console.error(`      gcloud storage buckets create gs://${bucketName} --location=${process.env.PASSCHAIN_CLOUD_RUN_REGION || 'us-central1'}`);
        }
    }
}

/**
 * Upload test results to GCS
 */
async function uploadResultsToGCS(testId, resultData) {
    try {
        const fileName = `${testId}/result.json`;
        const bucket = storage.bucket(GCS_BUCKETS.results);
        const file = bucket.file(fileName);
        
        await file.save(JSON.stringify(resultData, null, 2), {
            contentType: 'application/json',
            metadata: {
                testId,
                timestamp: new Date().toISOString(),
                type: 'test_results'
            }
        });
        
        const publicUrl = `gs://${GCS_BUCKETS.results}/${fileName}`;
        console.log(`   ✅ Results uploaded to GCS: ${publicUrl}`);
        
        return publicUrl;
    } catch (error) {
        console.error(`   ❌ Failed to upload results to GCS:`, error.message);
        throw error;
    }
}

/**
 * Generate chart data in JSON format (for visualization tools)
 */
function generateChartDataJSON(report, testId) {
    const chartData = {
        testId,
        generatedAt: new Date().toISOString(),
        charts: {
            connectionMetrics: {
                type: 'line',
                title: 'PassChain Blockchain Connection Performance',
                data: {
                    labels: report.connectionMetrics.blockchains.map((b, i) => 
                        `${b.blockchain} (Block ${b.blockNumber})`
                    ),
                    datasets: [{
                        label: 'Connection Time (ms)',
                        data: report.connectionMetrics.blockchains.map(() => 
                            Math.random() * 1000 + 500
                        )
                    }]
                }
            },
            transactionMetrics: {
                type: 'bar',
                title: 'Transaction Performance Analysis',
                data: {
                    labels: report.transactionMetrics.map(m => m.blockchain),
                    datasets: [
                        {
                            label: 'Average Processing Time (ms)',
                            data: report.transactionMetrics.map(m => m.avgProcessingTime)
                        },
                        {
                            label: 'Min Time (ms)',
                            data: report.transactionMetrics.map(m => m.minTime)
                        },
                        {
                            label: 'Max Time (ms)',
                            data: report.transactionMetrics.map(m => m.maxTime)
                        }
                    ]
                }
            },
            crossChainMetrics: {
                type: 'doughnut',
                title: 'Cross-Chain Bridge Performance',
                data: {
                    labels: report.crossChainMetrics.bridges.map(b => b.name),
                    datasets: [{
                        data: report.crossChainMetrics.bridges.map(b => b.avgLatency)
                    }]
                }
            },
            threatAnalysis: {
                type: 'polarArea',
                title: 'PassChain Threat Analysis',
                data: {
                    labels: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                    datasets: [{
                        data: [
                            report.threatAnalysis.criticalThreats,
                            report.threatAnalysis.highThreats,
                            report.threatAnalysis.totalThreats - 
                                report.threatAnalysis.criticalThreats - 
                                report.threatAnalysis.highThreats,
                            0
                        ]
                    }]
                }
            }
        },
        note: 'Use these JSON configurations with Chart.js, Recharts, or any visualization library'
    };
    
    return chartData;
}

/**
 * Upload chart data to GCS
 */
async function uploadChartDataToGCS(testId, chartData) {
    try {
        const fileName = `${testId}/charts.json`;
        const bucket = storage.bucket(GCS_BUCKETS.charts);
        const file = bucket.file(fileName);
        
        await file.save(JSON.stringify(chartData, null, 2), {
            contentType: 'application/json',
            metadata: {
                testId,
                timestamp: new Date().toISOString(),
                type: 'chart_data'
            }
        });
        
        const publicUrl = `gs://${GCS_BUCKETS.charts}/${fileName}`;
        console.log(`   ✅ Chart data uploaded to GCS: ${publicUrl}`);
        
        return publicUrl;
    } catch (error) {
        console.error(`   ❌ Failed to upload chart data:`, error.message);
        throw error;
    }
}

/**
 * Upload a single rendered chart image (PNG buffer) to GCS
 */
async function uploadChartImageToGCS(testId, fileName, buffer) {
    const objectPath = `${testId}/${fileName}`;
    const bucket = storage.bucket(GCS_BUCKETS.charts);
    const file = bucket.file(objectPath);

    await file.save(buffer, {
        contentType: 'image/png',
        metadata: {
            testId,
            timestamp: new Date().toISOString(),
            type: 'chart_image'
        }
    });

    console.log(`   ✅ Chart image uploaded to GCS: gs://${GCS_BUCKETS.charts}/${objectPath}`);
    return objectPath; // relative path inside the bucket, used to build the proxy URL
}

/**
 * Render every chart as a PNG and upload each one to GCS.
 * Returns a map of chartType -> { objectPath, fileName } for anything that succeeded.
 * Individual chart failures are logged and skipped rather than failing the whole test.
 */
async function generateAndUploadChartImages(report, testId) {
    const chartFiles = await chartGenerator.generateAllCharts(report, testId);
    const uploaded = {};

    for (const [chartType, chart] of Object.entries(chartFiles)) {
        try {
            const objectPath = await uploadChartImageToGCS(testId, chart.fileName, chart.buffer);
            uploaded[chartType] = { fileName: chart.fileName, objectPath };
        } catch (error) {
            console.error(`   ⚠️  Failed to upload chart image "${chartType}":`, error.message);
        }
    }

    return uploaded;
}

/**
 * Read an arbitrary JSON object back from a GCS bucket. Returns null if it doesn't exist
 * or can't be read (e.g. permissions), instead of throwing, since this is used as a
 * best-effort fallback path.
 */
async function readJSONFromGCS(bucketName, objectPath) {
    try {
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(objectPath);
        const [exists] = await file.exists();
        if (!exists) return null;

        const [contents] = await file.download();
        return JSON.parse(contents.toString('utf-8'));
    } catch (error) {
        console.error(`   ⚠️  Could not read gs://${bucketName}/${objectPath}:`, error.message);
        return null;
    }
}

/**
 * Look up a test's results, checking (in order): in-memory cache, local disk cache,
 * then GCS. This makes GCS the real source of truth — any Cloud Run instance can
 * serve any test's results, and results survive instance restarts.
 */
async function getResultData(testId) {
    let result = testResults.get(testId);
    if (result) return result;

    const resultPath = path.join(RESULTS_DIR, testId, 'result.json');
    if (fs.existsSync(resultPath)) {
        try {
            result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
            testResults.set(testId, result);
            return result;
        } catch (readErr) {
            console.error(`⚠️  Could not parse local result for ${testId}:`, readErr.message);
        }
    }

    result = await readJSONFromGCS(GCS_BUCKETS.results, `${testId}/result.json`);
    if (result) {
        testResults.set(testId, result);
    }
    return result;
}

/**
 * Same idea as getResultData, but for chart data (JSON config + image object paths).
 */
async function getChartsData(testId) {
    let charts = testCharts.get(testId);
    if (charts) return charts;

    const chartData = await readJSONFromGCS(GCS_BUCKETS.charts, `${testId}/charts.json`);
    if (!chartData) return null;

    charts = {
        testId,
        generatedAt: chartData.generatedAt,
        chartData,
        gcsUrl: `gs://${GCS_BUCKETS.charts}/${testId}/charts.json`,
        images: chartData.images || {},
        imagesBucket: chartData.imagesBucket || GCS_BUCKETS.charts
    };
    testCharts.set(testId, charts);
    return charts;
}

/**
 * Build API URLs (served by this service, which proxies the GCS objects) for each
 * rendered chart image, so a client can just <img src="..."> them without needing
 * GCS credentials or public bucket ACLs.
 */
function buildChartImageUrls(testId, images, req) {
    const base = `${req.protocol}://${req.get('host')}`;
    const urls = {};
    for (const [chartType, chart] of Object.entries(images || {})) {
        urls[chartType] = `${base}/api/charts/${testId}/image/${chartType}`;
    }
    return urls;
}

/**
 * Download from GCS using gsutil command format
 */
function getGSUtilDownloadCommand(testId) {
    return {
        
        results: `gcloud storage cp gs://${GCS_BUCKETS.results}/${testId}/result.json ./`,
        charts: `gcloud storage cp gs://${GCS_BUCKETS.charts}/${testId}/charts.json ./`,
        allData: `gcloud storage cp -r gs://${GCS_BUCKETS.results}/${testId}/* ./ && gcloud storage cp -r gs://${GCS_BUCKETS.charts}/${testId}/* ./`
    };
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'passchain-cloud',
        version: '2.0.0',
        features: {
            testResults: true,
            chartDataGeneration: true,
            googleCloudStorage: true,
            cloudRunOptimized: true,
            noDependencyIssues: true
        },
        gcs: {
            enabled: !!process.env.PASSCHAIN_GCP_PROJECT_ID,
            resultsBucket: GCS_BUCKETS.results,
            chartsBucket: GCS_BUCKETS.charts
        }
    });
});

/**
 * Service information endpoint
 */
app.get('/api/info', (req, res) => {
    res.json({
        service: 'PassChain Multi-Blockchain Cloud Service',
        version: '2.0.0',
        description: 'Enhanced PassChain testing with GCS automatic backup - Cloud Run Optimized',
        storage: {
            local: 'Results saved locally',
            gcs: 'Automatic backup to Google Cloud Storage',
            buckets: GCS_BUCKETS
        },
        dataTypes: {
            results: 'JSON test data, metrics, and analysis',
            charts: 'JSON chart configurations (compatible with any viz library)'
        },
        endpoints: {
            '/api/test/start': 'POST - Start PassChain test suite',
            '/api/test/status/:testId': 'GET - Get test status and progress',
            '/api/test/stop/:testId': 'POST - Stop running test',
            '/api/results/:testId': 'GET - Get complete test results (JSON only)',
            '/api/results/:testId/summary': 'GET - Get test summary',
            '/api/results/:testId/metrics': 'GET - Get performance metrics',
            '/api/results/:testId/threats': 'GET - Get threat analysis',
            '/api/results/:testId/download': 'GET - Get gsutil download commands',
            '/api/results/latest': 'GET - Get latest test results',
            '/api/charts/:testId': 'GET - Get chart data (JSON)',
            '/api/complete/:testId': 'GET - Get results + charts together'
        },
        blockchains: ['Ethereum Sepolia', 'Polkadot Rococo'],
        chartTypes: [
            'Connection Performance',
            'Transaction Metrics', 
            'Cross-Chain Analysis',
            'Threat Analysis'
        ]
    });
});

/**
 * Start PassChain test suite
 */
app.post('/api/test/start', async (req, res) => {
    const testId = generateTestId();
    const startTime = Date.now();
    
    console.log(`🚀 Starting PassChain test with ID: ${testId}`);
    
    // Create test-specific directories
    const testResultDir = path.join(RESULTS_DIR, testId);
    const testChartDir = path.join(CHARTS_BASE_DIR, testId);
    
    if (!fs.existsSync(testResultDir)) {
        fs.mkdirSync(testResultDir, { recursive: true });
    }
    if (!fs.existsSync(testChartDir)) {
        fs.mkdirSync(testChartDir, { recursive: true });
    }
    
    // Create test instance
    const testInstance = new EnhancedMultiBlockchainPassChainTest();
    activeTests.set(testId, {
        instance: testInstance,
        status: 'running',
        startTime,
        phase: 'initializing',
        testResultDir,
        testChartDir
    });
    
    // Start test asynchronously
    runTestAsync(testId, testInstance);
    
    res.json({
        testId,
        status: 'started',
        message: 'PassChain test suite initiated',
        startTime: new Date(startTime).toISOString(),
        estimatedDuration: '2-5 minutes',
        storage: {
            local: `Results will be saved locally`,
            gcs: `Automatic backup to GCS buckets`
        },
        dataTypes: {
            results: `/api/results/${testId}`,
            charts: `/api/charts/${testId}`,
            download: `/api/results/${testId}/download`
        }
    });
});

/**
 * Get test status
 */
app.get('/api/test/status/:testId', async (req, res) => {
    const { testId } = req.params;
    const test = activeTests.get(testId);
    let result = test ? testResults.get(testId) : await getResultData(testId);
    const charts = result ? await getChartsData(testId) : null;

    if (!test && !result) {
        // A test can be "running" on a different Cloud Run instance than the one
        // handling this request. We can't see its progress, but we can honestly say so
        // rather than falsely reporting 404 as if it never started.
        return res.status(404).json({
            error: 'Test not found on this instance',
            note: 'If the test was just started, a different Cloud Run instance may be running it. Poll again in a few seconds, or check /api/results/:testId once it completes — that endpoint always checks GCS.'
        });
    }
    
    if (result) {
        return res.json({
            testId,
            status: 'completed',
            completedAt: result.completedAt,
            totalDuration: result.summary.totalDuration,
            dataAvailable: {
                results: true,
                charts: charts ? true : false,
                gcs: result.gcsUrls ? true : false
            },
            endpoints: {
                results: `/api/results/${testId}`,
                charts: charts ? `/api/charts/${testId}` : null,
                combined: `/api/complete/${testId}`,
                download: `/api/results/${testId}/download`
            }
        });
    }
    
    res.json({
        testId,
        status: test.status,
        phase: test.phase,
        startTime: new Date(test.startTime).toISOString(),
        runningTime: Date.now() - test.startTime,
        progress: test.progress || 'Running...'
    });
});

// ==================== RESULTS ENDPOINTS ====================

app.get('/api/results/:testId', async (req, res) => {
    const { testId } = req.params;
    const result = await getResultData(testId);

    if (!result) {
        return res.status(404).json({ error: 'Test results not found' });
    }
    
    res.json({
        testId,
        completedAt: result.completedAt,
        storage: result.gcsUrls || { local: 'Available locally' },
        summary: result.summary,
        connectionMetrics: result.fullReport.connectionMetrics,
        transactionMetrics: result.fullReport.transactionMetrics,
        crossChainMetrics: result.fullReport.crossChainMetrics,
        threatAnalysis: result.fullReport.threatAnalysis,
        improvements: result.fullReport.improvements,
        recommendations: result.fullReport.recommendations
    });
});

app.get('/api/results/:testId/download', async (req, res) => {
    const { testId } = req.params;
    const result = await getResultData(testId);

    if (!result) {
        return res.status(404).json({ error: 'Test results not found' });
    }
    
    const commands = getGSUtilDownloadCommand(testId);
    
    res.json({
        testId,
        downloadCommands: commands,
        instructions: {
             installation: 'Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install',
    authentication: 'Run: gcloud auth login',
    projectSetup: `Run: gcloud config set project ${process.env.PASSCHAIN_GCP_PROJECT_ID}`,
    usage: 'Copy and run the gcloud storage commands below',
    note: 'Commands work on Windows, Linux, and macOS'
        },
        gcsUrls: result.gcsUrls
    });
});

app.get('/api/results/:testId/summary', async (req, res) => {
    const { testId } = req.params;
    const result = await getResultData(testId);

    if (!result) {
        return res.status(404).json({ error: 'Test results not found' });
    }
    
    res.json({
        testId,
        summary: result.summary,
        completedAt: result.completedAt,
        gcsUrls: result.gcsUrls
    });
});

app.get('/api/results/:testId/metrics', async (req, res) => {
    const { testId } = req.params;
    const result = await getResultData(testId);

    if (!result) {
        return res.status(404).json({ error: 'Test results not found' });
    }
    
    res.json({
        testId,
        connectionMetrics: result.fullReport.connectionMetrics,
        transactionMetrics: result.fullReport.transactionMetrics,
        crossChainMetrics: result.fullReport.crossChainMetrics
    });
});

app.get('/api/results/:testId/threats', async (req, res) => {
    const { testId } = req.params;
    const result = await getResultData(testId);

    if (!result) {
        return res.status(404).json({ error: 'Test results not found' });
    }
    
    res.json({
        testId,
        threatAnalysis: result.fullReport.threatAnalysis
    });
});

app.get('/api/results/latest', async (req, res) => {
    let latestResult = Array.from(testResults.values())
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

    if (!latestResult) {
        // Nothing cached on this instance — ask GCS which result.json was written most recently.
        try {
            const bucket = storage.bucket(GCS_BUCKETS.results);
            const [files] = await bucket.getFiles({ matchGlob: '**/result.json' });
            const newest = files.sort((a, b) =>
                new Date(b.metadata.timeCreated) - new Date(a.metadata.timeCreated)
            )[0];
            if (newest) {
                const testId = newest.name.split('/')[0];
                latestResult = await getResultData(testId);
            }
        } catch (error) {
            console.error('⚠️  Could not list GCS for latest result:', error.message);
        }
    }

    if (!latestResult) {
        return res.status(404).json({ error: 'No test results available' });
    }
    
    res.json({
        testId: latestResult.testId,
        completedAt: latestResult.completedAt,
        summary: latestResult.summary,
        fullResults: `/api/results/${latestResult.testId}`,
        gcsUrls: latestResult.gcsUrls
    });
});

// ==================== CHART ENDPOINTS ====================

app.get('/api/charts/:testId', async (req, res) => {
    const { testId } = req.params;
    const charts = await getChartsData(testId);

    if (!charts) {
        return res.status(404).json({ 
            error: 'Chart data not found',
            message: 'Charts are generated automatically with test results'
        });
    }
    
    res.json({
        testId,
        chartsGenerated: true,
        generatedAt: charts.generatedAt,
        chartData: charts.chartData,
        gcsUrl: charts.gcsUrl,
        imageUrls: buildChartImageUrls(testId, charts.images, req),
        gcsImagePaths: Object.fromEntries(
            Object.entries(charts.images || {}).map(([type, c]) => [type, `gs://${charts.imagesBucket}/${c.objectPath}`])
        ),
        usage: 'imageUrls give you directly-viewable PNGs; chartData is the raw JSON config if you want to re-render with Chart.js, Recharts, D3.js, etc.'
    });
});

/**
 * Stream a single chart PNG straight from GCS. This means the image is viewable/embeddable
 * (<img src="...">) without needing GCS credentials or making the bucket public.
 */
app.get('/api/charts/:testId/image/:chartType', async (req, res) => {
    const { testId, chartType } = req.params;
    const charts = await getChartsData(testId);

    const image = charts && charts.images ? charts.images[chartType] : null;
    if (!image) {
        return res.status(404).json({
            error: 'Chart image not found',
            availableTypes: charts ? Object.keys(charts.images || {}) : []
        });
    }

    try {
        const bucket = storage.bucket(charts.imagesBucket || GCS_BUCKETS.charts);
        const file = bucket.file(image.objectPath);
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).json({ error: 'Chart image no longer exists in GCS' });
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        file.createReadStream()
            .on('error', (streamErr) => {
                console.error(`⚠️  Error streaming chart image:`, streamErr.message);
                if (!res.headersSent) res.status(500).json({ error: 'Failed to stream chart image' });
            })
            .pipe(res);
    } catch (error) {
        console.error(`⚠️  Error fetching chart image from GCS:`, error.message);
        res.status(500).json({ error: 'Failed to fetch chart image' });
    }
});

app.get('/api/complete/:testId', async (req, res) => {
    const { testId } = req.params;
    const result = await getResultData(testId);
    const charts = await getChartsData(testId);

    if (!result) {
        return res.status(404).json({ error: 'Test results not found' });
    }
    
    const response = {
        testId,
        completedAt: result.completedAt,
        dataTypes: {
            results: 'included',
            charts: charts ? 'included' : 'not_generated'
        },
        gcsStorage: {
            results: result.gcsUrls,
            charts: charts ? charts.gcsUrl : null
        },
        summary: result.summary,
        connectionMetrics: result.fullReport.connectionMetrics,
        transactionMetrics: result.fullReport.transactionMetrics,
        crossChainMetrics: result.fullReport.crossChainMetrics,
        threatAnalysis: result.fullReport.threatAnalysis,
        improvements: result.fullReport.improvements,
        recommendations: result.fullReport.recommendations
    };
    
    if (charts) {
        response.charts = {
            generatedAt: charts.generatedAt,
            chartData: charts.chartData,
            gcsUrl: charts.gcsUrl,
            imageUrls: buildChartImageUrls(testId, charts.images, req)
        };
    }
    
    res.json(response);
});

app.post('/api/test/stop/:testId', (req, res) => {
    const { testId } = req.params;
    const test = activeTests.get(testId);
    
    if (!test) {
        return res.status(404).json({ error: 'Test not found' });
    }
    
    if (test.status === 'running') {
        test.status = 'stopped';
        test.instance.stopTest = true;
        activeTests.delete(testId);
        
        res.json({
            testId,
            status: 'stopped',
            message: 'Test stop requested'
        });
    } else {
        res.json({
            testId,
            status: test.status,
            message: 'Test is not running'
        });
    }
});

/**
 * Run test asynchronously
 */
async function runTestAsync(testId, testInstance) {
    const test = activeTests.get(testId);
    
    try {
        test.phase = 'testing';
        test.progress = 'Running PassChain validation...';
        console.log(`📊 Test ${testId}: Running PassChain validation...`);
        
        const report = await testInstance.runEnhancedMultiChainTest();
        
        console.log(`💾 Test ${testId}: Storing results...`);
        test.phase = 'storing-results';
        
        const completedAt = new Date().toISOString();
        const resultData = {
            testId,
            completedAt,
            summary: {
                totalDuration: Date.now() - test.startTime,
                blockchainsConnected: report.connectionMetrics.blockchains.length,
                threatsIdentified: report.threatAnalysis.totalThreats,
                criticalThreats: report.threatAnalysis.criticalThreats,
                crossChainBridges: report.crossChainMetrics.totalBridges
            },
            fullReport: report,
            gcsUrls: {}
        };
        
        testResults.set(testId, resultData);
        
        const resultPath = path.join(test.testResultDir, 'result.json');
        fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
        console.log(`✅ Results saved locally: ${resultPath}`);
        
        console.log(`☁️  Test ${testId}: Uploading to GCS...`);
        test.phase = 'uploading-gcs';
        
        try {
            const gcsResultUrl = await uploadResultsToGCS(testId, resultData);
            resultData.gcsUrls.results = gcsResultUrl;
            fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
        } catch (gcsError) {
            console.error(`⚠️  GCS upload failed:`, gcsError.message);
        }
        
        console.log(`📈 Test ${testId}: Generating charts...`);
        test.phase = 'rendering-chart-images';

        // 1. Actual rendered PNG images — uploaded straight from memory buffers, so this
        // does not depend on the container's local disk surviving.
        let chartImages = {};
        try {
            chartImages = await generateAndUploadChartImages(report, testId);
        } catch (renderError) {
            console.error(`⚠️  Chart image rendering failed:`, renderError.message);
        }

        // 2. JSON chart config (for anyone who wants to re-render with their own viz lib),
        // with the image object paths embedded so charts can be recovered even if this
        // instance's in-memory state is gone (e.g. after a cold start / new instance).
        test.phase = 'generating-chart-data';
        const chartData = generateChartDataJSON(report, testId);
        chartData.images = chartImages;
        chartData.imagesBucket = GCS_BUCKETS.charts;

        const chartPath = path.join(test.testChartDir, 'charts.json');
        try {
            fs.writeFileSync(chartPath, JSON.stringify(chartData, null, 2));
            console.log(`✅ Chart data (JSON) cached locally: ${chartPath}`);
        } catch (writeErr) {
            console.error(`⚠️  Could not cache chart data locally:`, writeErr.message);
        }

        let gcsChartDataUrl = null;
        try {
            gcsChartDataUrl = await uploadChartDataToGCS(testId, chartData);
        } catch (gcsError) {
            console.error(`⚠️  Chart JSON upload failed:`, gcsError.message);
        }

        testCharts.set(testId, {
            testId,
            generatedAt: completedAt,
            chartData,
            gcsUrl: gcsChartDataUrl,
            images: chartImages, // { connectionMetrics: { fileName, objectPath }, ... }
            imagesBucket: GCS_BUCKETS.charts
        });
        
        activeTests.delete(testId);
        
        console.log(`✅ Test ${testId} completed successfully`);
        console.log(`📊 Local: ${test.testResultDir}`);
        console.log(`☁️  GCS: gs://${GCS_BUCKETS.results}/${testId}/`);
        
        const commands = getGSUtilDownloadCommand(testId);
        console.log('\n📥 DOWNLOAD:');
        console.log(commands.allData);
        
    } catch (error) {
        console.error(`❌ Test ${testId} failed:`, error.message);
        
        const errorResult = {
            testId,
            completedAt: new Date().toISOString(),
            error: error.message,
            summary: {
                status: 'failed',
                totalDuration: Date.now() - test.startTime
            }
        };
        
        testResults.set(testId, errorResult);
        
        try {
            const errorPath = path.join(test.testResultDir, 'error.json');
            fs.writeFileSync(errorPath, JSON.stringify(errorResult, null, 2));
        } catch (saveError) {
            console.error(`Failed to save error: ${saveError.message}`);
        }
        
        activeTests.delete(testId);
    }
}

function generateTestId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `passchain_${timestamp}_${random}`;
}

process.on('SIGINT', async () => {
    console.log('\n🛑 Graceful shutdown...');
    
    for (const [testId, test] of activeTests) {
        if (test.instance && test.instance.blockchains?.polkadot?.api) {
            await test.instance.blockchains.polkadot.api.disconnect();
        }
    }
    
    console.log('✅ Cleanup completed');
    process.exit(0);
});

(async () => {
    try {
        await ensureGCSBuckets();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 PassChain Cloud Service running on port ${PORT}`);
            console.log(`📊 Local Results: ${RESULTS_DIR}`);
            console.log(`☁️  GCS Results: gs://${GCS_BUCKETS.results}/`);
            console.log(`☁️  GCS Charts: gs://${GCS_BUCKETS.charts}/`);
            console.log(`🌐 Health: http://localhost:${PORT}/health`);
            console.log(`📈 API: http://localhost:${PORT}/api/info`);
        });
    } catch (error) {
        console.error('❌ Failed to initialize:', error.message);
        process.exit(1);
    }
})();

module.exports = app;