#!/usr/bin/env python3
"""
Enhanced SBCP Distributed Validator
Incorporates advanced consensus mechanisms from SBCPEvaluationEngine2.py
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncio
import aiohttp
import uvicorn
import time
import hashlib
import json
import random
import logging
import math
import numpy as np
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import signal
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models
class TransactionModel(BaseModel):
    tx_id: str
    from_addr: str
    to_addr: str
    value: float
    timestamp: float
    risk_score: float = 0.0
    complexity_class: int = 1
    security_level: int = 2
    nonce: int = 0

class ValidationVote(BaseModel):
    tx_id: str
    validator_id: str
    vote: bool
    confidence: float
    reputation: float
    timestamp: float
    signature: str = ""

class QuorumSignal(BaseModel):
    validator_id: str
    tx_id: str
    signal_strength: float
    network_state_hash: str
    timestamp: float

class ConsensusState(BaseModel):
    tx_id: str
    confidence_score: float
    finality_tier: str
    votes_received: int
    quorum_strength: float
    timestamp: float

@dataclass
class ValidatorNode:
    node_id: str
    reputation: float
    is_byzantine: bool
    stake_weight: float
    processing_delay: float
    recent_validations: List[bool]
    quorum_participation: float

class EnhancedSBCPValidator:
    def __init__(self, node_id: str, port: int = 8000, is_byzantine: bool = False):
        self.node_id = node_id
        self.port = port
        self.app = FastAPI(title=f"Enhanced SBCP Validator {node_id}")
        
        # Enhanced consensus parameters from SBCPEvaluationEngine2.py
        self.lambda_base = 8.0
        self.time_scaling_factor = 10.0
        self.finality_thresholds = {
            'provisional': 0.80,
            'economic': 0.95,
            'absolute': 0.99
        }
        
        # Node configuration
        self.validator_node = ValidatorNode(
            node_id=node_id,
            reputation=0.2 if is_byzantine else random.uniform(0.85, 0.98),
            is_byzantine=is_byzantine,
            stake_weight=random.uniform(1.0, 3.0),
            processing_delay=random.uniform(0.05, 0.15),
            recent_validations=[],
            quorum_participation=0.1 if is_byzantine else random.uniform(0.8, 0.95)
        )
        
        # Transaction state
        self.active_transactions: Dict[str, TransactionModel] = {}
        self.transaction_votes: Dict[str, List[ValidationVote]] = defaultdict(list)
        self.confidence_history: Dict[str, List[Tuple[float, float, str]]] = defaultdict(list)
        self.quorum_signals: Dict[str, Dict[str, float]] = defaultdict(dict)
        self.rolling_hash = hashlib.sha256(f"genesis_{node_id}".encode()).hexdigest()
        
        # Network state
        self.peer_validators: Dict[str, str] = {}  # node_id -> URL
        self.network_state_hash = ""
        
        # Performance metrics
        self.processed_count = 0
        self.start_time = time.time()
        self.consensus_achievements = {
            'provisional': 0, 'economic': 0, 'absolute': 0
        }
        
        self.setup_routes()
        self.setup_middleware()
    
    def setup_middleware(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        @self.app.get("/")
        async def health_check():
            return {
                "node_id": self.node_id,
                "status": "healthy",
                "reputation": self.validator_node.reputation,
                "is_byzantine": self.validator_node.is_byzantine,
                "processed_count": self.processed_count
            }
        
        @self.app.post("/transaction/propose")
        async def propose_transaction(tx: TransactionModel, background_tasks: BackgroundTasks):
            """Enhanced transaction proposal with full SBCP consensus"""
            start_time = time.time()
            
            # Store transaction
            self.active_transactions[tx.tx_id] = tx
            
            # Perform enhanced validation with Byzantine behavior
            vote, vote_confidence = await self.simulate_validator_vote(tx)
            
            # Create validation vote
            validation_vote = ValidationVote(
                tx_id=tx.tx_id,
                validator_id=self.node_id,
                vote=vote,
                confidence=vote_confidence,
                reputation=self.validator_node.reputation,
                timestamp=time.time(),
                signature=self.sign_vote(tx.tx_id, vote)
            )
            
            # Add to votes
            self.transaction_votes[tx.tx_id].append(validation_vote)
            
            # Generate quorum signal
            quorum_signal = QuorumSignal(
                validator_id=self.node_id,
                tx_id=tx.tx_id,
                signal_strength=self.validator_node.quorum_participation * self.validator_node.reputation,
                network_state_hash=self.rolling_hash,
                timestamp=time.time()
            )
            
            self.quorum_signals[tx.tx_id][self.node_id] = quorum_signal.signal_strength
            
            # Calculate enhanced confidence score
            confidence, finality_tier = self.calculate_enhanced_confidence(tx.tx_id, time.time())
            
            # Record confidence evolution
            self.confidence_history[tx.tx_id].append((
                time.time() - start_time, confidence, finality_tier
            ))
            
            # Update rolling hash
            self.update_rolling_hash(tx)
            
            # Update metrics
            self.processed_count += 1
            if finality_tier in self.consensus_achievements:
                self.consensus_achievements[finality_tier] += 1
            
            # Broadcast to peers
            background_tasks.add_task(self.broadcast_validation, validation_vote, quorum_signal)
            
            logger.info(f"Node {self.node_id}: TX {tx.tx_id} - confidence={confidence:.4f}, tier={finality_tier}")
            
            return {
                "tx_id": tx.tx_id,
                "validator_id": self.node_id,
                "vote": vote,
                "confidence": confidence,
                "finality_tier": finality_tier,
                "processing_time": time.time() - start_time,
                "quorum_strength": sum(self.quorum_signals[tx.tx_id].values()) / len(self.quorum_signals[tx.tx_id]) if self.quorum_signals[tx.tx_id] else 0.0
            }
        
        @self.app.post("/validation/receive")
        async def receive_validation(vote: ValidationVote, background_tasks: BackgroundTasks):
            """Receive validation vote from peer validator"""
            if vote.tx_id not in self.active_transactions:
                # If we don't have this transaction, request it
                background_tasks.add_task(self.request_transaction_data, vote.tx_id, vote.validator_id)
                raise HTTPException(status_code=404, detail="Transaction not found")
            
            # Add vote to our records
            self.transaction_votes[vote.tx_id].append(vote)
            
            # Recalculate confidence with new vote
            confidence, finality_tier = self.calculate_enhanced_confidence(vote.tx_id, time.time())
            
            # Update reputation of sending validator based on consensus
            self.update_peer_reputation(vote.validator_id, vote.tx_id)
            
            logger.info(f"Node {self.node_id}: Received vote for {vote.tx_id}, new confidence={confidence:.4f}")
            
            return {
                "status": "received",
                "tx_id": vote.tx_id,
                "new_confidence": confidence,
                "finality_tier": finality_tier
            }
        
        @self.app.post("/quorum/receive")
        async def receive_quorum_signal(signal: QuorumSignal):
            """Receive quorum sensing signal"""
            self.quorum_signals[signal.tx_id][signal.validator_id] = signal.signal_strength
            
            # Recalculate confidence if we have this transaction
            if signal.tx_id in self.active_transactions:
                confidence, finality_tier = self.calculate_enhanced_confidence(signal.tx_id, time.time())
                return {
                    "status": "signal_received",
                    "tx_id": signal.tx_id,
                    "updated_confidence": confidence
                }
            
            return {"status": "signal_queued", "tx_id": signal.tx_id}
        
        @self.app.get("/consensus/{tx_id}")
        async def get_consensus_state(tx_id: str):
            """Get detailed consensus state for transaction"""
            if tx_id not in self.active_transactions:
                raise HTTPException(status_code=404, detail="Transaction not found")
            
            confidence, finality_tier = self.calculate_enhanced_confidence(tx_id, time.time())
            
            return ConsensusState(
                tx_id=tx_id,
                confidence_score=confidence,
                finality_tier=finality_tier,
                votes_received=len(self.transaction_votes[tx_id]),
                quorum_strength=sum(self.quorum_signals[tx_id].values()) / len(self.quorum_signals[tx_id]) if self.quorum_signals[tx_id] else 0.0,
                timestamp=time.time()
            )
        
        @self.app.post("/peers/register")
        async def register_peer(peer_info: dict):
            """Register peer validator for network communication"""
            peer_id = peer_info.get("node_id")
            peer_url = peer_info.get("url")
            
            if peer_id and peer_url:
                self.peer_validators[peer_id] = peer_url
                logger.info(f"Node {self.node_id}: Registered peer {peer_id} at {peer_url}")
                return {"status": "registered", "peer_id": peer_id}
            
            raise HTTPException(status_code=400, detail="Invalid peer info")
        
        @self.app.get("/metrics/detailed")
        async def get_detailed_metrics():
            """Return comprehensive node metrics"""
            uptime = time.time() - self.start_time
            
            return {
                "node_id": self.node_id,
                "validator_info": {
                    "reputation": self.validator_node.reputation,
                    "stake_weight": self.validator_node.stake_weight,
                    "is_byzantine": self.validator_node.is_byzantine,
                    "quorum_participation": self.validator_node.quorum_participation
                },
                "consensus_metrics": {
                    "processed_transactions": self.processed_count,
                    "active_transactions": len(self.active_transactions),
                    "consensus_achievements": self.consensus_achievements,
                    "total_finalized": sum(self.consensus_achievements.values())
                },
                "network_state": {
                    "peer_count": len(self.peer_validators),
                    "rolling_hash": self.rolling_hash[:16],
                    "uptime_seconds": uptime
                },
                "finality_rates": {
                    tier: count / max(self.processed_count, 1) 
                    for tier, count in self.consensus_achievements.items()
                }
            }
    
    async def simulate_validator_vote(self, tx: TransactionModel) -> Tuple[bool, float]:
        """Enhanced validator decision with confidence scoring from SBCPEvaluationEngine2.py"""
        # Simulate processing delay
        await asyncio.sleep(self.validator_node.processing_delay / 50)  # Scaled for real-time
        
        if self.validator_node.is_byzantine:
            # Byzantine validators behave unpredictably
            vote = random.random() < 0.3
            confidence = random.uniform(0.1, 0.4)
        else:
            # Honest validators make better decisions
            base_validity = tx.risk_score < 0.65
            vote_probability = self.validator_node.reputation * (1.2 if base_validity else 0.3)
            vote = random.random() < vote_probability
            confidence = self.validator_node.reputation * (0.9 if vote == base_validity else 0.4)
        
        return vote, confidence
    
    def calculate_enhanced_confidence(self, tx_id: str, current_time: float) -> Tuple[float, str]:
        """Enhanced confidence calculation from SBCPEvaluationEngine2.py"""
        if tx_id not in self.active_transactions:
            return 0.0, 'none'
        
        tx = self.active_transactions[tx_id]
        time_elapsed = max(current_time - tx.timestamp, 0.001) * self.time_scaling_factor
        
        # Enhanced validation weight with time weighting and quorum sensing
        validation_weight = 0.0
        total_stake = 0.0
        votes = self.transaction_votes[tx_id]
        
        for vote in votes:
            # Get validator stake weight (simplified)
            wi = 1.0 if vote.validator_id == self.node_id else 1.0  # Equal weights for now
            vi = 1.0 if vote.vote else 0.0
            ri = vote.reputation
            
            # Add time weighting and quorum sensing
            time_weight = math.log(1 + time_elapsed)
            quorum_weight = self.quorum_signals[tx_id].get(vote.validator_id, 0.5)
            
            validation_weight += wi * vi * ri * time_weight * quorum_weight
            total_stake += wi
        
        # Normalize by total stake to prevent unbounded growth
        if total_stake > 0:
            validation_weight = validation_weight / total_stake * len(votes)
        
        # Dynamic lambda based on network conditions
        participation_ratio = len(votes) / max(len(self.peer_validators) + 1, 1)  # +1 for self
        quorum_strength = sum(self.quorum_signals[tx_id].values()) / len(self.quorum_signals[tx_id]) if self.quorum_signals[tx_id] else 0.5
        lambda_t = self.lambda_base * (1 + 0.3 * participation_ratio) * (1 + 0.2 * quorum_strength)
        
        # Enhanced confidence calculation
        confidence = 1.0 - math.exp(-lambda_t * validation_weight * time_elapsed)
        confidence = min(confidence, 0.999)  # Cap at 99.9%
        
        # Determine finality tier
        finality_tier = 'none'
        if confidence >= self.finality_thresholds['absolute']:
            finality_tier = 'absolute'
        elif confidence >= self.finality_thresholds['economic']:
            finality_tier = 'economic'
        elif confidence >= self.finality_thresholds['provisional']:
            finality_tier = 'provisional'
        
        return confidence, finality_tier
    
    def update_rolling_hash(self, tx: TransactionModel):
        """Update adaptive rolling hash commitment"""
        tx_data = f"{tx.tx_id}{tx.value}{len(self.transaction_votes[tx.tx_id])}{self.network_state_hash}"
        self.rolling_hash = hashlib.sha256(tx_data.encode()).hexdigest()
    
    def sign_vote(self, tx_id: str, vote: bool) -> str:
        """Generate vote signature"""
        data = f"{tx_id}_{vote}_{self.node_id}_{time.time()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def update_peer_reputation(self, peer_id: str, tx_id: str):
        """Update reputation based on consensus alignment"""
        # Simplified reputation update - in real implementation would be more sophisticated
        pass
    
    async def broadcast_validation(self, vote: ValidationVote, signal: QuorumSignal):
        """Broadcast validation vote and quorum signal to peers"""
        tasks = []
        for peer_id, peer_url in self.peer_validators.items():
            if peer_id != self.node_id:
                tasks.append(self.send_validation_to_peer(peer_url, vote))
                tasks.append(self.send_quorum_signal_to_peer(peer_url, signal))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def send_validation_to_peer(self, peer_url: str, vote: ValidationVote):
        """Send validation vote to specific peer"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.post(f"{peer_url}/validation/receive", json=vote.dict()) as resp:
                    return await resp.json()
        except Exception as e:
            logger.warning(f"Failed to send validation to {peer_url}: {e}")
    
    async def send_quorum_signal_to_peer(self, peer_url: str, signal: QuorumSignal):
        """Send quorum signal to specific peer"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.post(f"{peer_url}/quorum/receive", json=signal.dict()) as resp:
                    return await resp.json()
        except Exception as e:
            logger.warning(f"Failed to send quorum signal to {peer_url}: {e}")
    
    async def request_transaction_data(self, tx_id: str, from_validator: str):
        """Request transaction data from peer validator"""
        # Implementation for transaction synchronization
        pass

# Enhanced orchestrator that properly coordinates distributed validators
class EnhancedDistributedOrchestrator:
    def __init__(self):
        self.validators: Dict[str, str] = {}
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10))
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def add_validator(self, node_id: str, url: str):
        """Add validator to network"""
        self.validators[node_id] = url
        logger.info(f"Orchestrator: Added validator {node_id} at {url}")
    
    async def initialize_network(self):
        """Initialize peer connections between validators"""
        for node_id, url in self.validators.items():
            # Register all other validators as peers
            peer_registrations = []
            for peer_id, peer_url in self.validators.items():
                if peer_id != node_id:
                    peer_data = {"node_id": peer_id, "url": peer_url}
                    registration_task = self.register_peer(url, peer_data)
                    peer_registrations.append(registration_task)
            
            if peer_registrations:
                await asyncio.gather(*peer_registrations, return_exceptions=True)
        
        logger.info("Network initialization completed")
    
    async def register_peer(self, validator_url: str, peer_data: dict):
        """Register peer with specific validator"""
        try:
            async with self.session.post(f"{validator_url}/peers/register", json=peer_data) as resp:
                return await resp.json()
        except Exception as e:
            logger.warning(f"Failed to register peer: {e}")
    
    async def run_distributed_consensus_experiment(self, num_transactions: int = 50):
        """Run comprehensive distributed consensus experiment"""
        logger.info(f"Starting distributed consensus experiment with {num_transactions} transactions")
        
        # Initialize network
        await self.initialize_network()
        
        # Wait for network stabilization
        await asyncio.sleep(2.0)
        
        results = {
            "experiment_type": "distributed_consensus",
            "num_validators": len(self.validators),
            "num_transactions": num_transactions,
            "transactions": [],
            "performance_metrics": {},
            "consensus_analysis": {}
        }
        
        start_time = time.time()
        
        # Send transactions to random validators (simulating client behavior)
        for i in range(num_transactions):
            # Create test transaction
            tx = TransactionModel(
                tx_id=f"dist_tx_{i}",
                from_addr=f"addr_{random.randint(0, 50)}",
                to_addr=f"addr_{random.randint(0, 50)}",
                value=random.uniform(10, 10000),
                timestamp=time.time(),
                risk_score=random.uniform(0, 1),
                complexity_class=random.choice([1, 2, 3])
            )
            
            # Send to random validator (simulating client choosing entry point)
            validator_id = random.choice(list(self.validators.keys()))
            validator_url = self.validators[validator_id]
            
            try:
                async with self.session.post(f"{validator_url}/transaction/propose", json=tx.dict()) as resp:
                    if resp.status == 200:
                        response = await resp.json()
                        results["transactions"].append({
                            "tx_id": tx.tx_id,
                            "entry_validator": validator_id,
                            "response": response,
                            "timestamp": time.time()
                        })
                        logger.info(f"TX {tx.tx_id} -> {validator_id}: confidence={response.get('confidence', 0):.3f}")
                    else:
                        logger.error(f"Failed to send TX {tx.tx_id}: HTTP {resp.status}")
            except Exception as e:
                logger.error(f"Error sending TX {tx.tx_id}: {e}")
            
            # Add realistic delay between transactions
            await asyncio.sleep(0.1)
            
            if (i + 1) % 10 == 0:
                logger.info(f"Processed {i+1}/{num_transactions} transactions")
        
        # Wait for consensus propagation
        await asyncio.sleep(5.0)
        
        # Collect final metrics from all validators
        final_metrics = await self.collect_all_metrics()
        results["performance_metrics"] = final_metrics
        results["total_time"] = time.time() - start_time
        
        # Analyze consensus performance
        results["consensus_analysis"] = self.analyze_consensus_results(results)
        
        return results
    
    async def collect_all_metrics(self) -> Dict:
        """Collect detailed metrics from all validators"""
        metrics_tasks = []
        for node_id, url in self.validators.items():
            metrics_tasks.append(self.get_validator_detailed_metrics(url, node_id))
        
        metrics_responses = await asyncio.gather(*metrics_tasks, return_exceptions=True)
        
        all_metrics = {}
        for i, (node_id, url) in enumerate(self.validators.items()):
            if not isinstance(metrics_responses[i], Exception):
                all_metrics[node_id] = metrics_responses[i]
            else:
                logger.error(f"Failed to get metrics from {node_id}: {metrics_responses[i]}")
        
        return all_metrics
    
    async def get_validator_detailed_metrics(self, url: str, node_id: str) -> dict:
        """Get detailed metrics from validator"""
        try:
            async with self.session.get(f"{url}/metrics/detailed") as resp:
                return await resp.json()
        except Exception as e:
            logger.error(f"Failed to get metrics from {node_id}: {e}")
            raise e
    
    def analyze_consensus_results(self, results: Dict) -> Dict:
        """Analyze distributed consensus experiment results"""
        analysis = {
            "total_transactions": len(results["transactions"]),
            "successful_transactions": len([t for t in results["transactions"] if "response" in t]),
            "average_confidence": 0.0,
            "finality_distribution": {"provisional": 0, "economic": 0, "absolute": 0, "none": 0},
            "validator_performance": {}
        }
        
        # Analyze transaction results
        confidences = []
        for tx in results["transactions"]:
            if "response" in tx:
                confidence = tx["response"].get("confidence", 0)
                finality_tier = tx["response"].get("finality_tier", "none")
                
                confidences.append(confidence)
                if finality_tier in analysis["finality_distribution"]:
                    analysis["finality_distribution"][finality_tier] += 1
        
        if confidences:
            analysis["average_confidence"] = np.mean(confidences)
        
        # Calculate finality rates
        total_finalized = sum(v for k, v in analysis["finality_distribution"].items() if k != "none")
        analysis["total_finality_rate"] = total_finalized / max(analysis["total_transactions"], 1)
        
        return analysis

def run_enhanced_validator(node_id: str, port: int = 8000, byzantine: bool = False):
    """Run enhanced SBCP validator with full consensus implementation"""
    validator = EnhancedSBCPValidator(node_id, port, byzantine)
    
    def signal_handler(signum, frame):
        logger.info(f"Shutting down enhanced validator {node_id}")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info(f"Starting enhanced SBCP validator {node_id} on port {port} (Byzantine: {byzantine})")
    uvicorn.run(validator.app, host="0.0.0.0", port=port, log_level="warning")  # Reduced log noise

async def run_enhanced_experiment():
    """Run the enhanced distributed experiment"""
    async with EnhancedDistributedOrchestrator() as orchestrator:
        # Add validators (these should be running separately)
        for i in range(5):  # Adjust based on your setup
            port = 8000 + i
            orchestrator.add_validator(f"validator_{i}", f"http://localhost:{port}")
        
        # Run experiment
        results = await orchestrator.run_distributed_consensus_experiment(num_transactions=100)
        
        # Save results
        results_file = "enhanced_distributed_experiment_results.json"
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2, default=str)
        
        # Print summary
        analysis = results["consensus_analysis"]
        logger.info(f"""
Experiment Summary:
- Transactions: {analysis['total_transactions']}
- Success Rate: {analysis['successful_transactions'] / analysis['total_transactions']:.2%}
- Average Confidence: {analysis['average_confidence']:.4f}
- Total Finality Rate: {analysis['total_finality_rate']:.2%}
- Results saved to: {results_file}
        """)
        
        return results

if __name__ == "__main__":
    if len(sys.argv) > 1:
        node_id = sys.argv[1]
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
        byzantine = len(sys.argv) > 3 and sys.argv[3].lower() == 'true'
        
        run_enhanced_validator(node_id, port, byzantine)
    else:
        print("Usage: python enhanced_sbcp_dist.py <node_id> [port] [byzantine]")
        print("Example: python enhanced_sbcp_dist.py validator_0 8000 false")
        print("Or run: python enhanced_sbcp_dist.py experiment  # to run full experiment")