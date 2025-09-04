import numpy as np
import matplotlib.pyplot as plt
import asyncio
import json
import time
import hashlib
from dataclasses import dataclass, asdict
from typing import Dict, List, Set, Optional, Tuple
from enum import Enum
import random
from collections import defaultdict, deque
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TransactionState(Enum):
    RECEIVED = "received"
    VALIDATED = "validated" 
    ROUTING = "routing"
    CONSENSUS = "consensus"
    COMMITTED = "committed"
    FINALIZED = "finalized"
    REJECTED = "rejected"

@dataclass
class Transaction:
    tx_id: str
    from_addr: str
    to_addr: str
    value: float
    timestamp: float
    risk_score: float = 0.0
    complexity_class: int = 1  # 1=SIMPLE, 2=MEDIUM, 3=COMPLEX
    security_level: int = 2    # 1=MINIMAL, 2=STANDARD, 3=ENHANCED
    confidence_score: float = 0.0
    state: TransactionState = TransactionState.RECEIVED
    validation_count: int = 0
    validator_votes: Dict[str, bool] = None
    arrival_time: float = 0.0
    
    def __post_init__(self):
        if self.validator_votes is None:
            self.validator_votes = {}
        if self.arrival_time == 0.0:
            self.arrival_time = time.time()

@dataclass
class Validator:
    node_id: str
    reputation: float = 1.0
    stake_weight: float = 1.0
    processing_capacity: float = 1.0
    network_latency: float = 0.05  # 50ms default
    is_byzantine: bool = False
    validation_accuracy: float = 1.0
    
class SBCPSimulator:
    def __init__(self, num_validators: int = 20, byzantine_fraction: float = 0.2):
        self.validators: Dict[str, Validator] = {}
        self.transactions: Dict[str, Transaction] = {}
        self.confidence_history: Dict[str, List[Tuple[float, float]]] = {}
        self.network_load = 0.0
        self.lambda_base = 0.5
        self.rolling_hash = hashlib.sha256(b"genesis").hexdigest()
        
        # Initialize validators
        byzantine_count = int(num_validators * byzantine_fraction)
        for i in range(num_validators):
            validator = Validator(
                node_id=f"validator_{i}",
                reputation=random.uniform(0.7, 1.0),
                stake_weight=random.uniform(0.5, 2.0),
                processing_capacity=random.uniform(0.8, 1.5),
                network_latency=random.uniform(0.01, 0.1),
                is_byzantine=(i < byzantine_count),
                validation_accuracy=0.3 if i < byzantine_count else random.uniform(0.95, 1.0)
            )
            self.validators[validator.node_id] = validator
            
    def compute_risk_score(self, tx: Transaction) -> float:
        """ML-driven risk assessment simulation"""
        # Simplified risk model based on transaction characteristics
        value_risk = min(tx.value / 10000, 1.0)  # Higher values = higher risk
        
        # Simulate sender/receiver reputation (simplified)
        sender_risk = hash(tx.from_addr) % 100 / 100.0
        receiver_risk = hash(tx.to_addr) % 100 / 100.0
        
        # Combined risk score
        risk = (0.4 * value_risk + 0.3 * sender_risk + 0.3 * receiver_risk)
        return min(risk, 1.0)
    
    def compute_confidence_score(self, tx: Transaction, current_time: float) -> float:
        """Compute confidence score using the formula C(T,t) = 1 - e^(-λ(t)·V(T,t))"""
        # Use a minimum time elapsed to avoid zero confidence
        time_elapsed = max(current_time - tx.arrival_time, 0.001)  # At least 1ms
        
        # Network stability factor
        network_stability = 1.0 - (self.network_load / 2.0)
        lambda_t = max(self.lambda_base * (1 + 0.1 * network_stability), 1.0)  # Ensure lambda >= 1.0
        
        # Validation weight V(T,t) = Σ(wi * vi * Ri)
        validation_weight = 0.0
        total_validators_voted = 0
        
        for validator_id, vote in tx.validator_votes.items():
            if validator_id in self.validators:
                validator = self.validators[validator_id]
                wi = validator.stake_weight
                vi = 1.0 if vote else 0.0
                ri = validator.reputation
                validation_weight += wi * vi * ri
                total_validators_voted += 1
        
        # Ensure we have some validation weight
        if validation_weight == 0 and total_validators_voted > 0:
            validation_weight = 0.1  # Minimum weight for any validation activity
        
        # Debug output (remove after fixing)
        if tx.tx_id == "tx_0":  # Debug first transaction
            print(f"DEBUG tx_0: time_elapsed={time_elapsed:.6f}, lambda_t={lambda_t:.3f}, validation_weight={validation_weight:.3f}")
        
        # Confidence score calculation
        exponent = -lambda_t * validation_weight * time_elapsed
        confidence = 1.0 - np.exp(exponent)
        return min(confidence, 1.0)
    
    def validate_transaction(self, tx: Transaction, validator: Validator) -> bool:
        """Simulate validator decision with reputation-based accuracy"""
        if validator.is_byzantine:
            # Byzantine validators are unreliable
            return random.random() < validator.validation_accuracy
        else:
            # Honest validators with high accuracy
            base_validity = tx.risk_score < 0.8  # Simple validity rule
            return random.random() < validator.validation_accuracy if base_validity else False
    
    def process_transaction(self, tx: Transaction) -> None:
        """Process individual transaction through state machine"""
        current_time = time.time()
        
        # Risk assessment
        tx.risk_score = self.compute_risk_score(tx)
        
        # Route to validators based on complexity
        required_validators = min(5 + tx.complexity_class * 2, len(self.validators))
        selected_validators = random.sample(list(self.validators.keys()), required_validators)
        
        # Validation process
        for validator_id in selected_validators:
            validator = self.validators[validator_id]
            
            # Simulate network delay
            time.sleep(validator.network_latency / 1000)  # Convert to seconds
            
            # Validator decision
            vote = self.validate_transaction(tx, validator)
            tx.validator_votes[validator_id] = vote
            tx.validation_count += 1
            
        # Update confidence score
        tx.confidence_score = self.compute_confidence_score(tx, current_time)
        
        # Update transaction state based on confidence
        if tx.confidence_score >= 0.9999:
            tx.state = TransactionState.FINALIZED
        elif tx.confidence_score >= 0.99:
            tx.state = TransactionState.COMMITTED
        elif tx.confidence_score >= 0.5:
            tx.state = TransactionState.CONSENSUS
        else:
            tx.state = TransactionState.VALIDATED
            
        # Store in confidence history for analysis
        if tx.tx_id not in self.confidence_history:
            self.confidence_history[tx.tx_id] = []
        self.confidence_history[tx.tx_id].append((current_time - tx.arrival_time, tx.confidence_score))
        
        # Update rolling hash
        tx_hash = hashlib.sha256(json.dumps(asdict(tx), default=str).encode()).hexdigest()
        self.rolling_hash = hashlib.sha256((self.rolling_hash + tx_hash).encode()).hexdigest()
        
        logger.info(f"Transaction {tx.tx_id}: Confidence={tx.confidence_score:.4f}, State={tx.state.value}")
    
    def run_confidence_simulation(self, num_transactions: int = 100) -> Dict:
        """Run large-scale confidence evolution simulation"""
        results = {
            'transactions': [],
            'confidence_curves': [],
            'finality_times': [],
            'throughput_metrics': []
        }
        
        start_time = time.time()
        
        for i in range(num_transactions):
            # Generate transaction
            tx = Transaction(
                tx_id=f"tx_{i}",
                from_addr=f"addr_{random.randint(0, 100)}",
                to_addr=f"addr_{random.randint(0, 100)}",
                value=random.uniform(1, 10000),
                timestamp=time.time(),
                complexity_class=random.choice([1, 2, 3])
            )
            
            self.transactions[tx.tx_id] = tx
            self.process_transaction(tx)
            
            # Simulate network load
            self.network_load = min(len(self.transactions) / 1000.0, 1.0)
            
            # Store results
            results['transactions'].append({
                'tx_id': tx.tx_id,
                'confidence': tx.confidence_score,
                'state': tx.state.value,
                'validation_count': tx.validation_count,
                'risk_score': tx.risk_score
            })
            
            # Record finality time if achieved
            if tx.state == TransactionState.FINALIZED:
                finality_time = time.time() - tx.arrival_time
                results['finality_times'].append(finality_time)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Calculate throughput metrics
        results['throughput_metrics'] = {
            'total_transactions': num_transactions,
            'total_time': total_time,
            'tps': num_transactions / total_time,
            'avg_confidence': np.mean([tx['confidence'] for tx in results['transactions']]),
            'finality_rate': len(results['finality_times']) / num_transactions,
            'avg_finality_time': np.mean(results['finality_times']) if results['finality_times'] else 0
        }
        
        return results
    
    def plot_confidence_evolution(self, tx_ids: List[str] = None):
        """Plot confidence score evolution over time"""
        if tx_ids is None:
            tx_ids = list(self.confidence_history.keys())[:10]  # Plot first 10
            
        plt.figure(figsize=(12, 8))
        
        for tx_id in tx_ids:
            if tx_id in self.confidence_history:
                times, confidences = zip(*self.confidence_history[tx_id])
                plt.plot(times, confidences, label=f'TX {tx_id[-2:]}', alpha=0.7)
        
        plt.axhline(y=0.99, color='g', linestyle='--', label='Practical Finality (99%)')
        plt.axhline(y=0.9999, color='r', linestyle='--', label='Crypto Finality (99.99%)')
        
        plt.xlabel('Time Elapsed (seconds)')
        plt.ylabel('Confidence Score C(T,t)')
        plt.title('SBCP Confidence Score Evolution')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.show()
    
    def analyze_byzantine_impact(self) -> Dict:
        """Analyze impact of Byzantine validators"""
        honest_validators = [v for v in self.validators.values() if not v.is_byzantine]
        byzantine_validators = [v for v in self.validators.values() if v.is_byzantine]
        
        return {
            'total_validators': len(self.validators),
            'honest_count': len(honest_validators),
            'byzantine_count': len(byzantine_validators),
            'byzantine_fraction': len(byzantine_validators) / len(self.validators),
            'avg_honest_reputation': np.mean([v.reputation for v in honest_validators]),
            'avg_byzantine_reputation': np.mean([v.reputation for v in byzantine_validators]) if byzantine_validators else 0,
            'network_resilience': len(honest_validators) / len(self.validators) > 0.51
        }

# Example usage and testing
if __name__ == "__main__":
    # Create simulator with 20 validators, 20% Byzantine
    simulator = SBCPSimulator(num_validators=20, byzantine_fraction=0.2)
    
    print("Starting SBCP Simulation...")
    print(f"Network: {len(simulator.validators)} validators")
    
    # Run confidence evolution simulation
    results = simulator.run_confidence_simulation(num_transactions=50)
    
    # Print results
    print("\n=== Simulation Results ===")
    metrics = results['throughput_metrics']
    print(f"Total Transactions: {metrics['total_transactions']}")
    print(f"Processing Time: {metrics['total_time']:.2f} seconds")
    print(f"Throughput: {metrics['tps']:.2f} TPS")
    print(f"Average Confidence: {metrics['avg_confidence']:.4f}")
    print(f"Finality Rate: {metrics['finality_rate']:.2f}")
    print(f"Average Finality Time: {metrics['avg_finality_time']:.4f} seconds")
    
    # Analyze Byzantine impact
    byzantine_analysis = simulator.analyze_byzantine_impact()
    print(f"\n=== Byzantine Fault Tolerance Analysis ===")
    print(f"Byzantine Fraction: {byzantine_analysis['byzantine_fraction']:.2f}")
    print(f"Network Resilience: {byzantine_analysis['network_resilience']}")
    print(f"Honest Validator Reputation: {byzantine_analysis['avg_honest_reputation']:.3f}")
    
    # Plot confidence evolution
    simulator.plot_confidence_evolution()