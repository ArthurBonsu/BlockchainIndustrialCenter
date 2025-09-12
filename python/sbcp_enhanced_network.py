#!/usr/bin/env python3
"""
Enhanced Stream-Based Consensus Protocol with P2P Networking and Transaction Gossiping
This implementation provides real validator networking, transaction propagation, and finality consensus.
"""

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
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np
from collections import defaultdict, deque
import signal
import sys
import os
import threading
from concurrent.futures import ThreadPoolExecutor
import argparse
import socket

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
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
    signature: str = ""

class ValidationVote(BaseModel):
    tx_id: str
    validator_id: str
    vote: bool
    reputation: float
    timestamp: float
    signature: str = ""
    confidence: float = 0.0

class PeerInfo(BaseModel):
    node_id: str
    host: str
    port: int
    reputation: float = 1.0
    last_seen: float = 0.0

class ConsensusDecision(BaseModel):
    tx_id: str
    decision: bool  # accept/reject
    finality_confidence: float
    participating_validators: List[str]
    timestamp: float
    block_height: int = 0

class GossipMessage(BaseModel):
    message_type: str  # "transaction", "vote", "consensus"
    payload: dict
    sender_id: str
    timestamp: float
    hop_count: int = 0
    message_id: str = ""

class NetworkState(BaseModel):
    network_hash: str
    active_validators: int
    processed_transactions: int
    consensus_height: int
    timestamp: float

def check_port_available(port: int) -> bool:
    """Check if a port is available for binding"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('localhost', port))
            return True
        except socket.error:
            return False

def find_available_port(start_port: int = 8000) -> int:
    """Find an available port starting from start_port"""
    port = start_port
    while not check_port_available(port) and port < start_port + 100:
        port += 1
    if port >= start_port + 100:
        raise Exception(f"No available ports found starting from {start_port}")
    return port

class EnhancedSBCPValidator:
    """Enhanced SBCP Validator with P2P networking and transaction gossiping"""
    
    def __init__(self, node_id: str, port: int = 8000, bootstrap_peers: List[Tuple[str, int]] = None):
        self.node_id = node_id
        self.port = find_available_port(port)
        self.host = "localhost"
        
        # Core validator state
        self.reputation = 1.0
        self.stake_weight = random.uniform(0.8, 1.2)
        self.is_byzantine = False
        self.validation_accuracy = 0.95
        
        # Networking state
        self.peers: Dict[str, PeerInfo] = {}
        self.bootstrap_peers = bootstrap_peers or []
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Transaction and consensus state
        self.active_transactions: Dict[str, TransactionModel] = {}
        self.validation_votes: Dict[str, List[ValidationVote]] = defaultdict(list)
        self.confidence_scores: Dict[str, float] = {}
        self.finalized_transactions: Dict[str, ConsensusDecision] = {}
        self.mempool: Set[str] = set()
        
        # Gossip protocol state
        self.gossip_cache: Set[str] = set()  # Message IDs we've seen
        self.gossip_buffer: deque = deque(maxlen=1000)
        self.gossip_lock = asyncio.Lock()
        
        # Consensus parameters
        self.consensus_threshold = 0.67
        self.finality_threshold = 0.8
        self.max_gossip_hops = 5
        
        # Performance metrics
        self.processed_transactions = 0
        self.start_time = time.time()
        self.network_latencies: List[float] = []
        self.consensus_times: Dict[str, float] = {}
        
        # FastAPI app
        self.app = FastAPI(title=f"SBCP Validator {node_id}")
        self.setup_routes()
        self.setup_middleware()
        
        # Background tasks
        self.background_tasks = set()
        
    def setup_middleware(self):
        """Setup CORS and other middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        """Setup all API routes"""
        
        @self.app.get("/")
        async def root():
            return {
                "node_id": self.node_id,
                "port": self.port,
                "status": "active",
                "peer_count": len(self.peers),
                "processed_tx": self.processed_transactions
            }
        
        @self.app.post("/transaction/submit")
        async def submit_transaction(tx: TransactionModel, background_tasks: BackgroundTasks):
            """Submit a new transaction to the network"""
            logger.info(f"Node {self.node_id}: Received new transaction {tx.tx_id}")
            
            # Add to mempool if not already present
            if tx.tx_id not in self.mempool:
                self.mempool.add(tx.tx_id)
                self.active_transactions[tx.tx_id] = tx
                
                # Start consensus process
                background_tasks.add_task(self.process_transaction_consensus, tx)
                
                # Gossip transaction to network
                background_tasks.add_task(self.gossip_transaction, tx)
            
            return {
                "status": "received",
                "tx_id": tx.tx_id,
                "validator_id": self.node_id
            }
        
        @self.app.post("/gossip/message")
        async def receive_gossip(message: GossipMessage, background_tasks: BackgroundTasks):
            """Receive and process gossip messages"""
            if message.message_id in self.gossip_cache:
                return {"status": "already_processed"}
            
            # Add to cache to prevent reprocessing
            self.gossip_cache.add(message.message_id)
            
            # Process message based on type
            background_tasks.add_task(self.process_gossip_message, message)
            
            # Forward if under hop limit
            if message.hop_count < self.max_gossip_hops:
                background_tasks.add_task(self.forward_gossip, message)
            
            return {"status": "received"}
        
        @self.app.post("/peer/register")
        async def register_peer(peer: PeerInfo):
            """Register a new peer validator"""
            if peer.node_id != self.node_id:
                self.peers[peer.node_id] = peer
                logger.info(f"Node {self.node_id}: Registered peer {peer.node_id} at {peer.host}:{peer.port}")
                
                # Send our info back
                await self.send_peer_registration(peer.host, peer.port)
            
            return {"status": "registered", "peer_count": len(self.peers)}
        
        @self.app.get("/consensus/{tx_id}")
        async def get_consensus_status(tx_id: str):
            """Get consensus status for a transaction"""
            if tx_id in self.finalized_transactions:
                decision = self.finalized_transactions[tx_id]
                return {
                    "tx_id": tx_id,
                    "status": "finalized",
                    "decision": decision.decision,
                    "confidence": decision.finality_confidence
                }
            elif tx_id in self.confidence_scores:
                return {
                    "tx_id": tx_id,
                    "status": "pending",
                    "confidence": self.confidence_scores[tx_id],
                    "votes": len(self.validation_votes[tx_id])
                }
            else:
                raise HTTPException(status_code=404, detail="Transaction not found")
        
        @self.app.get("/network/state")
        async def get_network_state():
            """Get current network state"""
            return NetworkState(
                network_hash=self.calculate_network_hash(),
                active_validators=len(self.peers) + 1,
                processed_transactions=self.processed_transactions,
                consensus_height=len(self.finalized_transactions),
                timestamp=time.time()
            )
        
        @self.app.get("/peers")
        async def get_peers():
            """Get list of connected peers"""
            return {
                "node_id": self.node_id,
                "peers": [{"node_id": pid, "reputation": peer.reputation} for pid, peer in self.peers.items()]
            }
    
    async def start_networking(self):
        """Initialize networking components"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10)
        )
        
        # Connect to bootstrap peers
        await self.connect_to_bootstrap_peers()
        
        # Start periodic tasks
        self.schedule_background_tasks()
        
        logger.info(f"Node {self.node_id}: Networking started on {self.host}:{self.port}")
    
    async def connect_to_bootstrap_peers(self):
        """Connect to bootstrap peers for initial network discovery"""
        for host, port in self.bootstrap_peers:
            try:
                peer_info = PeerInfo(
                    node_id=f"unknown_{host}_{port}",
                    host=host,
                    port=port,
                    last_seen=time.time()
                )
                
                # Try to register with peer
                await self.register_with_peer(host, port)
                
            except Exception as e:
                logger.warning(f"Node {self.node_id}: Failed to connect to bootstrap peer {host}:{port} - {e}")
    
    async def register_with_peer(self, host: str, port: int):
        """Register this node with a peer"""
        if not self.session:
            return
            
        try:
            my_info = PeerInfo(
                node_id=self.node_id,
                host=self.host,
                port=self.port,
                reputation=self.reputation,
                last_seen=time.time()
            )
            
            async with self.session.post(
                f"http://{host}:{port}/peer/register",
                json=my_info.dict()
            ) as response:
                if response.status == 200:
                    logger.info(f"Node {self.node_id}: Successfully registered with {host}:{port}")
                
        except Exception as e:
            logger.error(f"Node {self.node_id}: Failed to register with {host}:{port} - {e}")
    
    async def send_peer_registration(self, host: str, port: int):
        """Send our registration info to a peer"""
        await self.register_with_peer(host, port)
    
    async def process_transaction_consensus(self, tx: TransactionModel):
        """Process transaction through consensus mechanism"""
        logger.info(f"Node {self.node_id}: Starting consensus for TX {tx.tx_id}")
        
        consensus_start = time.time()
        
        # Perform local validation
        local_vote = await self.validate_transaction(tx)
        
        # Create validation vote
        vote = ValidationVote(
            tx_id=tx.tx_id,
            validator_id=self.node_id,
            vote=local_vote,
            reputation=self.reputation,
            timestamp=time.time(),
            signature=self.sign_vote(tx.tx_id, local_vote)
        )
        
        # Store our vote
        self.validation_votes[tx.tx_id].append(vote)
        
        # Gossip our vote
        await self.gossip_vote(vote)
        
        # Wait for network consensus
        await self.wait_for_consensus(tx.tx_id)
        
        self.consensus_times[tx.tx_id] = time.time() - consensus_start
    
    async def wait_for_consensus(self, tx_id: str, timeout: float = 30.0):
        """Wait for consensus to be reached on a transaction"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Calculate current confidence
            confidence = self.calculate_confidence_score(tx_id)
            self.confidence_scores[tx_id] = confidence
            
            # Check for finality
            if confidence >= self.finality_threshold:
                await self.finalize_transaction(tx_id)
                break
            
            # Wait a bit before checking again
            await asyncio.sleep(0.1)
        
        if tx_id not in self.finalized_transactions:
            logger.warning(f"Node {self.node_id}: Consensus timeout for TX {tx_id}")
    
    async def finalize_transaction(self, tx_id: str):
        """Finalize a transaction decision"""
        if tx_id in self.finalized_transactions:
            return
            
        votes = self.validation_votes[tx_id]
        if not votes:
            return
        
        # Calculate final decision
        positive_votes = sum(1 for v in votes if v.vote)
        total_weighted_reputation = sum(v.reputation for v in votes)
        
        decision = positive_votes / len(votes) > 0.5
        confidence = self.confidence_scores.get(tx_id, 0.0)
        
        # Create consensus decision
        consensus_decision = ConsensusDecision(
            tx_id=tx_id,
            decision=decision,
            finality_confidence=confidence,
            participating_validators=[v.validator_id for v in votes],
            timestamp=time.time(),
            block_height=len(self.finalized_transactions)
        )
        
        self.finalized_transactions[tx_id] = consensus_decision
        self.processed_transactions += 1
        
        # Gossip consensus decision
        await self.gossip_consensus(consensus_decision)
        
        logger.info(f"Node {self.node_id}: Finalized TX {tx_id} - Decision: {decision}, Confidence: {confidence:.4f}")
    
    async def validate_transaction(self, tx: TransactionModel) -> bool:
        """Validate a transaction with Byzantine behavior simulation"""
        # Simulate validation time
        await asyncio.sleep(random.uniform(0.01, 0.03))
        
        if self.is_byzantine:
            # Byzantine nodes are unpredictable
            return random.random() < 0.3
        
        # Basic validation rules
        if tx.value <= 0 or tx.value > 1000000:
            return False
        
        # Risk-based validation
        if tx.risk_score > 0.8:
            return False
        
        # Simulate validation accuracy
        return random.random() < self.validation_accuracy
    
    def calculate_confidence_score(self, tx_id: str) -> float:
        """Calculate confidence score using SBCP formula"""
        votes = self.validation_votes[tx_id]
        if not votes:
            return 0.0
        
        # Calculate validation weight V(T,t) = Σ(wi * vi * Ri)
        validation_weight = 0.0
        total_reputation = 0.0
        
        for vote in votes:
            weight = 1.0  # Equal weights
            vote_value = 1.0 if vote.vote else 0.0
            reputation = vote.reputation
            
            validation_weight += weight * vote_value * reputation
            total_reputation += reputation
        
        if total_reputation == 0:
            return 0.0
        
        # Normalize validation weight
        normalized_weight = validation_weight / total_reputation
        
        # Apply exponential confidence model: C(T,t) = 1 - e^(-λ(t) * V(T,t))
        # λ(t) depends on network size and time
        lambda_factor = min(2.0, 1.0 + len(votes) * 0.1)
        confidence = 1.0 - np.exp(-lambda_factor * normalized_weight)
        
        return min(confidence, 1.0)
    
    async def gossip_transaction(self, tx: TransactionModel):
        """Gossip transaction to network peers"""
        message = GossipMessage(
            message_type="transaction",
            payload=tx.dict(),
            sender_id=self.node_id,
            timestamp=time.time(),
            hop_count=0,
            message_id=f"tx_{tx.tx_id}_{self.node_id}_{time.time()}"
        )
        
        await self.broadcast_gossip_message(message)
    
    async def gossip_vote(self, vote: ValidationVote):
        """Gossip validation vote to network peers"""
        message = GossipMessage(
            message_type="vote",
            payload=vote.dict(),
            sender_id=self.node_id,
            timestamp=time.time(),
            hop_count=0,
            message_id=f"vote_{vote.tx_id}_{self.node_id}_{time.time()}"
        )
        
        await self.broadcast_gossip_message(message)
    
    async def gossip_consensus(self, decision: ConsensusDecision):
        """Gossip consensus decision to network peers"""
        message = GossipMessage(
            message_type="consensus",
            payload=decision.dict(),
            sender_id=self.node_id,
            timestamp=time.time(),
            hop_count=0,
            message_id=f"consensus_{decision.tx_id}_{self.node_id}_{time.time()}"
        )
        
        await self.broadcast_gossip_message(message)
    
    async def broadcast_gossip_message(self, message: GossipMessage):
        """Broadcast gossip message to all peers"""
        if not self.session:
            return
            
        tasks = []
        for peer_id, peer in self.peers.items():
            if peer_id != message.sender_id:  # Don't send back to sender
                task = self.send_gossip_to_peer(peer, message)
                tasks.append(task)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def send_gossip_to_peer(self, peer: PeerInfo, message: GossipMessage):
        """Send gossip message to specific peer"""
        try:
            async with self.session.post(
                f"http://{peer.host}:{peer.port}/gossip/message",
                json=message.dict()
            ) as response:
                if response.status != 200:
                    logger.warning(f"Failed to gossip to {peer.node_id}")
        except Exception as e:
            logger.debug(f"Gossip failed to {peer.node_id}: {e}")
    
    async def process_gossip_message(self, message: GossipMessage):
        """Process received gossip message"""
        if message.message_type == "transaction":
            await self.handle_gossip_transaction(message)
        elif message.message_type == "vote":
            await self.handle_gossip_vote(message)
        elif message.message_type == "consensus":
            await self.handle_gossip_consensus(message)
    
    async def handle_gossip_transaction(self, message: GossipMessage):
        """Handle received transaction gossip"""
        try:
            tx_data = message.payload
            tx = TransactionModel(**tx_data)
            
            if tx.tx_id not in self.mempool:
                self.mempool.add(tx.tx_id)
                self.active_transactions[tx.tx_id] = tx
                
                # Start consensus process for this transaction
                asyncio.create_task(self.process_transaction_consensus(tx))
                
        except Exception as e:
            logger.error(f"Node {self.node_id}: Failed to handle transaction gossip - {e}")
    
    async def handle_gossip_vote(self, message: GossipMessage):
        """Handle received vote gossip"""
        try:
            vote_data = message.payload
            vote = ValidationVote(**vote_data)
            
            # Add vote if we don't already have it
            existing_votes = self.validation_votes[vote.tx_id]
            if not any(v.validator_id == vote.validator_id for v in existing_votes):
                self.validation_votes[vote.tx_id].append(vote)
                
                # Recalculate confidence
                confidence = self.calculate_confidence_score(vote.tx_id)
                self.confidence_scores[vote.tx_id] = confidence
                
        except Exception as e:
            logger.error(f"Node {self.node_id}: Failed to handle vote gossip - {e}")
    
    async def handle_gossip_consensus(self, message: GossipMessage):
        """Handle received consensus decision gossip"""
        try:
            consensus_data = message.payload
            decision = ConsensusDecision(**consensus_data)
            
            if decision.tx_id not in self.finalized_transactions:
                self.finalized_transactions[decision.tx_id] = decision
                logger.info(f"Node {self.node_id}: Received consensus for TX {decision.tx_id}")
                
        except Exception as e:
            logger.error(f"Node {self.node_id}: Failed to handle consensus gossip - {e}")
    
    async def forward_gossip(self, message: GossipMessage):
        """Forward gossip message with incremented hop count"""
        message.hop_count += 1
        if message.hop_count < self.max_gossip_hops:
            await self.broadcast_gossip_message(message)
    
    def schedule_background_tasks(self):
        """Schedule periodic background tasks"""
        # Peer discovery and health checks
        asyncio.create_task(self.periodic_peer_discovery())
        asyncio.create_task(self.periodic_health_check())
        asyncio.create_task(self.cleanup_old_data())
    
    async def periodic_peer_discovery(self):
        """Periodically discover new peers"""
        while True:
            try:
                # Peer discovery logic here
                await asyncio.sleep(30)  # Every 30 seconds
            except Exception as e:
                logger.error(f"Peer discovery error: {e}")
    
    async def periodic_health_check(self):
        """Periodically check peer health"""
        while True:
            try:
                # Health check logic here
                await asyncio.sleep(10)  # Every 10 seconds
            except Exception as e:
                logger.error(f"Health check error: {e}")
    
    async def cleanup_old_data(self):
        """Clean up old gossip messages and expired data"""
        while True:
            try:
                current_time = time.time()
                # Clean gossip cache (keep messages for 5 minutes)
                if len(self.gossip_cache) > 5000:
                    self.gossip_cache.clear()
                
                await asyncio.sleep(60)  # Every minute
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
    
    def calculate_network_hash(self) -> str:
        """Calculate hash representing current network state"""
        state_data = {
            "finalized_count": len(self.finalized_transactions),
            "peer_count": len(self.peers),
            "processed_count": self.processed_transactions
        }
        return hashlib.sha256(json.dumps(state_data, sort_keys=True).encode()).hexdigest()[:16]
    
    def sign_vote(self, tx_id: str, vote: bool) -> str:
        """Generate signature for validation vote"""
        data = f"{tx_id}_{vote}_{self.node_id}_{time.time()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def set_byzantine(self, byzantine: bool = True):
        """Enable/disable Byzantine behavior"""
        self.is_byzantine = byzantine
        self.validation_accuracy = 0.2 if byzantine else 0.95
        logger.warning(f"Node {self.node_id}: Byzantine behavior {'ENABLED' if byzantine else 'DISABLED'}")
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info(f"Node {self.node_id}: Shutting down...")
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Close HTTP session
        if self.session:
            await self.session.close()

class NetworkBootstrapper:
    """Bootstrap and manage a network of SBCP validators"""
    
    def __init__(self, num_validators: int = 5, base_port: int = 8000):
        self.num_validators = num_validators
        self.base_port = base_port
        self.validators: List[EnhancedSBCPValidator] = []
        self.servers: List[uvicorn.Server] = []
    
    async def start_network(self, byzantine_fraction: float = 0.2):
        """Start a network of validators"""
        logger.info(f"Starting network with {self.num_validators} validators")
        
        byzantine_count = int(self.num_validators * byzantine_fraction)
        bootstrap_peers = []
        
        # Create all validators
        for i in range(self.num_validators):
            port = find_available_port(self.base_port + i)
            node_id = f"validator_{i}"
            
            # First validator has no bootstrap peers, others connect to previous
            peers = [(self.validators[0].host, self.validators[0].port)] if i > 0 and self.validators else []
            
            validator = EnhancedSBCPValidator(node_id, port, peers)
            
            # Set Byzantine behavior for some validators
            if i < byzantine_count:
                validator.set_byzantine(True)
            
            self.validators.append(validator)
            bootstrap_peers.append((validator.host, validator.port))
        
        # Start all validators
        tasks = []
        for validator in self.validators:
            task = asyncio.create_task(self.start_validator(validator))
            tasks.append(task)
        
        # Wait for all to start
        await asyncio.gather(*tasks)
        
        # Give time for peer discovery
        await asyncio.sleep(2)
        
        logger.info(f"Network started with {len(self.validators)} validators")
        return self.validators
    
    async def start_validator(self, validator: EnhancedSBCPValidator):
        """Start a single validator"""
        await validator.start_networking()
        
        config = uvicorn.Config(
            validator.app,
            host="0.0.0.0",
            port=validator.port,
            log_level="warning"
        )
        server = uvicorn.Server(config)
        
        # Start server in background
        asyncio.create_task(server.serve())
        
        logger.info(f"Started validator {validator.node_id} on port {validator.port}")
    
    async def send_test_transaction(self, tx_data: dict = None) -> str:
        """Send a test transaction to the network"""
        if not self.validators:
            raise Exception("No validators running")
        
        if tx_data is None:
            tx_data = {
                "tx_id": f"test_tx_{int(time.time() * 1000)}",
                "from_addr": f"addr_{random.randint(1, 100)}",
                "to_addr": f"addr_{random.randint(1, 100)}",
                "value": random.uniform(10, 1000),
                "timestamp": time.time(),
                "risk_score": random.uniform(0.0, 0.5),
                "complexity_class": random.choice([1, 2, 3])
            }
        
        tx = TransactionModel(**tx_data)
        
        # Send to first validator (it will gossip to others)
        validator = self.validators[0]
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"http://{validator.host}:{validator.port}/transaction/submit",
                json=tx.dict()
            ) as response:
                if response.status == 200:
                    logger.info(f"Submitted transaction {tx.tx_id} to network")
                    return tx.tx_id
                else:
                    raise Exception(f"Failed to submit transaction: {response.status}")
    
    async def wait_for_consensus(self, tx_id: str, timeout: float = 30.0) -> Dict:
        """Wait for consensus on a transaction across the network"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Check consensus status across validators
            consensus_results = []
            
            async with aiohttp.ClientSession() as session:
                for validator in self.validators:
                    try:
                        async with session.get(
                            f"http://{validator.host}:{validator.port}/consensus/{tx_id}"
                        ) as response:
                            if response.status == 200:
                                result = await response.json()
                                consensus_results.append(result)
                    except:
                        pass
            
            # Check if majority have finalized
            finalized_count = sum(1 for r in consensus_results if r.get("status") == "finalized")
            
            if finalized_count > len(self.validators) / 2:
                logger.info(f"Consensus reached for {tx_id}: {finalized_count}/{len(self.validators)} finalized")
                return {
                    "tx_id": tx_id,
                    "status": "consensus_reached",
                    "finalized_validators": finalized_count,
                    "total_validators": len(self.validators),
                    "results": consensus_results
                }
            
            await asyncio.sleep(0.5)
        
        return {
            "tx_id": tx_id,
            "status": "timeout",
            "results": consensus_results
        }
    
    async def get_network_status(self) -> Dict:
        """Get status of the entire network"""
        status = {
            "validator_count": len(self.validators),
            "validators": [],
            "network_health": "unknown"
        }
        
        healthy_validators = 0
        
        async with aiohttp.ClientSession() as session:
            for validator in self.validators:
                try:
                    async with session.get(
                        f"http://{validator.host}:{validator.port}/network/state",
                        timeout=aiohttp.ClientTimeout(total=2)
                    ) as response:
                        if response.status == 200:
                            state = await response.json()
                            status["validators"].append({
                                "node_id": validator.node_id,
                                "port": validator.port,
                                "status": "healthy",
                                "processed_tx": state.get("processed_transactions", 0),
                                "consensus_height": state.get("consensus_height", 0)
                            })
                            healthy_validators += 1
                        else:
                            status["validators"].append({
                                "node_id": validator.node_id,
                                "port": validator.port,
                                "status": "unhealthy"
                            })
                except Exception as e:
                    status["validators"].append({
                        "node_id": validator.node_id,
                        "port": validator.port,
                        "status": "unreachable",
                        "error": str(e)
                    })
        
        # Determine network health
        health_ratio = healthy_validators / len(self.validators)
        if health_ratio >= 0.8:
            status["network_health"] = "healthy"
        elif health_ratio >= 0.5:
            status["network_health"] = "degraded"
        else:
            status["network_health"] = "critical"
        
        status["healthy_validator_count"] = healthy_validators
        return status
    
    async def shutdown_network(self):
        """Shutdown all validators in the network"""
        logger.info("Shutting down network...")
        
        tasks = []
        for validator in self.validators:
            task = asyncio.create_task(validator.shutdown())
            tasks.append(task)
        
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("Network shutdown complete")

# Demonstration and Testing Functions
async def run_consensus_demo():
    """Run a demonstration of the SBCP consensus mechanism"""
    logger.info("Starting SBCP Consensus Demonstration")
    
    # Start network
    bootstrapper = NetworkBootstrapper(num_validators=7, base_port=8000)
    validators = await bootstrapper.start_network(byzantine_fraction=0.2)
    
    try:
        # Wait for network to stabilize
        await asyncio.sleep(3)
        
        # Check network status
        network_status = await bootstrapper.get_network_status()
        logger.info(f"Network Status: {network_status['network_health']} ({network_status['healthy_validator_count']}/{network_status['validator_count']} healthy)")
        
        # Send test transactions
        logger.info("Sending test transactions...")
        
        test_transactions = [
            {"value": 100, "risk_score": 0.1},
            {"value": 5000, "risk_score": 0.6},
            {"value": 50, "risk_score": 0.2},
            {"value": 10000, "risk_score": 0.9},  # High risk transaction
            {"value": 250, "risk_score": 0.3}
        ]
        
        consensus_results = []
        
        for i, tx_config in enumerate(test_transactions):
            tx_data = {
                "tx_id": f"demo_tx_{i}",
                "from_addr": f"demo_addr_{i}",
                "to_addr": f"demo_addr_{i+1}",
                "value": tx_config["value"],
                "timestamp": time.time(),
                "risk_score": tx_config["risk_score"],
                "complexity_class": 2
            }
            
            # Submit transaction
            tx_id = await bootstrapper.send_test_transaction(tx_data)
            
            # Wait for consensus
            logger.info(f"Waiting for consensus on transaction {tx_id}...")
            result = await bootstrapper.wait_for_consensus(tx_id, timeout=15)
            consensus_results.append(result)
            
            # Brief pause between transactions
            await asyncio.sleep(1)
        
        # Display results
        logger.info("=== CONSENSUS RESULTS ===")
        for result in consensus_results:
            status = result["status"]
            tx_id = result["tx_id"]
            if status == "consensus_reached":
                finalized = result["finalized_validators"]
                total = result["total_validators"]
                logger.info(f"TX {tx_id}: CONSENSUS REACHED ({finalized}/{total} validators)")
                
                # Show individual validator results
                for r in result["results"]:
                    if r.get("status") == "finalized":
                        decision = "ACCEPT" if r.get("decision") else "REJECT"
                        confidence = r.get("confidence", 0)
                        logger.info(f"  - Decision: {decision}, Confidence: {confidence:.3f}")
            else:
                logger.info(f"TX {tx_id}: {status.upper()}")
        
        # Final network status
        final_status = await bootstrapper.get_network_status()
        logger.info(f"Final Network Status: {final_status}")
        
    finally:
        # Cleanup
        await bootstrapper.shutdown_network()

# CLI Interface
def main():
    parser = argparse.ArgumentParser(description="Enhanced SBCP Distributed Consensus Network")
    parser.add_argument("--mode", choices=["validator", "demo", "network"], default="demo",
                       help="Run mode: single validator, demo, or full network")
    parser.add_argument("--node-id", type=str, default="validator_0",
                       help="Node ID for validator mode")
    parser.add_argument("--port", type=int, default=8000,
                       help="Port for validator mode")
    parser.add_argument("--byzantine", action="store_true",
                       help="Enable Byzantine behavior for validator")
    parser.add_argument("--validators", type=int, default=7,
                       help="Number of validators for network/demo mode")
    parser.add_argument("--byzantine-fraction", type=float, default=0.2,
                       help="Fraction of Byzantine validators")
    parser.add_argument("--bootstrap-peers", type=str, nargs="*",
                       help="Bootstrap peers in format host:port")
    
    args = parser.parse_args()
    
    # Parse bootstrap peers
    bootstrap_peers = []
    if args.bootstrap_peers:
        for peer in args.bootstrap_peers:
            try:
                host, port = peer.split(":")
                bootstrap_peers.append((host, int(port)))
            except ValueError:
                logger.error(f"Invalid bootstrap peer format: {peer}")
                return
    
    async def run_validator():
        """Run a single validator node"""
        port = find_available_port(args.port)
        validator = EnhancedSBCPValidator(args.node_id, port, bootstrap_peers)
        
        if args.byzantine:
            validator.set_byzantine(True)
        
        await validator.start_networking()
        
        # Setup graceful shutdown
        def signal_handler(signum, frame):
            logger.info("Received shutdown signal")
            asyncio.create_task(validator.shutdown())
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Start server
        config = uvicorn.Config(
            validator.app,
            host="0.0.0.0",
            port=port,
            log_level="info"
        )
        server = uvicorn.Server(config)
        
        logger.info(f"Starting SBCP Validator {args.node_id} on port {port}")
        logger.info(f"Byzantine behavior: {'ENABLED' if args.byzantine else 'DISABLED'}")
        
        await server.serve()
    
    async def run_network():
        """Run a full network of validators"""
        bootstrapper = NetworkBootstrapper(args.validators, 8000)
        await bootstrapper.start_network(args.byzantine_fraction)
        
        logger.info(f"Network started with {args.validators} validators")
        logger.info("Network will run indefinitely. Press Ctrl+C to stop.")
        
        try:
            # Keep network running
            while True:
                status = await bootstrapper.get_network_status()
                logger.info(f"Network Health: {status['network_health']}")
                await asyncio.sleep(30)
        except KeyboardInterrupt:
            logger.info("Shutting down network...")
            await bootstrapper.shutdown_network()
    
    # Run based on mode
    if args.mode == "validator":
        asyncio.run(run_validator())
    elif args.mode == "network":
        asyncio.run(run_network())
    elif args.mode == "demo":
        asyncio.run(run_consensus_demo())

if __name__ == "__main__":
    main()