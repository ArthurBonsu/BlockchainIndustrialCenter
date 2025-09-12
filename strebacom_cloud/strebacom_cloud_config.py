#!/usr/bin/env python3
"""
Improved Strebacom Cloud Configuration
Optimized for better performance with Flask
"""

import os
import json
import asyncio
import time
import random
import hashlib
import math
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import logging
from flask import Flask, request, jsonify
import threading
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class StrebaCOMCloudConfig:
    """Configuration for cloud-deployed Strebacom validator"""
    node_id: str
    validator_type: str  # "honest" or "byzantine"
    stake_weight: float
    reputation: float
    quorum_participation: float
    lambda_base: float = 8.0
    byzantine_behavior_intensity: float = 0.3

class ImprovedStrebaCOMValidator:
    """
    Improved Strebacom validator with better performance
    """
    
    def __init__(self, config: StrebaCOMCloudConfig):
        self.config = config
        self.node_id = config.node_id
        self.is_byzantine = config.validator_type == "byzantine"
        
        # Strebacom parameters - more reasonable values
        self.lambda_base = float(os.environ.get('STREBACOM_LAMBDA_BASE', config.lambda_base))
        self.time_scaling_factor = float(os.environ.get('STREBACOM_TIME_SCALING', '10.0'))
        
        # Skip expensive operations if configured
        self.skip_peer_broadcast = os.environ.get('STREBACOM_SKIP_PEER_BROADCAST', 'false').lower() == 'true'
        self.async_mode = os.environ.get('STREBACOM_ASYNC_MODE', 'false').lower() == 'true'
        
        # Finality thresholds
        self.finality_thresholds = {
            'provisional': float(os.environ.get('STREBACOM_FINALITY_PROVISIONAL', '0.70')),
            'economic': float(os.environ.get('STREBACOM_FINALITY_ECONOMIC', '0.85')),
            'absolute': float(os.environ.get('STREBACOM_FINALITY_ABSOLUTE', '0.95'))
        }
        
        # Validator state
        self.peer_validators: Dict[str, str] = {}
        self.active_transactions: Dict[str, Dict] = {}
        self.confidence_scores: Dict[str, float] = {}
        self.rolling_hash = hashlib.sha256(f"strebacom_{self.node_id}".encode()).hexdigest()
        
        # Performance tracking
        self.processed_count = 0
        self.start_time = time.time()
        self.consensus_achievements = {
            'provisional': 0, 'economic': 0, 'absolute': 0
        }
        
        # Create thread pool for async operations
        self.executor = ThreadPoolExecutor(max_workers=5)
        
        # Kuramoto synchronization
        self.phase = random.uniform(0, 2 * math.pi)
        self.natural_frequency = random.uniform(0.95, 1.05)
        
        logger.info(f"Initialized improved validator {self.node_id}")
        logger.info(f"Type: {config.validator_type}, Skip broadcast: {self.skip_peer_broadcast}")
    
    def create_flask_app(self) -> Flask:
        """Create Flask app with improved performance"""
        app = Flask(__name__)
        
        @app.route('/', methods=['GET'])
        def health_check():
            """Health check endpoint"""
            return jsonify({
                "status": "healthy",
                "node_id": self.node_id,
                "validator_type": self.config.validator_type,
                "processed_transactions": self.processed_count,
                "uptime": time.time() - self.start_time,
                "finality_rate": self.calculate_finality_rate()
            })
        
        @app.route('/health', methods=['GET'])
        def simple_health():
            """Simple health check"""
            return jsonify({"status": "ok"}), 200
        
        @app.route('/strebacom/transaction/propose', methods=['POST'])
        def propose_transaction():
            """Process transaction with improved efficiency"""
            try:
                tx_data = request.get_json()
                
                # Process transaction efficiently
                result = self.process_transaction_efficient(tx_data)
                
                return jsonify(result)
            except Exception as e:
                logger.error(f"Transaction processing error: {e}")
                return jsonify({"error": str(e)}), 500
        
        @app.route('/strebacom/peers/register', methods=['POST'])
        def register_peer():
            """Register peer validator"""
            try:
                peer_data = request.get_json()
                peer_id = peer_data.get("node_id")
                peer_url = peer_data.get("service_url")
                
                if peer_id and peer_url:
                    self.peer_validators[peer_id] = peer_url
                    return jsonify({"status": "registered", "peer_id": peer_id})
                
                return jsonify({"error": "Invalid peer data"}), 400
            except Exception as e:
                logger.error(f"Peer registration error: {e}")
                return jsonify({"error": str(e)}), 500
        
        @app.route('/strebacom/validation/vote', methods=['POST'])
        def receive_validation_vote():
            """Receive validation vote - lightweight processing"""
            try:
                # Simply acknowledge receipt without heavy processing
                return jsonify({"status": "vote_received"})
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @app.route('/strebacom/consensus/status/<tx_id>', methods=['GET'])
        def get_consensus_status(tx_id):
            """Get consensus status"""
            try:
                confidence = self.confidence_scores.get(tx_id, 0.0)
                
                return jsonify({
                    "tx_id": tx_id,
                    "confidence": confidence,
                    "finality_tier": self.determine_finality_tier(confidence),
                    "consensus_achieved": confidence >= self.finality_thresholds['provisional']
                })
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @app.route('/strebacom/metrics', methods=['GET'])
        def get_metrics():
            """Get validator metrics"""
            try:
                uptime = time.time() - self.start_time
                
                return jsonify({
                    "node_id": self.node_id,
                    "validator_type": self.config.validator_type,
                    "processed_transactions": self.processed_count,
                    "uptime_seconds": uptime,
                    "transactions_per_second": self.processed_count / uptime if uptime > 0 else 0,
                    "consensus_achievements": self.consensus_achievements,
                    "finality_rate": self.calculate_finality_rate()
                })
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        return app
    
    def calculate_finality_rate(self) -> float:
        """Calculate overall finality rate"""
        total_finalized = sum(self.consensus_achievements.values())
        return total_finalized / max(self.processed_count, 1)
    
    def process_transaction_efficient(self, tx_data: Dict) -> Dict:
        """
        Process transaction efficiently without unnecessary async overhead
        """
        tx_id = tx_data["tx_id"]
        start_time = time.time()
        
        # Store transaction
        self.active_transactions[tx_id] = {
            **tx_data,
            "arrival_time": start_time
        }
        
        # Quick validation decision
        vote, vote_confidence = self.quick_validation(tx_data)
        
        # Calculate confidence using simplified formula
        confidence = self.calculate_confidence_simple(tx_data, vote_confidence)
        self.confidence_scores[tx_id] = confidence
        
        # Determine finality tier
        finality_tier = self.determine_finality_tier(confidence)
        
        # Update metrics
        if finality_tier in self.consensus_achievements:
            self.consensus_achievements[finality_tier] += 1
        
        # Update rolling hash
        self.update_rolling_hash_simple(tx_data, confidence)
        
        # Update Kuramoto phase
        self.phase = (self.phase + self.natural_frequency * 0.01) % (2 * math.pi)
        
        self.processed_count += 1
        processing_time = time.time() - start_time
        
        # Fire-and-forget peer broadcast if enabled
        if not self.skip_peer_broadcast and self.peer_validators:
            # Use thread pool to avoid blocking
            self.executor.submit(self.broadcast_to_peers_simple, tx_id, vote, vote_confidence)
        
        return {
            "tx_id": tx_id,
            "validator_id": self.node_id,
            "vote": vote,
            "confidence": confidence,
            "finality_tier": finality_tier,
            "processing_time": processing_time,
            "rolling_hash": self.rolling_hash[:16],
            "consensus_type": "strebacom_improved"
        }
    
    def quick_validation(self, tx_data: Dict) -> Tuple[bool, float]:
        """Quick validation without async delays"""
        if self.is_byzantine:
            # Byzantine behavior
            byzantine_intensity = float(os.environ.get('STREBACOM_BYZANTINE_INTENSITY', '0.3'))
            vote = random.random() < byzantine_intensity
            confidence = random.uniform(0.1, 0.3)
        else:
            # Honest validator
            risk_score = tx_data.get("risk_score", 0.5)
            base_validity = risk_score < 0.5  # More lenient
            vote_probability = self.config.reputation * (1.1 if base_validity else 0.4)
            vote = random.random() < vote_probability
            confidence = self.config.reputation * (0.85 if vote == base_validity else 0.5)
        
        return vote, confidence
    
    def calculate_confidence_simple(self, tx_data: Dict, vote_confidence: float) -> float:
        """Simplified confidence calculation for better performance"""
        # Simple time-based confidence growth
        time_elapsed = (time.time() - tx_data.get("timestamp", time.time())) * self.time_scaling_factor
        time_elapsed = max(time_elapsed, 0.001)
        
        # Simplified validation weight
        wi = self.config.stake_weight
        ri = self.config.reputation
        vi = vote_confidence
        
        validation_weight = wi * ri * vi * math.log(1 + time_elapsed)
        
        # Dynamic lambda (simplified)
        lambda_t = self.lambda_base * (1 + 0.2 * vi)
        
        # Confidence formula
        confidence = 1.0 - math.exp(-lambda_t * validation_weight * time_elapsed)
        confidence = min(confidence, 0.999)
        
        return confidence
    
    def determine_finality_tier(self, confidence: float) -> str:
        """Determine finality tier"""
        if confidence >= self.finality_thresholds['absolute']:
            return 'absolute'
        elif confidence >= self.finality_thresholds['economic']:
            return 'economic'
        elif confidence >= self.finality_thresholds['provisional']:
            return 'provisional'
        return 'none'
    
    def update_rolling_hash_simple(self, tx_data: Dict, confidence: float):
        """Update rolling hash simply"""
        hash_input = f"{self.rolling_hash[:8]}{tx_data['tx_id']}{confidence:.3f}"
        self.rolling_hash = hashlib.sha256(hash_input.encode()).hexdigest()
    
    def broadcast_to_peers_simple(self, tx_id: str, vote: bool, confidence: float):
        """Simple fire-and-forget broadcast (runs in thread pool)"""
        # This runs in background thread, doesn't block main processing
        import requests
        
        vote_data = {
            "tx_id": tx_id,
            "validator_id": self.node_id,
            "vote": vote,
            "confidence": confidence
        }
        
        for peer_url in list(self.peer_validators.values())[:3]:  # Limit to 3 peers
            try:
                requests.post(
                    f"{peer_url}/strebacom/validation/vote",
                    json=vote_data,
                    timeout=1  # Very short timeout
                )
            except:
                pass  # Ignore errors in fire-and-forget

# Cloud Run deployment entry point
def create_cloud_run_app():
    """Create Flask app for Google Cloud Run deployment"""
    # Get configuration from environment variables
    node_id = os.environ.get('STREBACOM_NODE_ID', f'validator_{random.randint(1000, 9999)}')
    validator_type = os.environ.get('STREBACOM_VALIDATOR_TYPE', 'honest')
    reputation = float(os.environ.get('STREBACOM_REPUTATION', '0.9'))
    stake_weight = float(os.environ.get('STREBACOM_STAKE_WEIGHT', '2.0'))
    quorum_participation = float(os.environ.get('STREBACOM_QUORUM_PARTICIPATION', '0.85'))
    lambda_base = float(os.environ.get('STREBACOM_LAMBDA_BASE', '8.0'))
    
    config = StrebaCOMCloudConfig(
        node_id=node_id,
        validator_type=validator_type,
        stake_weight=stake_weight,
        reputation=reputation,
        quorum_participation=quorum_participation,
        lambda_base=lambda_base
    )
    
    validator = ImprovedStrebaCOMValidator(config)
    app = validator.create_flask_app()
    
    logger.info(f"Starting improved Strebacom validator: {node_id} (type: {validator_type})")
    return app

if __name__ == "__main__":
    app = create_cloud_run_app()
    
    # Get port from environment variable
    port = int(os.environ.get('PORT', 8080))
    
    logger.info(f"Starting improved Strebacom validator on port {port}")
    
    # Use threaded mode for better concurrency
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)