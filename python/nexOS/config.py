"""
NeXos Experimental Configuration
================================
Configuration parameters for the NeXos Data Operating System simulation.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, List, Any
from enum import Enum

# =============================================================================
# Enumerations
# =============================================================================

class DataType(Enum):
    """Data type taxonomy as defined in the methodology"""
    STRUCTURED = "structured"
    SEMI_STRUCTURED = "semi-structured"
    UNSTRUCTURED = "unstructured"

class SecurityLevel(Enum):
    """Security levels for data classification"""
    PUBLIC = 1
    INTERNAL = 2
    CONFIDENTIAL = 3
    RESTRICTED = 4
    TOP_SECRET = 5

class ProcessingMode(Enum):
    """Processing mode based on latency requirements"""
    BATCH = "batch"
    STREAM = "stream"
    REAL_TIME = "real_time"

class DataCategory(Enum):
    """Data categories as per X = X_doc ∪ X_rt ∪ X_rel"""
    DOCUMENT = "document"      # X_doc: unstructured text, PDFs, images
    REAL_TIME = "real_time"    # X_rt: sensor feeds, event logs, message queues
    RELATIONAL = "relational"  # X_rel: structured tables from OLTP systems

# =============================================================================
# Configuration Classes
# =============================================================================

@dataclass
class OrganizationConfig:
    """
    Configuration for Organization Org_i = ⟨M_i, D_i, S_i, R_i, κ_i, Φ_i⟩
    """
    org_id: str
    name: str
    memory_mb: int = 1024          # M_i: Memory resources
    disk_gb: int = 100             # D_i: Disk storage capacity
    services: List[str] = field(default_factory=list)  # S_i: Data services
    recovery_enabled: bool = True  # R_i: Recovery mechanisms
    # κ_i = (pk_i, ps_i) generated at runtime

@dataclass
class DatabaseConfig:
    """
    Configuration for Database Db_k = ⟨T_k, E_k, Q_k, Λ_k⟩
    """
    db_id: str
    name: str
    data_type: DataType           # T_k: Data type taxonomy
    endpoint: str                 # E_k: Endpoint configuration
    query_language: str           # Q_k: Native query language
    org_id: str                   # Owning organization

@dataclass
class ExperimentConfig:
    """Main experiment configuration"""
    # Experiment identification
    experiment_name: str = "NeXos_Validation_Experiment"
    experiment_version: str = "1.0.0"
    
    # Organizations (Org_1, Org_2, ..., Org_n)
    num_organizations: int = 4
    
    # Databases (Db_1, Db_2, ..., Db_m)
    num_databases_per_org: int = 2
    
    # Data generation parameters
    records_per_source: int = 10000
    batch_size: int = 1000
    
    # Latency thresholds (τ_latency)
    latency_threshold_ms: float = 100.0  # Threshold for batch vs stream
    
    # Processing parameters
    num_partitions: int = 4  # k partitions for batch processing
    window_size_sec: float = 5.0  # W_t window size for stream processing
    
    # Security parameters
    max_security_level: int = 5  # L_max
    
    # Blockchain parameters
    blockchain_block_size: int = 100
    consensus_timeout_sec: float = 2.0
    
    # Microservices configuration
    target_utilization: float = 0.75  # η_target
    min_replicas: int = 1
    max_replicas: int = 10
    
    # Metrics collection
    metrics_interval_sec: float = 1.0
    
    # Output paths
    output_dir: str = "results"
    
    # Comparison with baseline
    run_baseline_comparison: bool = True
    baseline_iterations: int = 5
    nexos_iterations: int = 5

# =============================================================================
# Default Configuration Instance
# =============================================================================

DEFAULT_CONFIG = ExperimentConfig()

# Organization configurations
ORGANIZATIONS = [
    OrganizationConfig(
        org_id="Org_1",
        name="Healthcare Provider",
        memory_mb=2048,
        disk_gb=500,
        services=["patient_records", "lab_results", "imaging"]
    ),
    OrganizationConfig(
        org_id="Org_2",
        name="Financial Institution",
        memory_mb=4096,
        disk_gb=1000,
        services=["transactions", "accounts", "risk_analytics"]
    ),
    OrganizationConfig(
        org_id="Org_3",
        name="IoT Sensor Network",
        memory_mb=1024,
        disk_gb=200,
        services=["sensor_data", "alerts", "telemetry"]
    ),
    OrganizationConfig(
        org_id="Org_4",
        name="Government Agency",
        memory_mb=2048,
        disk_gb=750,
        services=["public_records", "compliance", "reporting"]
    ),
]

# Database configurations per organization
DATABASE_CONFIGS = [
    # Org_1 databases
    DatabaseConfig("Db_1", "Patient Records DB", DataType.STRUCTURED, 
                   "postgresql://org1:5432/patients", "SQL", "Org_1"),
    DatabaseConfig("Db_2", "Medical Documents", DataType.UNSTRUCTURED,
                   "mongodb://org1:27017/documents", "MQL", "Org_1"),
    # Org_2 databases
    DatabaseConfig("Db_3", "Transaction Ledger", DataType.STRUCTURED,
                   "postgresql://org2:5432/transactions", "SQL", "Org_2"),
    DatabaseConfig("Db_4", "Market Data Feed", DataType.SEMI_STRUCTURED,
                   "kafka://org2:9092/market_data", "KStreams", "Org_2"),
    # Org_3 databases
    DatabaseConfig("Db_5", "Sensor Time Series", DataType.STRUCTURED,
                   "timescaledb://org3:5432/sensors", "SQL", "Org_3"),
    DatabaseConfig("Db_6", "Event Stream", DataType.SEMI_STRUCTURED,
                   "kafka://org3:9092/events", "KStreams", "Org_3"),
    # Org_4 databases
    DatabaseConfig("Db_7", "Public Records", DataType.STRUCTURED,
                   "postgresql://org4:5432/records", "SQL", "Org_4"),
    DatabaseConfig("Db_8", "Document Archive", DataType.UNSTRUCTURED,
                   "elasticsearch://org4:9200/archive", "DSL", "Org_4"),
]

# Data classification taxonomy C
CLASSIFICATION_TAXONOMY = {
    "PII": {"security_level": SecurityLevel.CONFIDENTIAL, "retention_days": 365},
    "PHI": {"security_level": SecurityLevel.RESTRICTED, "retention_days": 2555},
    "FINANCIAL": {"security_level": SecurityLevel.CONFIDENTIAL, "retention_days": 1825},
    "PUBLIC": {"security_level": SecurityLevel.PUBLIC, "retention_days": -1},
    "INTERNAL": {"security_level": SecurityLevel.INTERNAL, "retention_days": 730},
    "TELEMETRY": {"security_level": SecurityLevel.INTERNAL, "retention_days": 90},
}
