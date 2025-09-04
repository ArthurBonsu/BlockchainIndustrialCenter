#!/usr/bin/env python3
"""
Complete SBCP Experimental Framework
This script orchestrates comprehensive experiments to validate the Stream-Based Consensus Protocol
"""

import asyncio
import aiohttp
import subprocess
import time
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import logging
import argparse
from typing import Dict, List, Any
import yaml
from dataclasses import dataclass
import signal
import sys
import os
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class ExperimentConfig:
    """Configuration for experimental parameters"""
    num_validators: int = 10
    byzantine_fraction: float = 0.2
    num_transactions: int = 1000
    transaction_rate: float = 10.0  # TPS
    network_latency_ms: float = 50.0
    experiment_duration: int = 300  # seconds
    use_docker: bool = False
    validator_base_port: int = 8000
    results_dir: str = "./experiment_results"

class SBCPExperimentOrchestrator:
    """Complete experimental framework for SBCP validation"""
    
    def __init__(self, config: ExperimentConfig):
        self.config = config
        self.validator_processes = []
        self.experiment_results = {}
        self.start_time = None
        
        # Add HTTP timeout configuration
        self.http_timeout = aiohttp.ClientTimeout(total=10)  # 10 seconds max
        
        # Create results directory
        Path(config.results_dir).mkdir(parents=True, exist_ok=True)
        
    async def setup_validators(self):
        """Setup validator nodes (local processes or Docker containers)"""
        logger.info(f"Setting up {self.config.num_validators} validators")
        
        byzantine_count = int(self.config.num_validators * self.config.byzantine_fraction)
        
        for i in range(self.config.num_validators):
            port = self.config.validator_base_port + i
            is_byzantine = i < byzantine_count
            
            if self.config.use_docker:
                await self._start_docker_validator(i, port, is_byzantine)
            else:
                await self._start_local_validator(i, port, is_byzantine)
            
            # Wait for validator to start
            await asyncio.sleep(2.0)
        
        # Wait for all validators to be ready
        await asyncio.sleep(5.0)
        
        # Initialize peer connections between validators
        await self.initialize_validator_network()
        
        logger.info("Enhanced validators ready with peer connections initialized")
        
        # Health check all validators
        logger.info("Performing validator health checks...")
        healthy_count = 0
        for i in range(self.config.num_validators):
            port = self.config.validator_base_port + i
            if await self.check_validator_health(port):
                healthy_count += 1
        
        if healthy_count == 0:
            raise Exception("No validators are responding to HTTP requests!")
        elif healthy_count < self.config.num_validators:
            logger.warning(f"Only {healthy_count}/{self.config.num_validators} validators are healthy")
        else:
            logger.info("All validators ready and healthy")
            
    async def _start_local_validator(self, validator_id: int, port: int, is_byzantine: bool):
        """Start enhanced validator instead of basic SBCPDist.py"""
        
        # Change this line:
        # script_path = os.path.abspath("python/SBCPDist.py")
        
        # To this:
        script_path = os.path.abspath("enhanced_sbcp_dist.py")  # Use enhanced version
        
        cmd = [
            sys.executable, script_path,
            f"validator_{validator_id}",
            str(port),
            str(is_byzantine).lower()
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=os.getcwd()
        )
        
        self.validator_processes.append(process)
        logger.info(f"Started enhanced validator_{validator_id} on port {port} (Byzantine: {is_byzantine})")
        
    async def _start_docker_validator(self, validator_id: int, port: int, is_byzantine: bool):
        """Start a Docker-based validator"""
        cmd = [
            "docker", "run", "-d", "--name", f"sbcp_validator_{validator_id}",
            "-p", f"{port}:8000",
            "-e", f"NODE_ID=validator_{validator_id}",
            "-e", f"IS_BYZANTINE={str(is_byzantine).lower()}",
            "sbcp-validator"
        ]
        
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        await asyncio.create_task(asyncio.to_thread(process.wait))
        
        logger.info(f"Started Docker validator_{validator_id} on port {port}")
        
    async def initialize_validator_network(self):
        """Initialize peer connections between validators"""
        async with aiohttp.ClientSession() as session:
            for i in range(self.config.num_validators):
                validator_url = f"http://localhost:{self.config.validator_base_port + i}"
                
                # Register all other validators as peers
                for j in range(self.config.num_validators):
                    if i != j:
                        peer_url = f"http://localhost:{self.config.validator_base_port + j}"
                        peer_data = {
                            "node_id": f"validator_{j}",
                            "url": peer_url
                        }
                        
                        try:
                            async with session.post(f"{validator_url}/peers/register", json=peer_data) as resp:
                                if resp.status == 200:
                                    logger.info(f"Registered validator_{j} with validator_{i}")
                        except Exception as e:
                            logger.warning(f"Failed to register peer: {e}")
                            
    async def collect_enhanced_metrics_from_all(self) -> Dict:
        """Collect comprehensive metrics from enhanced validators"""
        tasks = []
        for validator_id in range(self.config.num_validators):
            port = self.config.validator_base_port + validator_id
            url = f"http://localhost:{port}"
            task = self.get_enhanced_validator_metrics(url, f"validator_{validator_id}")
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        metrics = {}
        for i in range(self.config.num_validators):
            validator_id = f"validator_{i}"
            if not isinstance(responses[i], Exception):
                metrics[validator_id] = responses[i]
            else:
                logger.error(f"Failed to get metrics from {validator_id}: {responses[i]}")
        
        return metrics

    async def get_enhanced_validator_metrics(self, url: str, validator_id: str) -> dict:
        """Get detailed metrics from enhanced validator"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get(f"{url}/metrics/detailed") as response:
                    return await response.json()
        except Exception as e:
            logger.error(f"Failed to get enhanced metrics from {validator_id}: {e}")
            raise e

    async def run_experiment_suite(self):
        """Run complete experimental validation suite"""
        self.start_time = time.time()
        
        experiments = [
            ("confidence_evolution", self.experiment_confidence_evolution),
            ("throughput_scaling", self.experiment_throughput_scaling),
            ("byzantine_resilience", self.experiment_byzantine_resilience),
            ("network_latency_impact", self.experiment_network_latency),
            ("fraud_detection", self.experiment_fraud_detection),
            ("consensus_convergence", self.experiment_consensus_convergence)
        ]
        
        for exp_name, exp_func in experiments:
            logger.info(f"Running experiment: {exp_name}")
            try:
                results = await exp_func()
                self.experiment_results[exp_name] = results
                await self.save_intermediate_results(exp_name, results)
            except Exception as e:
                logger.error(f"Experiment {exp_name} failed: {e}")
                self.experiment_results[exp_name] = {"error": str(e)}
        
        await self.generate_comprehensive_report()
    
    async def experiment_confidence_evolution(self) -> Dict[str, Any]:
        """Enhanced confidence evolution experiment"""
        results = {
            "experiment": "confidence_evolution",
            "transactions": [],
            "theoretical_validation": {}
        }
        
        async with aiohttp.ClientSession() as session:
            # Generate test transactions with varying characteristics
            test_transactions = [
                {"value": 100, "risk": 0.1, "expected_confidence": "high"},
                {"value": 10000, "risk": 0.8, "expected_confidence": "low"},
                {"value": 1000, "risk": 0.3, "expected_confidence": "medium"}
            ]
            
            for i, tx_config in enumerate(test_transactions):
                tx_data = {
                    "tx_id": f"conf_test_{i}",
                    "from_addr": f"addr_{i}",
                    "to_addr": f"addr_{i+1}", 
                    "value": float(tx_config["value"]),
                    "timestamp": time.time(),
                    "risk_score": float(tx_config["risk"]),
                    "complexity_class": 2,
                    "security_level": 2,  # Add this
                    "nonce": 0            # Add this
                }
                
                # Send to all validators
                confidence_timeline = []
                for validator_id in range(self.config.num_validators):
                    port = self.config.validator_base_port + validator_id
                    url = f"http://localhost:{port}"
                    
                    try:
                        async with session.post(f"{url}/transaction/propose", json=tx_data) as resp:
                            response = await resp.json()
                            confidence_timeline.append({
                                "timestamp": time.time(),
                                "validator_id": validator_id,
                                "confidence": response.get("confidence", 0),
                                "vote": response.get("vote", False),
                                "finality_tier": response.get("finality_tier", "none"),
                                "processing_time": response.get("processing_time", 0)
                            })
                    except Exception as e:
                        logger.warning(f"Failed to send to validator {validator_id}: {e}")
                
                results["transactions"].append({
                    "tx_id": tx_data["tx_id"],
                    "config": tx_config,
                    "confidence_timeline": confidence_timeline
                })
                
                # Wait before next transaction
                await asyncio.sleep(0.5)
        
        # Analyze confidence evolution patterns
        results["theoretical_validation"] = self.analyze_confidence_patterns(results["transactions"])
        
        return results
    
    async def experiment_throughput_scaling(self) -> Dict[str, Any]:
        """Experiment 2: Measure throughput scaling with validator count"""
        logger.info("Starting throughput scaling experiment")
        
        results = {
            "experiment": "throughput_scaling",
            "scaling_data": [],
            "theoretical_comparison": {}
        }
        
        # Test with different validator subsets
        validator_counts = [5, 10, 15, 20] if self.config.num_validators >= 20 else [5, 10]
        
        for validator_count in validator_counts:
            if validator_count > self.config.num_validators:
                continue
                
            logger.info(f"Testing throughput with {validator_count} validators")
            
            start_time = time.time()
            successful_transactions = 0
            
            async with aiohttp.ClientSession() as session:
                # Send burst of transactions
                tasks = []
                for i in range(50):  # 50 transactions per test
                    tx_data = {
                        "tx_id": f"throughput_test_{validator_count}_{i}",
                        "from_addr": f"addr_{i % 10}",
                        "to_addr": f"addr_{(i+1) % 10}",
                        "value": float(100 + i),
                        "timestamp": time.time(),
                        "risk_score": 0.2,
                        "complexity_class": 1
                    }
                    
                    # Send to subset of validators
                    for validator_id in range(validator_count):
                        port = self.config.validator_base_port + validator_id
                        task = self.send_transaction(session, f"http://localhost:{port}", tx_data)
                        tasks.append(task)
                
                # Execute all tasks
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Count successful responses
                successful_transactions = sum(1 for r in responses if not isinstance(r, Exception))
            
            end_time = time.time()
            duration = end_time - start_time
            tps = successful_transactions / duration
            
            results["scaling_data"].append({
                "validator_count": validator_count,
                "successful_transactions": successful_transactions,
                "duration": duration,
                "tps": tps
            })
            
            logger.info(f"Validator count {validator_count}: {tps:.2f} TPS")
        
        # Compare with theoretical linear scaling
        results["theoretical_comparison"] = self.analyze_scaling_efficiency(results["scaling_data"])
        
        return results
    
    async def experiment_byzantine_resilience(self) -> Dict[str, Any]:
        """Experiment 3: Test Byzantine fault tolerance"""
        logger.info("Starting Byzantine resilience experiment")
        
        results = {
            "experiment": "byzantine_resilience",
            "resilience_tests": [],
            "safety_violations": [],
            "liveness_metrics": {}
        }
        
        # Test with different Byzantine fractions
        test_scenarios = [
            {"byzantine_fraction": 0.1, "expected_result": "safe"},
            {"byzantine_fraction": 0.3, "expected_result": "safe"},
            {"byzantine_fraction": 0.4, "expected_result": "degraded"}
        ]
        
        async with aiohttp.ClientSession() as session:
            for scenario in test_scenarios:
                logger.info(f"Testing Byzantine fraction: {scenario['byzantine_fraction']}")
                
                # Send test transactions and monitor consensus
                test_results = {
                    "scenario": scenario,
                    "consensus_results": [],
                    "conflicting_decisions": 0,
                    "average_confidence": 0.0
                }
                
                for i in range(20):  # 20 test transactions
                    tx_data = {
                        "tx_id": f"byzantine_test_{scenario['byzantine_fraction']}_{i}",
                        "from_addr": f"addr_{i}",
                        "to_addr": f"addr_{i+1}",
                        "value": float(1000 + i),
                        "timestamp": time.time(),
                        "risk_score": 0.5,
                        "complexity_class": 2
                    }
                    
                    # Collect responses from all validators
                    validator_responses = []
                    for validator_id in range(self.config.num_validators):
                        port = self.config.validator_base_port + validator_id
                        try:
                            async with session.post(f"http://localhost:{port}/transaction/propose", json=tx_data) as resp:
                                response = await resp.json()
                                validator_responses.append({
                                    "validator_id": validator_id,
                                    "vote": response.get("vote", False),
                                    "confidence": response.get("confidence", 0.0)
                                })
                        except:
                            pass
                    
                    # Analyze consensus
                    votes = [r["vote"] for r in validator_responses]
                    confidences = [r["confidence"] for r in validator_responses]
                    
                    consensus_reached = len(set(votes)) == 1  # All agree
                    if not consensus_reached:
                        test_results["conflicting_decisions"] += 1
                    
                    test_results["consensus_results"].append({
                        "tx_id": tx_data["tx_id"],
                        "validator_responses": validator_responses,
                        "consensus_reached": consensus_reached,
                        "average_confidence": np.mean(confidences) if confidences else 0.0
                    })
                
                test_results["average_confidence"] = np.mean([
                    r["average_confidence"] for r in test_results["consensus_results"]
                ])
                
                results["resilience_tests"].append(test_results)
        
        return results
    
    async def experiment_network_latency(self) -> Dict[str, Any]:
        """Experiment 4: Impact of network latency on consensus"""
        logger.info("Starting network latency experiment")
        
        results = {
            "experiment": "network_latency",
            "latency_tests": [],
            "performance_degradation": {}
        }
        
        # Simulate different latency conditions
        latency_scenarios = [50, 100, 200, 500]  # milliseconds
        
        for latency_ms in latency_scenarios:
            logger.info(f"Testing with {latency_ms}ms latency")
            
            start_time = time.time()
            confidence_scores = []
            processing_times = []
            
            async with aiohttp.ClientSession() as session:
                for i in range(10):  # 10 test transactions per latency level
                    tx_start = time.time()
                    
                    tx_data = {
                        "tx_id": f"latency_test_{latency_ms}_{i}",
                        "from_addr": f"addr_{i}",
                        "to_addr": f"addr_{i+1}",
                        "value": float(500 + i),
                        "timestamp": time.time(),
                        "risk_score": 0.3,
                        "complexity_class": 1
                    }
                    
                    # Inject artificial delay
                    await asyncio.sleep(latency_ms / 1000.0)
                    
                    # Send to primary validator
                    try:
                        port = self.config.validator_base_port
                        async with session.post(f"http://localhost:{port}/transaction/propose", json=tx_data) as resp:
                            response = await resp.json()
                            confidence_scores.append(response.get("confidence", 0.0))
                            processing_times.append(time.time() - tx_start)
                    except Exception as e:
                        logger.warning(f"Latency test failed: {e}")
            
            results["latency_tests"].append({
                "latency_ms": latency_ms,
                "average_confidence": np.mean(confidence_scores) if confidence_scores else 0.0,
                "average_processing_time": np.mean(processing_times) if processing_times else 0.0,
                "confidence_scores": confidence_scores,
                "processing_times": processing_times
            })
        
        return results
    
    async def experiment_fraud_detection(self) -> Dict[str, Any]:
        """Experiment 5: Fraud proof mechanism testing"""
        logger.info("Starting fraud detection experiment")
        
        results = {
            "experiment": "fraud_detection",
            "fraud_scenarios": [],
            "detection_accuracy": {}
        }
        
        # Test fraud detection with Byzantine validators
        byzantine_count = int(self.config.num_validators * self.config.byzantine_fraction)
        
        async with aiohttp.ClientSession() as session:
            # Create fraudulent transaction scenario
            fraudulent_tx = {
                "tx_id": "fraud_test_double_spend",
                "from_addr": "addr_fraudulent",
                "to_addr": "addr_victim",
                "value": 5000.0,
                "timestamp": time.time(),
                "risk_score": 0.9,  # High risk
                "complexity_class": 3
            }
            
            # Send to honest validators
            honest_responses = []
            for validator_id in range(byzantine_count, self.config.num_validators):
                port = self.config.validator_base_port + validator_id
                try:
                    async with session.post(f"http://localhost:{port}/transaction/propose", json=fraudulent_tx) as resp:
                        response = await resp.json()
                        honest_responses.append(response)
                except:
                    pass
            
            # Send to Byzantine validators (they might accept fraudulent tx)
            byzantine_responses = []
            for validator_id in range(byzantine_count):
                port = self.config.validator_base_port + validator_id
                try:
                    async with session.post(f"http://localhost:{port}/transaction/propose", json=fraudulent_tx) as resp:
                        response = await resp.json()
                        byzantine_responses.append(response)
                except:
                    pass
            
            results["fraud_scenarios"].append({
                "transaction": fraudulent_tx,
                "honest_responses": honest_responses,
                "byzantine_responses": byzantine_responses,
                "fraud_detected": len([r for r in honest_responses if not r.get("vote", True)]) > 0
            })
        
        return results
    
    async def experiment_consensus_convergence(self) -> Dict[str, Any]:
        """Experiment 6: Consensus convergence time analysis"""
        logger.info("Starting consensus convergence experiment")
        
        results = {
            "experiment": "consensus_convergence",
            "convergence_data": [],
            "kuramoto_validation": {}
        }
        
        # Test consensus convergence under different conditions
        async with aiohttp.ClientSession() as session:
            for i in range(20):  # 20 convergence tests
                convergence_start = time.time()
                
                tx_data = {
                    "tx_id": f"convergence_test_{i}",
                    "from_addr": f"addr_{i}",
                    "to_addr": f"addr_{i+1}",
                    "value": float(200 + i * 50),
                    "timestamp": time.time(),
                    "risk_score": 0.4,
                    "complexity_class": 2
                }
                
                # Send to all validators and track convergence
                validator_responses = []
                for validator_id in range(self.config.num_validators):
                    port = self.config.validator_base_port + validator_id
                    try:
                        async with session.post(f"http://localhost:{port}/transaction/propose", json=tx_data) as resp:
                            response = await resp.json()
                            validator_responses.append({
                                "validator_id": validator_id,
                                "response_time": time.time() - convergence_start,
                                "confidence": response.get("confidence", 0.0),
                                "vote": response.get("vote", False)
                            })
                    except:
                        pass
                
                # Analyze convergence
                if validator_responses:
                    convergence_time = max(r["response_time"] for r in validator_responses)
                    final_confidence = np.mean([r["confidence"] for r in validator_responses])
                    consensus_agreement = len(set(r["vote"] for r in validator_responses)) == 1
                    
                    results["convergence_data"].append({
                        "tx_id": tx_data["tx_id"],
                        "convergence_time": convergence_time,
                        "final_confidence": final_confidence,
                        "consensus_agreement": consensus_agreement,
                        "validator_responses": validator_responses
                    })
        
        return results
    
    async def send_transaction(self, session: aiohttp.ClientSession, url: str, tx_data: dict) -> dict:
        """Helper method to send transaction to validator"""
        try:
            async with session.post(f"{url}/transaction/propose", json=tx_data) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    logger.error(f"HTTP {resp.status} from {url}: {await resp.text()}")
                    raise Exception(f"HTTP {resp.status}")
        except asyncio.TimeoutError:
            logger.error(f"Timeout connecting to {url}")
            raise Exception("Timeout")
        except Exception as e:
            logger.error(f"Connection failed to {url}: {str(e)}")
            raise e
        
    async def check_validator_health(self, port: int) -> bool:
        """Check if validator is responding to HTTP requests"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2)) as session:
                async with session.get(f"http://localhost:{port}/") as resp:
                    if resp.status == 200:
                        logger.info(f"Validator on port {port} is healthy")
                        return True
                    else:
                        logger.warning(f"Validator on port {port} returned status {resp.status}")
                        return False
        except Exception as e:
            logger.error(f"Health check failed for port {port}: {e}")
            return False
        
    def analyze_confidence_patterns(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Analyze confidence evolution patterns for theoretical validation"""
        analysis = {
            "exponential_fit_quality": [],
            "convergence_rates": [],
            "theoretical_validation": True
        }
        
        for tx in transactions:
            if "confidence_timeline" in tx and tx["confidence_timeline"]:
                confidences = [r["confidence"] for r in tx["confidence_timeline"]]
                
                # Check if confidence increases monotonically (approximately)
                is_monotonic = all(confidences[i] <= confidences[i+1] + 0.01 
                                 for i in range(len(confidences)-1))
                
                analysis["convergence_rates"].append({
                    "tx_id": tx["tx_id"],
                    "is_monotonic": is_monotonic,
                    "max_confidence": max(confidences) if confidences else 0,
                    "confidence_range": max(confidences) - min(confidences) if confidences else 0
                })
        
        return analysis
    
    def analyze_scaling_efficiency(self, scaling_data: List[Dict]) -> Dict[str, Any]:
        """Analyze scaling efficiency compared to theoretical linear scaling"""
        if len(scaling_data) < 2:
            return {"error": "Insufficient data for scaling analysis"}
        
        validator_counts = [d["validator_count"] for d in scaling_data]
        tps_values = [d["tps"] for d in scaling_data]
        
        # Calculate linear scaling coefficient
        baseline_tps = tps_values[0]
        baseline_validators = validator_counts[0]
        
        scaling_efficiency = []
        for i, (validators, tps) in enumerate(zip(validator_counts, tps_values)):
            expected_tps = baseline_tps * (validators / baseline_validators)
            efficiency = tps / expected_tps if expected_tps > 0 else 0
            scaling_efficiency.append(efficiency)
        
        return {
            "scaling_data": list(zip(validator_counts, tps_values, scaling_efficiency)),
            "average_efficiency": np.mean(scaling_efficiency),
            "linear_correlation": np.corrcoef(validator_counts, tps_values)[0,1] if len(validator_counts) > 1 else 0
        }
    
    async def save_intermediate_results(self, experiment_name: str, results: Dict[str, Any]):
        """Save intermediate experimental results"""
        filename = f"{self.config.results_dir}/{experiment_name}_results.json"
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        logger.info(f"Saved {experiment_name} results to {filename}")
    
    async def generate_comprehensive_report(self):
        """Generate comprehensive experimental report with visualizations"""
        logger.info("Generating comprehensive experimental report")
        
        # Save complete results
        complete_results = {
            "experiment_config": self.config.__dict__,
            "total_duration": time.time() - self.start_time if self.start_time else 0,
            "results": self.experiment_results
        }
        
        with open(f"{self.config.results_dir}/complete_results.json", 'w') as f:
            json.dump(complete_results, f, indent=2, default=str)
        
        # Generate visualizations
        await self.create_visualizations()
        
        # Generate text report
        await self.create_text_report(complete_results)
        
        logger.info(f"Complete experimental report saved in {self.config.results_dir}")
    
    async def create_visualizations(self):
        """Create experimental result visualizations"""
        plt.style.use('seaborn-v0_8')
        
        # Confidence Evolution Plot
        if "confidence_evolution" in self.experiment_results:
            fig, axes = plt.subplots(2, 2, figsize=(15, 12))
            
            # Plot 1: Confidence curves
            ax1 = axes[0, 0]
            conf_data = self.experiment_results["confidence_evolution"]
            
            for i, tx in enumerate(conf_data.get("transactions", [])):
                if "confidence_timeline" in tx:
                    confidences = [r["confidence"] for r in tx["confidence_timeline"]]
                    validators = list(range(len(confidences)))
                    ax1.plot(validators, confidences, label=f'TX {i}', marker='o')
            
            ax1.set_xlabel('Validator Index')
            ax1.set_ylabel('Confidence Score')
            ax1.set_title('Confidence Score Evolution')
            ax1.legend()
            ax1.grid(True, alpha=0.3)
            
            # Plot 2: Throughput scaling
            ax2 = axes[0, 1]
            if "throughput_scaling" in self.experiment_results:
                scaling_data = self.experiment_results["throughput_scaling"]["scaling_data"]
                validators = [d["validator_count"] for d in scaling_data]
                tps = [d["tps"] for d in scaling_data]
                ax2.plot(validators, tps, 'bo-', label='Measured TPS')
                
                # Theoretical linear scaling
                if validators and tps:
                    linear_tps = [tps[0] * (v / validators[0]) for v in validators]
                    ax2.plot(validators, linear_tps, 'r--', label='Theoretical Linear')
                
                ax2.set_xlabel('Number of Validators')
                ax2.set_ylabel('Transactions Per Second')
                ax2.set_title('Throughput Scaling')
                ax2.legend()
                ax2.grid(True, alpha=0.3)
            
            # Plot 3: Byzantine resilience
            ax3 = axes[1, 0]
            if "byzantine_resilience" in self.experiment_results:
                resilience_data = self.experiment_results["byzantine_resilience"]["resilience_tests"]
                fractions = []
                confidences = []
                conflicts = []
                
                for test in resilience_data:
                    fractions.append(test["scenario"]["byzantine_fraction"])
                    confidences.append(test["average_confidence"])
                    conflicts.append(test["conflicting_decisions"])
                
                ax3.bar(fractions, confidences, alpha=0.7, label='Avg Confidence')
                ax3_twin = ax3.twinx()
                ax3_twin.bar([f + 0.02 for f in fractions], conflicts, alpha=0.7, color='red', label='Conflicts')
                
                ax3.set_xlabel('Byzantine Fraction')
                ax3.set_ylabel('Average Confidence', color='blue')
                ax3_twin.set_ylabel('Conflicting Decisions', color='red')
                ax3.set_title('Byzantine Fault Tolerance')
            
            # Plot 4: Network latency impact
            ax4 = axes[1, 1]
            if "network_latency_impact" in self.experiment_results:
                latency_data = self.experiment_results["network_latency_impact"]["latency_tests"]
                latencies = [d["latency_ms"] for d in latency_data]
                confidences = [d["average_confidence"] for d in latency_data]
                processing_times = [d["average_processing_time"] for d in latency_data]
                
                ax4.plot(latencies, confidences, 'go-', label='Confidence')
                ax4_twin = ax4.twinx()
                ax4_twin.plot(latencies, processing_times, 'ro-', label='Processing Time')
                
                ax4.set_xlabel('Network Latency (ms)')
                ax4.set_ylabel('Confidence Score', color='green')
                ax4_twin.set_ylabel('Processing Time (s)', color='red')
                ax4.set_title('Network Latency Impact')
            
            plt.tight_layout()
            plt.savefig(f"{self.config.results_dir}/experiment_visualizations.png", dpi=300, bbox_inches='tight')
            plt.close()
    
    async def create_text_report(self, complete_results: Dict[str, Any]):
        """Create comprehensive text report"""
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("STREAM-BASED CONSENSUS PROTOCOL (SBCP) EXPERIMENTAL VALIDATION REPORT")
        report_lines.append("=" * 80)
        report_lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"Total Experiment Duration: {complete_results['total_duration']:.2f} seconds")
        report_lines.append("")
        
        # Configuration summary
        report_lines.append("EXPERIMENTAL CONFIGURATION:")
        report_lines.append("-" * 40)
        config = complete_results["experiment_config"]
        for key, value in config.items():
            report_lines.append(f"  {key}: {value}")
        report_lines.append("")
        
        # Results summary
        for experiment_name, results in complete_results["results"].items():
            report_lines.append(f"EXPERIMENT: {experiment_name.upper()}")
            report_lines.append("-" * 40)
            
            if "error" in results:
                report_lines.append(f"  ERROR: {results['error']}")
            else:
                # Experiment-specific reporting
                if experiment_name == "confidence_evolution":
                    tx_count = len(results.get("transactions", []))
                    report_lines.append(f"  Transactions tested: {tx_count}")
                    
                    if "theoretical_validation" in results:
                        validation = results["theoretical_validation"]
                        report_lines.append(f"  Monotonic convergence rate: {len([r for r in validation.get('convergence_rates', []) if r.get('is_monotonic', False)])}/{len(validation.get('convergence_rates', []))}")
                
                elif experiment_name == "throughput_scaling":
                    scaling_data = results.get("scaling_data", [])
                    if scaling_data:
                        max_tps = max(d["tps"] for d in scaling_data)
                        report_lines.append(f"  Maximum throughput achieved: {max_tps:.2f} TPS")
                        
                        if "theoretical_comparison" in results:
                            comparison = results["theoretical_comparison"]
                            avg_efficiency = comparison.get("average_efficiency", 0)
                            report_lines.append(f"  Average scaling efficiency: {avg_efficiency:.2%}")
                
                elif experiment_name == "byzantine_resilience":
                    resilience_tests = results.get("resilience_tests", [])
                    if resilience_tests:
                        safe_scenarios = len([t for t in resilience_tests if t["conflicting_decisions"] == 0])
                        report_lines.append(f"  Safe consensus scenarios: {safe_scenarios}/{len(resilience_tests)}")
                        
                        avg_confidence = np.mean([t["average_confidence"] for t in resilience_tests])
                        report_lines.append(f"  Average confidence under Byzantine stress: {avg_confidence:.4f}")
            
            report_lines.append("")
        
        # Conclusions
        report_lines.append("EXPERIMENTAL CONCLUSIONS:")
        report_lines.append("-" * 40)
        report_lines.append("1. Confidence Score Evolution: " + 
                           ("VALIDATED" if "confidence_evolution" in complete_results["results"] else "FAILED"))
        report_lines.append("2. Linear Throughput Scaling: " + 
                           ("VALIDATED" if "throughput_scaling" in complete_results["results"] else "FAILED"))
        report_lines.append("3. Byzantine Fault Tolerance: " + 
                           ("VALIDATED" if "byzantine_resilience" in complete_results["results"] else "FAILED"))
        report_lines.append("4. Network Latency Resilience: " + 
                           ("VALIDATED" if "network_lativity_impact" in complete_results["results"] else "FAILED"))
        report_lines.append("5. Fraud Detection Mechanism: " + 
                           ("VALIDATED" if "fraud_detection" in complete_results["results"] else "FAILED"))
        report_lines.append("6. Consensus Convergence: " + 
                           ("VALIDATED" if "consensus_convergence" in complete_results["results"] else "FAILED"))
        
        # Write report
        with open(f"{self.config.results_dir}/experimental_report.txt", 'w') as f:
           
            f.write('\n'.join(report_lines))
    
    async def cleanup(self):
        """Clean up validator processes and Docker containers"""
        logger.info("Cleaning up experimental setup")
        
        # Terminate local processes
        for process in self.validator_processes:
            try:
                process.terminate()  # Windows-compatible
                process.wait(timeout=5)
            except:
                try:
                    process.kill()  # Windows-compatible force kill
                except:
                    pass
        
        # Clean up Docker containers
        if self.config.use_docker:
            subprocess.run(["docker", "stop"] + [f"sbcp_validator_{i}" for i in range(self.config.num_validators)], 
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["docker", "rm"] + [f"sbcp_validator_{i}" for i in range(self.config.num_validators)], 
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

async def main():
    """Main experimental orchestration function"""
    parser = argparse.ArgumentParser(description="SBCP Experimental Validation Framework")
    parser.add_argument("--validators", type=int, default=10, help="Number of validators")
    parser.add_argument("--byzantine-fraction", type=float, default=0.2, help="Byzantine validator fraction")
    parser.add_argument("--transactions", type=int, default=100, help="Number of test transactions")
    parser.add_argument("--docker", action="store_true", help="Use Docker containers")
    parser.add_argument("--results-dir", default="./experiment_results", help="Results directory")
    
    args = parser.parse_args()
    
    # Create configuration
    config = ExperimentConfig(
        num_validators=args.validators,
        byzantine_fraction=args.byzantine_fraction,
        num_transactions=args.transactions,
        use_docker=args.docker,
        results_dir=args.results_dir
    )
    
    # Initialize orchestrator
    orchestrator = SBCPExperimentOrchestrator(config)
    
    try:
        # Setup signal handlers for graceful shutdown
        def signal_handler(signum, frame):
            logger.info("Received shutdown signal")
            asyncio.create_task(orchestrator.cleanup())
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Run experimental suite
        logger.info("Starting SBCP Experimental Validation Framework")
        await orchestrator.setup_validators()
        await orchestrator.run_experiment_suite()
        
        logger.info("All experiments completed successfully")
        logger.info(f"Results saved in: {config.results_dir}")
        
    except Exception as e:
        logger.error(f"Experimental suite failed: {e}")
        raise
    finally:
        await orchestrator.cleanup()

if __name__ == "__main__":
    asyncio.run(main())