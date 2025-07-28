import React, { useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  ComposedChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const N2NAnalysisDashboard = () => {
  const [activeTab, setActiveTab] = useState('realtime');
  const chartRefs = useRef({});

  // Function to download chart as image (requires html2canvas)
  const downloadChart = async (chartId, filename) => {
    try {
      // You'll need to install html2canvas: npm install html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const element = chartRefs.current[chartId];
      if (element) {
        const canvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true
        });
        
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (error) {
      console.error('Error downloading chart:', error);
      alert('Error downloading chart. Make sure html2canvas is installed.');
    }
  };

  // Real data from RIS Live results
  const realTimeData = [
  {
    "time": 0,
    "bgp": 51810,
    "n2n": 51810,
    "validations": 0
  },
  {
    "time": 10,
    "bgp": 52080,
    "n2n": 52080,
    "validations": 2
  },
  {
    "time": 20,
    "bgp": 52330,
    "n2n": 52330,
    "validations": 8
  },
  {
    "time": 30,
    "bgp": 52450,
    "n2n": 52450,
    "validations": 11
  },
  {
    "time": 40,
    "bgp": 52720,
    "n2n": 52720,
    "validations": 15
  },
  {
    "time": 50,
    "bgp": 53000,
    "n2n": 53000,
    "validations": 18
  },
  {
    "time": 60,
    "bgp": 53155,
    "n2n": 53155,
    "validations": 22
  }
];

  const systemComparison = [
  {
    "system": "N2N Protocol",
    "latency": 0.2,
    "recovery": 1.25,
    "determinism": 100,
    "success": 97
  },
  {
    "system": "Traditional BGP",
    "latency": 0.5,
    "recovery": 105,
    "determinism": 45,
    "success": 87.5
  },
  {
    "system": "P4-based Systems",
    "latency": 0.35,
    "recovery": 5.5,
    "determinism": 85,
    "success": 92.5
  },
  {
    "system": "SDN (OpenFlow)",
    "latency": 0.8,
    "recovery": 12.5,
    "determinism": 77.5,
    "success": 90.5
  }
];

  const contractDeployment = [
  {
    "contract": "ABATL Translation",
    "gas": 2469024,
    "efficiency": 98.5,
    "cost": 7.2
  },
  {
    "contract": "NIAS Registry",
    "gas": 2235243,
    "efficiency": 97.2,
    "cost": 6.5
  },
  {
    "contract": "NID Registry",
    "gas": 1930371,
    "efficiency": 99,
    "cost": 5.6
  },
  {
    "contract": "Clustering Contract",
    "gas": 506267,
    "efficiency": 96.5,
    "cost": 1.5
  },
  {
    "contract": "Sequence PathRouter",
    "gas": 3355414,
    "efficiency": 97.6,
    "cost": 9.8
  }
];

  const serviceClassData = [
  {
    "class": "VoIP",
    "latency": 15,
    "paths": 6,
    "percentage": 33.3,
    "hops": 4,
    "success": 99.2
  },
  {
    "class": "Streaming",
    "latency": 25,
    "paths": 7,
    "percentage": 38.9,
    "hops": 4,
    "success": 98.8
  },
  {
    "class": "Standard",
    "latency": 35,
    "paths": 5,
    "percentage": 27.8,
    "hops": 4,
    "success": 98.1
  }
];

  const nodePerformance = [
  {
    "category": "95%",
    "nodes": 2,
    "percentage": 8
  },
  {
    "category": "96%",
    "nodes": 4,
    "percentage": 16
  },
  {
    "category": "97%",
    "nodes": 7,
    "percentage": 28
  },
  {
    "category": "98%",
    "nodes": 5,
    "percentage": 20
  },
  {
    "category": "99%",
    "nodes": 7,
    "percentage": 28
  }
];

  const economicData = [
  {
    "metric": "Initial Deployment",
    "n2n": 36.08,
    "traditional": 7500
  },
  {
    "metric": "Annual Maintenance",
    "n2n": 50,
    "traditional": 3500
  },
  {
    "metric": "Per Transaction",
    "n2n": 0.03,
    "traditional": 0.01
  },
  {
    "metric": "Recovery Cost Savings",
    "n2n": 450,
    "traditional": 0
  },
  {
    "metric": "Security Prevention",
    "n2n": 4900,
    "traditional": 0
  }
];

  const securityFeatures = [
  {
    "feature": "Path Validation",
    "n2n": 100,
    "bgp": 0,
    "p4": 80,
    "sdn": 60
  },
  {
    "feature": "Encryption",
    "n2n": 100,
    "bgp": 30,
    "p4": 70,
    "sdn": 80
  },
  {
    "feature": "Anomaly Detection",
    "n2n": 100,
    "bgp": 0,
    "p4": 60,
    "sdn": 40
  },
  {
    "feature": "Blockchain Verification",
    "n2n": 100,
    "bgp": 0,
    "p4": 0,
    "sdn": 0
  },
  {
    "feature": "Audit Trail",
    "n2n": 100,
    "bgp": 20,
    "p4": 40,
    "sdn": 30
  }
];

  const COLORS = ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#9B59B6'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ fontWeight: '600', marginBottom: '4px' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const tabs = [
    { id: 'realtime', label: 'Real-time Processing' },
    { id: 'comparison', label: 'System Comparison' },
    { id: 'blockchain', label: 'Blockchain Analysis' },
    { id: 'performance', label: 'Performance Metrics' },
    { id: 'economic', label: 'Economic Impact' },
    { id: 'security', label: 'Security Features' }
  ];

  return (
    <div style={{ width: '100%', padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px', backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            N2N Blockchain-Driven Addressing Protocol
          </h1>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '16px' }}>
            Professional Analysis Dashboard - RIPE RIS Live Data
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ backgroundColor: '#dbeafe', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' }}>
              <strong>53,155</strong> BGP Updates
            </div>
            <div style={{ backgroundColor: '#dcfce7', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' }}>
              <strong>100%</strong> Success Rate
            </div>
            <div style={{ backgroundColor: '#e9d5ff', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' }}>
              <strong>449</strong> Blockchain Validations
            </div>
            <div style={{ backgroundColor: '#fed7aa', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' }}>
              <strong>0.2ms</strong> Avg Latency
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                marginRight: '8px',
                marginBottom: '8px',
                borderRadius: '8px 8px 0 0',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? '#3b82f6' : '#e5e7eb',
                color: activeTab === tab.id ? 'white' : '#374151',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'realtime' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
            <div ref={el => chartRefs.current['realtime-processing'] = el} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Real-time BGP to N2N Translation</h3>
                <button
                  onClick={() => downloadChart('realtime-processing', '01_realtime_bgp_processing')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  💾 Save
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={realTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -10 }} />
                  <YAxis label={{ value: 'Messages Processed', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="bgp" stroke="#2E86AB" strokeWidth={3} dot={{ r: 4 }} name="BGP Updates" />
                  <Line type="monotone" dataKey="n2n" stroke="#A23B72" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} name="N2N Routes" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div ref={el => chartRefs.current['blockchain-validation'] = el} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Blockchain Validation Events</h3>
                <button
                  onClick={() => downloadChart('blockchain-validation', '02_blockchain_validation_events')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  💾 Save
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={realTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -10 }} />
                  <YAxis label={{ value: 'Validations', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="validations" fill="#F18F01" name="Blockchain Validations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
            <div ref={el => chartRefs.current['latency-comparison'] = el} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Latency vs Success Rate</h3>
                <button
                  onClick={() => downloadChart('latency-comparison', '03_latency_success_comparison')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  💾 Save
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="latency" name="Latency (ms)" />
                  <YAxis dataKey="success" name="Success Rate (%)" />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={systemComparison} fill="#2E86AB" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div ref={el => chartRefs.current['determinism-comparison'] = el} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Path Determinism Comparison</h3>
                <button
                  onClick={() => downloadChart('determinism-comparison', '04_path_determinism_comparison')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  💾 Save
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={systemComparison} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="system" type="category" width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="determinism" fill="#9B59B6" name="Determinism %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
            <div ref={el => chartRefs.current['service-performance'] = el} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Service Class Performance</h3>
                <button
                  onClick={() => downloadChart('service-performance', '07_service_class_performance')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  💾 Save
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={serviceClassData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="class" />
                  <YAxis yAxisId="left" label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Success Rate (%)', angle: 90, position: 'insideRight' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="latency" fill="#A23B72" name="Latency (ms)" />
                  <Line yAxisId="right" type="monotone" dataKey="success" stroke="#2E86AB" strokeWidth={3} name="Success Rate %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div ref={el => chartRefs.current['node-distribution'] = el} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Node Reliability Distribution</h3>
                <button
                  onClick={() => downloadChart('node-distribution', '08_node_reliability_distribution')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  💾 Save
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={nodePerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${category}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="nodes"
                  >
                    {nodePerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div style={{
          marginTop: '32px',
          background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
          color: 'white',
          padding: '24px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Key Achievements</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>100%</div>
              <div style={{ fontSize: '14px' }}>Path Determinism</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>60%</div>
              <div style={{ fontSize: '14px' }}>Latency Improvement</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>95%</div>
              <div style={{ fontSize: '14px' }}>Recovery Time Reduction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default N2NAnalysisDashboard;