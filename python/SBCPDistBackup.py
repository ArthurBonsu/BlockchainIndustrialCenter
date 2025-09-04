from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import aiohttp
import uvicorn
import time
import hashlib
import json
import random
import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np
from collections import defaultdict, deque
import signal
import sys
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for API
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
    reputation: float
    timestamp: float
    signature: str = ""

class QuorumSignal(BaseModel):
    validator_id: str
    signal_strength: float
    network_state_hash: str
    timestamp: float
    peer_signals: Dict[str, float] = {}

class FraudProof(BaseModel):
    accused_validator: str
    evidence_hash: str
    proof_data: str
    reporter_id: str
    timestamp: float

class NetworkMetrics(BaseModel):
    node_id: str
    active_transactions: int
    processed_count: int
    reputation: float
    network_latency: float
    uptime: float

class DistributedValidator:
    def __init__(self, node_id: str, port: int = 8000):
        self.node_id = node_id
        self.port = port
        self.app = FastAPI(title=f"SBCP Validator {node_id}")
        
        # Node state
        self.reputation = 1.0
        self.stake_weight = random.uniform(0.5, 2.0)
        self.is_byzantine = False
        self.validation_accuracy = 0.98
        
        # Network state
        self.peer_nodes: Set[str] = set()
        self.active_transactions: Dict[str, TransactionModel] = {}
        self.validation_votes: Dict[str, List[ValidationVote]] = defaultdict(list)
        self.confidence_scores: Dict[str, float] = {}
        self.rolling_hash = hashlib.sha256(f"genesis_{node_id}".encode()).hexdigest()
        
        # Quorum sensing state
        self.signal_accumulation: Dict[str, Dict[str, float]] = defaultdict(dict)
        self.consensus_threshold = 0.67
        self.signal_decay_rate = 0.1
        
        # Performance metrics
        self.processed_transactions = 0
        self.start_time = time.time()
        self.latency_measurements: List[float] = []
        
        # Setup FastAPI routes
        self.setup_routes()
        
        # Setup CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        @self.app.get("/")
        async def root():
            return {"node_id": self.node_id, "status": "active"}
        
        @self.app.post("/transaction/propose")
        async def propose_transaction(tx: TransactionModel, background_tasks: BackgroundTasks):
            """Receive and validate a new transaction"""
            start_time = time.time()
            
            # Store transaction
            self.active_transactions[tx.tx_id] = tx
            
            # Perform initial validation
            validation_result = await self.validate_transaction(tx)
            
            # Create validation vote
            vote = ValidationVote(
                tx_id=tx.tx_id,
                validator_id=self.node_id,
                vote=validation_result,
                reputation=self.reputation,
                timestamp=time.time(),
                signature=self.sign_vote(tx.tx_id, validation_result)
            )
            
            self.validation_votes[tx.tx_id].append(vote)
            
            # Calculate confidence score
            confidence = self.calculate_confidence_score(tx.tx_id)
            self.confidence_scores[tx.tx_id] = confidence
            
            # Update rolling hash
            self.update_rolling_hash(tx)
            
            # Record processing time
            processing_time = time.time() - start_time
            self.latency_measurements.append(processing_time)
            self.processed_transactions += 1
            
            # Broadcast to peers in background
            background_tasks.add_task(self.broadcast_validation_vote, vote)
            
            logger.info(f"Node {self.node_id}: Processed TX {tx.tx_id}, confidence={confidence:.4f}")
            
            return {
                "tx_id": tx.tx_id,
                "validator_id": self.node_id,
                "vote": validation_result,
                "confidence": confidence,
                "processing_time": processing_time
            }
        
        @self.app.post("/validation/vote")
        async def receive_validation_vote(vote: ValidationVote):
            """Receive validation vote from peer validator"""
            self.validation_votes[vote.tx_id].append(vote)
            
            # Recalculate confidence score with new vote
            if vote.tx_id in self.active_transactions:
                confidence = self.calculate_confidence_score(vote.tx_id)
                self.confidence_scores[vote.tx_id] = confidence
                
                logger.info(f"Node {self.node_id}: Received vote for TX {vote.tx_id}, new confidence={confidence:.4f}")
            
            return {"status": "received", "tx_id": vote.tx_id}
        
        @self.app.post("/quorum/signal")
        async def receive_quorum_signal(signal: QuorumSignal):
            """Receive quorum sensing signal from peer"""
            # Update signal accumulation matrix
            self.signal_accumulation[signal.validator_id] = signal.peer_signals
            
            # Apply decay to old signals
            current_time = time.time()
            for peer_id in self.signal_accumulation:
                for tx_id in list(self.signal_accumulation[peer_id].keys()):
                    age = current_time - signal.timestamp
                    self.signal_accumulation[peer_id][tx_id] *= np.exp(-self.signal_decay_rate * age)
            
            return {"status": "signal_received", "validator_id": signal.validator_id}
        
        @self.app.post("/fraud/proof")
        async def receive_fraud_proof(proof: FraudProof):
            """Receive and verify fraud proof"""
            # In a real implementation, this would verify the zk-SNARK proof
            # For simulation, we'll just log it
            logger.warning(f"Node {self.node_id}: Fraud proof received against {proof.accused_validator}")
            
            # Reduce reputation of accused validator if proof is valid
            if proof.accused_validator in self.peer_nodes:
                # Simplified fraud proof verification
                logger.info(f"Node {self.node_id}: Reducing reputation of {proof.accused_validator}")
            
            return {"status": "proof_verified", "accused": proof.accused_validator}
        
        @self.app.get("/metrics")
        async def get_metrics():
            """Return node performance metrics"""
            uptime = time.time() - self.start_time
            avg_latency = np.mean(self.latency_measurements) if self.latency_measurements else 0
            
            return NetworkMetrics(
                node_id=self.node_id,
                active_transactions=len(self.active_transactions),
                processed_count=self.processed_transactions,
                reputation=self.reputation,
                network_latency=avg_latency,
                uptime=uptime
            )
        
        @self.app.get("/confidence/{tx_id}")
        async def get_confidence(tx_id: str):
            """Get confidence score for specific transaction"""
            if tx_id not in self.confidence_scores:
                raise HTTPException(status_code=404, detail="Transaction not found")
            
            return {
                "tx_id": tx_id,
                "confidence": self.confidence_scores[tx_id],
                "votes_count": len(self.validation_votes[tx_id]),
                "validator_id": self.node_id
            }
        
        @self.app.post("/peers/register")
        async def register_peer(peer_info: dict):
            """Register a new peer validator"""
            peer_id = peer_info.get("node_id")
            if peer_id:
                self.peer_nodes.add(peer_id)
                logger.info(f"Node {self.node_id}: Registered peer {peer_id}")
                return {"status": "registered", "peer_id": peer_id}
            
            raise HTTPException(status_code=400, detail="Invalid peer info")
    
    async def validate_transaction(self, tx: TransactionModel) -> bool:
        """Perform transaction validation with Byzantine behavior simulation"""
        # Simulate processing delay
        await asyncio.sleep(random.uniform(0.01, 0.05))
        
        if self.is_byzantine:
            # Byzantine validators are unreliable
            return random.random() < 0.4
        else:
            # Honest validators with high accuracy
            # Simple validation rules for simulation
            if tx.value <= 0 or tx.value > 1000000:
                return False
            
            # Simulate risk-based validation
            risk_threshold = 0.8
            basic_validity = tx.risk_score < risk_threshold
            
            return random.random() < self.validation_accuracy if basic_validity else False
    
    def calculate_confidence_score(self, tx_id: str) -> float:
        """Calculate confidence score based on received votes"""
        if tx_id not in self.validation_votes:
            return 0.0
        
        votes = self.validation_votes[tx_id]
        if not votes:
            return 0.0
        
        # Calculate validation weight V(T,t) = Σ(wi * vi * Ri)
        validation_weight = 0.0
        total_weight = 0.0
        
        for vote in votes:
            wi = 1.0  # Equal weights for simplicity
            vi = 1.0 if vote.vote else 0.0
            ri = vote.reputation
            
            validation_weight += wi * vi * ri
            total_weight += wi * ri
        
        # Normalize and apply exponential confidence model
        if total_weight > 0:
            normalized_weight = validation_weight / total_weight
            # Simplified confidence calculation
            confidence = 1.0 - np.exp(-2.0 * normalized_weight * len(votes))
            return min(confidence, 1.0)
        
        return 0.0
    
    def update_rolling_hash(self, tx: TransactionModel):
        """Update rolling hash with new transaction"""
        tx_data = json.dumps(asdict(tx), sort_keys=True)
        tx_hash = hashlib.sha256(tx_data.encode()).hexdigest()
        self.rolling_hash = hashlib.sha256((self.rolling_hash + tx_hash).encode()).hexdigest()
    
    def sign_vote(self, tx_id: str, vote: bool) -> str:
        """Generate signature for validation vote (simplified)"""
        data = f"{tx_id}_{vote}_{self.node_id}_{time.time()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    async def broadcast_validation_vote(self, vote: ValidationVote):
        """Broadcast validation vote to peer validators"""
        # This would normally use the peer network
        # For simulation, we'll just log it
        logger.info(f"Node {self.node_id}: Broadcasting vote for TX {vote.tx_id}")
    
    def set_byzantine(self, is_byzantine: bool = True):
        """Set node to exhibit Byzantine behavior"""
        self.is_byzantine = is_byzantine
        self.validation_accuracy = 0.3 if is_byzantine else 0.98
        logger.warning(f"Node {self.node_id}: Byzantine behavior {'ENABLED' if is_byzantine else 'DISABLED'}")

class DistributedExperimentOrchestrator:
    def __init__(self):
        self.validators: Dict[str, str] = {}  # node_id -> URL
        self.experiment_results: Dict = {}
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def add_validator(self, node_id: str, url: str):
        """Register a validator node"""
        self.validators[node_id] = url
        logger.info(f"Orchestrator: Added validator {node_id} at {url}")
    
    async def send_transaction_to_all(self, tx: TransactionModel) -> Dict:
        """Send transaction to all validators and collect responses"""
        tasks = []
        for node_id, url in self.validators.items():
            task = self.send_transaction_to_validator(url, tx)
            tasks.append(task)
        
        # Wait for all responses
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process responses
        results = {}
        for i, (node_id, url) in enumerate(self.validators.items()):
            if isinstance(responses[i], Exception):
                results[node_id] = {"error": str(responses[i])}
            else:
                results[node_id] = responses[i]
        
        return results
    
    async def send_transaction_to_validator(self, url: str, tx: TransactionModel) -> dict:
        """Send transaction to specific validator"""
        try:
            async with self.session.post(f"{url}/transaction/propose", json=tx.dict()) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Failed to send transaction to {url}: {e}")
            raise e
    
    async def collect_metrics_from_all(self) -> Dict:
        """Collect performance metrics from all validators"""
        tasks = []
        for node_id, url in self.validators.items():
            task = self.get_validator_metrics(url)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        metrics = {}
        for i, (node_id, url) in enumerate(self.validators.items()):
            if not isinstance(responses[i], Exception):
                metrics[node_id] = responses[i]
        
        return metrics
    
    async def get_validator_metrics(self, url: str) -> dict:
        """Get metrics from specific validator"""
        try:
            async with self.session.get(f"{url}/metrics") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Failed to get metrics from {url}: {e}")
            raise e
    
    async def run_throughput_experiment(self, num_transactions: int = 100, delay: float = 0.1) -> Dict:
        """Run throughput experiment across distributed validators"""
        logger.info(f"Starting throughput experiment: {num_transactions} transactions")
        
        start_time = time.time()
        transaction_results = []
        
        for i in range(num_transactions):
            # Generate random transaction
            tx = TransactionModel(
                tx_id=f"exp_tx_{i}",
                from_addr=f"addr_{random.randint(0, 100)}",
                to_addr=f"addr_{random.randint(0, 100)}",
                value=random.uniform(1, 10000),
                timestamp=time.time(),
                risk_score=random.uniform(0, 1),
                complexity_class=random.choice([1, 2, 3])
            )
            
            # Send to all validators
            results = await self.send_transaction_to_all(tx)
            transaction_results.append({
                "tx_id": tx.tx_id,
                "responses": results,
                "timestamp": time.time()
            })
            
            # Add delay between transactions
            if delay > 0:
                await asyncio.sleep(delay)
            
            if i % 10 == 0:
                logger.info(f"Processed {i+1}/{num_transactions} transactions")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Collect final metrics
        final_metrics = await self.collect_metrics_from_all()
        
        experiment_results = {
            "experiment_type": "throughput",
            "num_transactions": num_transactions,
            "total_time": total_time,
            "throughput_tps": num_transactions / total_time,
            "transaction_results": transaction_results,
            "final_metrics": final_metrics,
            "validator_count": len(self.validators)
        }
        
        logger.info(f"Throughput experiment completed: {experiment_results['throughput_tps']:.2f} TPS")
        return experiment_results

def run_validator_node(node_id: str, port: int = 8000, byzantine: bool = False):
    """Run a single validator node"""
    validator = DistributedValidator(node_id, port)
    
    if byzantine:
        validator.set_byzantine(True)
    
    # Handle graceful shutdown
    def signal_handler(signum, frame):
        logger.info(f"Shutting down validator {node_id}")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info(f"Starting validator {node_id} on port {port} (Byzantine: {byzantine})")
    uvicorn.run(validator.app, host="0.0.0.0", port=port, log_level="info")

# Example experiment script
async def run_distributed_experiment():
    """Run a complete distributed experiment"""
    async with DistributedExperimentOrchestrator() as orchestrator:
        # Add local validators (assuming they're running)
        for i in range(5):
            port = 8000 + i
            orchestrator.add_validator(f"validator_{i}", f"http://localhost:{port}")
        
        # Run throughput experiment
        results = await orchestrator.run_throughput_experiment(num_transactions=50, delay=0.1)
        
        # Save results
        with open("distributed_experiment_results.json", "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"Experiment completed. TPS: {results['throughput_tps']:.2f}")
        return results

if __name__ == "__main__":
    if len(sys.argv) > 1:
        node_id = sys.argv[1]
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
        byzantine = len(sys.argv) > 3 and sys.argv[3].lower() == 'true'
        
        run_validator_node(node_id, port, byzantine)
    else:
        print("Usage: python sbcp_api_validator.py <node_id> [port] [byzantine]")
        print("Example: python sbcp_api_validator.py validator_0 8000 false")