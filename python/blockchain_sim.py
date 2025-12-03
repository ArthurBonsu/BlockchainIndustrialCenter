"""
NeXos Blockchain Simulation
===========================
Simulates the blockchain-backed trust infrastructure:
- Federated Blockchain Nodes (Br_1, Br_2)
- Data Identity Registration
- Smart Contract-based Access Control
- Classification Smart Contracts
"""

import hashlib
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum
import threading
import queue
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import SecurityLevel, CLASSIFICATION_TAXONOMY

# =============================================================================
# Blockchain Data Structures
# =============================================================================

@dataclass
class Block:
    """
    Block in the NeXos blockchain.
    Contains data identity registrations and smart contract executions.
    """
    index: int
    timestamp: str
    transactions: List[Dict[str, Any]]
    previous_hash: str
    nonce: int = 0
    hash: str = ""
    
    def compute_hash(self) -> str:
        """Compute block hash"""
        block_data = json.dumps({
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce
        }, sort_keys=True)
        self.hash = hashlib.sha256(block_data.encode()).hexdigest()
        return self.hash


@dataclass
class Transaction:
    """
    Blockchain transaction for data identity registration.
    Tx_reg(u) = SC_classify(IS(u), Sign(pk_Org, IS(u)))
    """
    tx_id: str
    tx_type: str  # "REGISTER", "ACCESS", "UPDATE", "REVOKE"
    timestamp: str
    
    # Data identity
    record_id: str
    source_org: str
    source_db: str
    content_hash: str
    
    # Classification from smart contract
    classification: str
    security_level: int
    
    # Cryptographic signature
    signature: str
    public_key: str
    
    # Validation result
    is_valid: bool = False
    validation_timestamp: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SmartContractExecution:
    """Record of smart contract execution"""
    contract_id: str
    contract_type: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    execution_time_ms: float
    gas_used: int
    success: bool

# =============================================================================
# Cryptographic Utilities
# =============================================================================

class CryptoUtils:
    """Cryptographic utilities for the blockchain"""
    
    @staticmethod
    def generate_key_pair(org_id: str) -> Tuple[str, str]:
        """
        Generate cryptographic key pair κ_i = (pk_i, ps_i)
        Simplified simulation using SHA-256
        """
        seed = f"{org_id}_{datetime.now().isoformat()}_{id(org_id)}"
        private_key = hashlib.sha256(seed.encode()).hexdigest()
        public_key = hashlib.sha256(private_key.encode()).hexdigest()
        return (private_key, public_key)
    
    @staticmethod
    def sign(private_key: str, data: str) -> str:
        """
        Sign data with private key: Sign(pk, m)
        """
        signature_input = f"{private_key}:{data}"
        return hashlib.sha256(signature_input.encode()).hexdigest()
    
    @staticmethod
    def verify(public_key: str, signature: str, data: str, 
               private_key: str) -> bool:
        """
        Verify signature: Verify(ps, σ) = true ⟺ σ = Sign(pk, m)
        """
        expected_signature = CryptoUtils.sign(private_key, data)
        return signature == expected_signature

# =============================================================================
# Smart Contracts
# =============================================================================

class ClassificationSmartContract:
    """
    Data Classification Smart Contract (SC_classify)
    Implements: Valid(Tx_reg(u)) ⟺ Verify(ps_Org, σ) ∧ PolicyCheck(cls(u), sec(u))
    """
    
    def __init__(self, taxonomy: Dict[str, Any] = None):
        self.contract_id = "SC_CLASSIFY_001"
        self.taxonomy = taxonomy or CLASSIFICATION_TAXONOMY
        self.execution_count = 0
        self.gas_per_execution = 21000
    
    def execute(self, instruction_set: Dict[str, Any], 
                signature: str, public_key: str) -> SmartContractExecution:
        """Execute classification validation"""
        start_time = time.time()
        
        # Extract data
        classification = instruction_set.get("classification", "UNKNOWN")
        security_level = instruction_set.get("security_level", 1)
        
        # PolicyCheck(cls(u), sec(u))
        policy_valid = self._policy_check(classification, security_level)
        
        # Signature verification (simplified)
        sig_valid = len(signature) == 64 and len(public_key) == 64
        
        # Overall validation
        is_valid = policy_valid and sig_valid
        
        execution_time = (time.time() - start_time) * 1000
        self.execution_count += 1
        
        return SmartContractExecution(
            contract_id=self.contract_id,
            contract_type="CLASSIFICATION",
            input_data={
                "instruction_set": instruction_set,
                "signature": signature[:16] + "...",
                "public_key": public_key[:16] + "..."
            },
            output_data={
                "is_valid": is_valid,
                "policy_check": policy_valid,
                "signature_check": sig_valid,
                "validated_classification": classification,
                "validated_security_level": security_level
            },
            execution_time_ms=execution_time,
            gas_used=self.gas_per_execution,
            success=is_valid
        )
    
    def _policy_check(self, classification: str, security_level: int) -> bool:
        """
        PolicyCheck(cls(u), sec(u))
        Verify classification is valid and security level is appropriate
        """
        if classification not in self.taxonomy:
            return False
        
        expected_level = self.taxonomy[classification].get("security_level")
        if isinstance(expected_level, SecurityLevel):
            expected_level = expected_level.value
        
        # Security level must be at least the expected level
        return security_level >= expected_level


class AccessControlSmartContract:
    """
    Access Control Smart Contract implementing ABAC
    Access(u, a, r) = ∧_{p ∈ P} Eval(p, attr(u), attr(a), attr(r))
    """
    
    def __init__(self):
        self.contract_id = "SC_ACCESS_001"
        self.policies = self._initialize_policies()
        self.execution_count = 0
        self.gas_per_execution = 35000
    
    def _initialize_policies(self) -> List[Dict[str, Any]]:
        """Initialize access control policies"""
        return [
            {
                "policy_id": "P001",
                "name": "SecurityLevelAccess",
                "rule": "user.clearance >= resource.security_level"
            },
            {
                "policy_id": "P002", 
                "name": "OrganizationAccess",
                "rule": "user.org in resource.allowed_orgs or resource.is_public"
            },
            {
                "policy_id": "P003",
                "name": "ActionPermission",
                "rule": "action in user.permissions"
            }
        ]
    
    def execute(self, user_attrs: Dict[str, Any], 
                action: str, 
                resource_attrs: Dict[str, Any]) -> SmartContractExecution:
        """
        Execute access control check
        """
        start_time = time.time()
        
        policy_results = []
        all_passed = True
        
        for policy in self.policies:
            result = self._evaluate_policy(policy, user_attrs, action, resource_attrs)
            policy_results.append({
                "policy_id": policy["policy_id"],
                "name": policy["name"],
                "passed": result
            })
            if not result:
                all_passed = False
        
        execution_time = (time.time() - start_time) * 1000
        self.execution_count += 1
        
        return SmartContractExecution(
            contract_id=self.contract_id,
            contract_type="ACCESS_CONTROL",
            input_data={
                "user": user_attrs,
                "action": action,
                "resource": resource_attrs
            },
            output_data={
                "access_granted": all_passed,
                "policy_results": policy_results
            },
            execution_time_ms=execution_time,
            gas_used=self.gas_per_execution,
            success=True
        )
    
    def _evaluate_policy(self, policy: Dict[str, Any],
                         user_attrs: Dict[str, Any],
                         action: str,
                         resource_attrs: Dict[str, Any]) -> bool:
        """Evaluate single policy"""
        policy_id = policy["policy_id"]
        
        if policy_id == "P001":
            # Security level check
            user_clearance = user_attrs.get("clearance", 1)
            resource_level = resource_attrs.get("security_level", 1)
            return user_clearance >= resource_level
        
        elif policy_id == "P002":
            # Organization access check
            user_org = user_attrs.get("org", "")
            allowed_orgs = resource_attrs.get("allowed_orgs", [])
            is_public = resource_attrs.get("is_public", False)
            return user_org in allowed_orgs or is_public
        
        elif policy_id == "P003":
            # Action permission check
            user_permissions = user_attrs.get("permissions", [])
            return action in user_permissions
        
        return False

# =============================================================================
# Blockchain Network Simulation
# =============================================================================

class BlockchainNode:
    """
    Simulates a Federated Blockchain Node (Br_1 or Br_2)
    """
    
    def __init__(self, node_id: str, is_primary: bool = False):
        self.node_id = node_id
        self.is_primary = is_primary
        self.chain: List[Block] = []
        self.pending_transactions: List[Transaction] = []
        self.block_size = 100
        
        # Smart contracts
        self.classification_contract = ClassificationSmartContract()
        self.access_contract = AccessControlSmartContract()
        
        # Organization keys
        self.org_keys: Dict[str, Tuple[str, str]] = {}
        
        # Statistics
        self.stats = {
            "blocks_created": 0,
            "transactions_processed": 0,
            "contracts_executed": 0,
            "total_gas_used": 0,
            "avg_block_time_ms": 0,
            "block_times": []
        }
        
        # Create genesis block
        self._create_genesis_block()
    
    def _create_genesis_block(self):
        """Create the genesis block"""
        genesis = Block(
            index=0,
            timestamp=datetime.now().isoformat(),
            transactions=[{"type": "GENESIS", "message": "NeXos Blockchain Initialized"}],
            previous_hash="0" * 64
        )
        genesis.compute_hash()
        self.chain.append(genesis)
    
    def register_organization(self, org_id: str) -> Dict[str, str]:
        """
        Register organization and generate key pair
        κ_i = (pk_i, ps_i)
        """
        private_key, public_key = CryptoUtils.generate_key_pair(org_id)
        self.org_keys[org_id] = (private_key, public_key)
        
        return {
            "org_id": org_id,
            "public_key": public_key,
            "did": f"did:nexos:{hashlib.sha256(public_key.encode()).hexdigest()[:32]}"
        }
    
    def create_registration_transaction(self, 
                                         instruction_set: Dict[str, Any]) -> Transaction:
        """
        Create data identity registration transaction
        Tx_reg(u) = SC_classify(IS(u), Sign(pk_Org, IS(u)))
        """
        org_id = instruction_set.get("source_org", "Unknown")
        
        # Get or create keys
        if org_id not in self.org_keys:
            self.register_organization(org_id)
        
        private_key, public_key = self.org_keys[org_id]
        
        # Sign instruction set
        is_data = json.dumps(instruction_set, sort_keys=True)
        signature = CryptoUtils.sign(private_key, is_data)
        
        # Execute classification smart contract
        contract_result = self.classification_contract.execute(
            instruction_set, signature, public_key
        )
        
        self.stats["contracts_executed"] += 1
        self.stats["total_gas_used"] += contract_result.gas_used
        
        # Create transaction
        tx = Transaction(
            tx_id=hashlib.sha256(f"{instruction_set['record_id']}_{time.time()}".encode()).hexdigest()[:32],
            tx_type="REGISTER",
            timestamp=datetime.now().isoformat(),
            record_id=instruction_set.get("record_id", ""),
            source_org=org_id,
            source_db=instruction_set.get("source_db", ""),
            content_hash=instruction_set.get("content_hash", ""),
            classification=instruction_set.get("classification", ""),
            security_level=instruction_set.get("security_level", 1),
            signature=signature,
            public_key=public_key,
            is_valid=contract_result.success,
            validation_timestamp=datetime.now().isoformat()
        )
        
        self.pending_transactions.append(tx)
        self.stats["transactions_processed"] += 1
        
        return tx
    
    def mine_block(self) -> Optional[Block]:
        """
        Mine a new block with pending transactions
        Simplified proof-of-authority consensus
        """
        if not self.pending_transactions:
            return None
        
        start_time = time.time()
        
        # Get transactions for this block
        block_txs = self.pending_transactions[:self.block_size]
        self.pending_transactions = self.pending_transactions[self.block_size:]
        
        # Create new block
        new_block = Block(
            index=len(self.chain),
            timestamp=datetime.now().isoformat(),
            transactions=[tx.to_dict() for tx in block_txs],
            previous_hash=self.chain[-1].hash
        )
        
        # Simple PoA - no complex mining
        new_block.nonce = 1
        new_block.compute_hash()
        
        self.chain.append(new_block)
        
        block_time = (time.time() - start_time) * 1000
        self.stats["blocks_created"] += 1
        self.stats["block_times"].append(block_time)
        self.stats["avg_block_time_ms"] = sum(self.stats["block_times"]) / len(self.stats["block_times"])
        
        return new_block
    
    def verify_chain(self) -> bool:
        """Verify blockchain integrity"""
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i-1]
            
            # Verify hash
            if current.previous_hash != previous.hash:
                return False
            
            # Verify current block hash
            computed_hash = current.compute_hash()
            if computed_hash != current.hash:
                return False
        
        return True
    
    def check_access(self, user_attrs: Dict[str, Any],
                     action: str,
                     resource_attrs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check access using Access Control Smart Contract
        Access(u, a, r) = ∧_{p ∈ P} Eval(p, attr(u), attr(a), attr(r))
        """
        result = self.access_contract.execute(user_attrs, action, resource_attrs)
        
        self.stats["contracts_executed"] += 1
        self.stats["total_gas_used"] += result.gas_used
        
        return {
            "access_granted": result.output_data["access_granted"],
            "policy_results": result.output_data["policy_results"],
            "execution_time_ms": result.execution_time_ms
        }
    
    def get_data_identity(self, record_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve data identity from blockchain"""
        for block in reversed(self.chain):
            for tx in block.transactions:
                if tx.get("record_id") == record_id:
                    return tx
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get blockchain statistics"""
        return {
            "node_id": self.node_id,
            "is_primary": self.is_primary,
            "chain_length": len(self.chain),
            "pending_transactions": len(self.pending_transactions),
            "chain_valid": self.verify_chain(),
            **self.stats
        }


class FederatedBlockchainNetwork:
    """
    Federated Blockchain Network managing multiple nodes (Br_1, Br_2, ...)
    Implements consensus and cross-node synchronization.
    """
    
    def __init__(self, num_nodes: int = 2):
        self.nodes: Dict[str, BlockchainNode] = {}
        self.primary_node_id: str = ""
        
        # Initialize nodes
        for i in range(num_nodes):
            node_id = f"Br_{i+1}"
            is_primary = (i == 0)
            self.nodes[node_id] = BlockchainNode(node_id, is_primary)
            if is_primary:
                self.primary_node_id = node_id
        
        # Network statistics
        self.network_stats = {
            "total_registrations": 0,
            "total_access_checks": 0,
            "consensus_rounds": 0,
            "sync_operations": 0
        }
    
    def register_data_identity(self, instruction_set: Dict[str, Any]) -> Dict[str, Any]:
        """Register data identity through primary node"""
        primary = self.nodes[self.primary_node_id]
        
        # Create transaction
        tx = primary.create_registration_transaction(instruction_set)
        
        # Mine block if enough transactions
        if len(primary.pending_transactions) >= primary.block_size:
            block = primary.mine_block()
            if block:
                self._sync_to_other_nodes(block)
        
        self.network_stats["total_registrations"] += 1
        
        return {
            "tx_id": tx.tx_id,
            "is_valid": tx.is_valid,
            "block_pending": tx.tx_id in [t.tx_id for t in primary.pending_transactions]
        }
    
    def force_mine_block(self) -> Optional[Block]:
        """Force mining of current pending transactions"""
        primary = self.nodes[self.primary_node_id]
        block = primary.mine_block()
        
        if block:
            self._sync_to_other_nodes(block)
            self.network_stats["consensus_rounds"] += 1
        
        return block
    
    def _sync_to_other_nodes(self, block: Block):
        """Synchronize block to all other nodes"""
        for node_id, node in self.nodes.items():
            if node_id != self.primary_node_id:
                # Deep copy block for each node
                synced_block = copy.deepcopy(block)
                synced_block.index = len(node.chain)
                synced_block.previous_hash = node.chain[-1].hash
                synced_block.compute_hash()
                node.chain.append(synced_block)
        
        self.network_stats["sync_operations"] += 1
    
    def check_access(self, user_attrs: Dict[str, Any],
                     action: str,
                     resource_attrs: Dict[str, Any]) -> Dict[str, Any]:
        """Check access through primary node"""
        primary = self.nodes[self.primary_node_id]
        result = primary.check_access(user_attrs, action, resource_attrs)
        
        self.network_stats["total_access_checks"] += 1
        
        return result
    
    def get_network_stats(self) -> Dict[str, Any]:
        """Get comprehensive network statistics"""
        node_stats = {
            node_id: node.get_stats() 
            for node_id, node in self.nodes.items()
        }
        
        return {
            "network": self.network_stats,
            "nodes": node_stats
        }
    
    def verify_network_integrity(self) -> Dict[str, bool]:
        """Verify integrity of all nodes"""
        return {
            node_id: node.verify_chain()
            for node_id, node in self.nodes.items()
        }


if __name__ == "__main__":
    # Test blockchain simulation
    network = FederatedBlockchainNetwork(num_nodes=2)
    
    # Register some test data
    test_instructions = [
        {
            "record_id": f"REC_{i:04d}",
            "source_org": f"Org_{(i % 4) + 1}",
            "source_db": f"Db_{(i % 8) + 1}",
            "classification": ["PII", "PHI", "FINANCIAL", "PUBLIC"][i % 4],
            "security_level": (i % 5) + 1,
            "content_hash": hashlib.sha256(f"content_{i}".encode()).hexdigest()
        }
        for i in range(10)
    ]
    
    for instruction in test_instructions:
        result = network.register_data_identity(instruction)
        print(f"Registered {instruction['record_id']}: valid={result['is_valid']}")
    
    # Force mine remaining transactions
    network.force_mine_block()
    
    # Print stats
    print("\nNetwork Statistics:")
    print(json.dumps(network.get_network_stats(), indent=2))
