"""
NeXos Core Processing Pipeline
==============================
Implements the core data processing components of the NeXos architecture:
- Data Generation Module (aggregation and normalization)
- Unified Data Service Manager
- Instruction Set Generator
- Batch/Stream Data Processors
"""

import json
import csv
import xml.etree.ElementTree as ET
import sqlite3
import hashlib
import time
import threading
import queue
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Generator
from dataclasses import dataclass, asdict, field
from enum import Enum
from abc import ABC, abstractmethod
import os
import sys
import uuid
import copy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    DataType, DataCategory, SecurityLevel, ProcessingMode,
    CLASSIFICATION_TAXONOMY, ExperimentConfig
)

# =============================================================================
# Unified Data Standard (UDS) - Core Data Model
# =============================================================================

@dataclass
class UnifiedDataRecord:
    """
    Unified Data Standard representation: u ∈ U
    All heterogeneous data is transformed into this canonical format.
    """
    # Core identification
    record_id: str                          # Unique identifier
    source_org: str                         # Org_i
    source_db: str                          # Db_k
    original_format: str                    # Original data format
    
    # Timestamp information
    ingestion_timestamp: str                # ts(u)
    source_timestamp: Optional[str] = None  # Original timestamp if available
    
    # Data payload (normalized)
    data_type: str = ""                     # T_k: structured/semi/unstructured
    category: str = ""                      # X_doc, X_rt, X_rel
    schema_version: str = "1.0"
    
    # Normalized payload as key-value pairs
    payload: Dict[str, Any] = field(default_factory=dict)
    
    # Computed fields
    payload_hash: str = ""                  # hash(u) = H(u)
    payload_size_bytes: int = 0

    def compute_hash(self) -> str:
        """Compute cryptographic hash H(u) for integrity verification"""
        payload_str = json.dumps(self.payload, sort_keys=True)
        self.payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()
        self.payload_size_bytes = len(payload_str.encode())
        return self.payload_hash


@dataclass
class InstructionSet:
    """
    Instruction Set IS(u) = ⟨src(u), cls(u), sec(u), ts(u), hash(u)⟩
    Metadata for governance and traceability.
    """
    record_id: str                          # Reference to UnifiedDataRecord
    source: Tuple[str, str]                 # src(u) = (Org_i, Db_k)
    classification: str                     # cls(u) ∈ C
    security_level: int                     # sec(u) ∈ {1, ..., L_max}
    timestamp: str                          # ts(u)
    content_hash: str                       # hash(u)
    
    # Additional governance metadata
    retention_days: int = -1
    requires_encryption: bool = False
    audit_required: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "source_org": self.source[0],
            "source_db": self.source[1],
            "classification": self.classification,
            "security_level": self.security_level,
            "timestamp": self.timestamp,
            "content_hash": self.content_hash,
            "retention_days": self.retention_days,
            "requires_encryption": self.requires_encryption,
            "audit_required": self.audit_required
        }

# =============================================================================
# Data Parsers - Format-Specific Readers
# =============================================================================

class BaseParser(ABC):
    """Abstract base parser for heterogeneous data sources"""
    
    @abstractmethod
    def parse(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        """Parse file and yield individual records"""
        pass
    
    @abstractmethod
    def get_format(self) -> str:
        """Return format identifier"""
        pass


class CSVParser(BaseParser):
    """Parser for CSV files (structured data)"""
    
    def parse(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                yield dict(row)
    
    def get_format(self) -> str:
        return "CSV"


class JSONParser(BaseParser):
    """Parser for JSON files (semi-structured data)"""
    
    def parse(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    yield item
            else:
                yield data
    
    def get_format(self) -> str:
        return "JSON"


class NDJSONParser(BaseParser):
    """Parser for newline-delimited JSON (Kafka export format)"""
    
    def parse(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    yield json.loads(line)
    
    def get_format(self) -> str:
        return "NDJSON"


class XMLParser(BaseParser):
    """Parser for XML files (semi-structured/document data)"""
    
    def parse(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        for record in root:
            yield self._element_to_dict(record)
    
    def _element_to_dict(self, element: ET.Element) -> Dict[str, Any]:
        """Recursively convert XML element to dictionary"""
        result = {}
        
        # Add attributes
        if element.attrib:
            result["@attributes"] = dict(element.attrib)
        
        # Add child elements
        for child in element:
            child_data = self._element_to_dict(child)
            tag = child.tag.split('}')[-1]  # Remove namespace
            
            if tag in result:
                if not isinstance(result[tag], list):
                    result[tag] = [result[tag]]
                result[tag].append(child_data)
            else:
                result[tag] = child_data
        
        # Add text content
        if element.text and element.text.strip():
            if result:
                result["#text"] = element.text.strip()
            else:
                return element.text.strip()
        
        return result
    
    def get_format(self) -> str:
        return "XML"


class SQLiteParser(BaseParser):
    """Parser for SQLite databases (structured relational data)"""
    
    def __init__(self, tables: Optional[List[str]] = None):
        self.tables = tables
    
    def parse(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        conn = sqlite3.connect(file_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get tables if not specified
        if not self.tables:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            self.tables = [row[0] for row in cursor.fetchall()]
        
        for table in self.tables:
            cursor.execute(f"SELECT * FROM {table}")
            columns = [description[0] for description in cursor.description]
            
            for row in cursor:
                record = dict(zip(columns, row))
                record["_table"] = table
                yield record
        
        conn.close()
    
    def get_format(self) -> str:
        return "SQLite"

# =============================================================================
# Data Generation Module - Aggregation and Transformation
# =============================================================================

class DataGenerationModule:
    """
    Data Generation Module G
    Implements: F: X → U (format unification function)
    Transforms heterogeneous data into Unified Data Standard.
    """
    
    def __init__(self, config: Optional[ExperimentConfig] = None):
        self.config = config or ExperimentConfig()
        self.parsers = {
            ".csv": CSVParser(),
            ".json": JSONParser(),
            ".ndjson": NDJSONParser(),
            ".xml": XMLParser(),
            ".db": SQLiteParser()
        }
        self.processing_stats = {
            "records_processed": 0,
            "bytes_processed": 0,
            "transformation_time_ms": 0,
            "errors": 0,
            "by_source": {}
        }
    
    def _get_parser(self, file_path: str) -> BaseParser:
        """Get appropriate parser based on file extension"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.parsers:
            raise ValueError(f"Unsupported file format: {ext}")
        return self.parsers[ext]
    
    def _infer_category(self, file_path: str, record: Dict[str, Any]) -> str:
        """Infer data category: X_doc, X_rt, or X_rel"""
        filename = os.path.basename(file_path).lower()
        
        if "event" in filename or "stream" in filename or "kafka" in filename:
            return DataCategory.REAL_TIME.value
        elif "document" in filename or "archive" in filename:
            return DataCategory.DOCUMENT.value
        elif "market" in filename and "timestamp" in str(record.keys()).lower():
            return DataCategory.REAL_TIME.value
        else:
            return DataCategory.RELATIONAL.value
    
    def _infer_data_type(self, file_path: str) -> str:
        """Infer data type taxonomy"""
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in [".csv", ".db"]:
            return DataType.STRUCTURED.value
        elif ext in [".json", ".ndjson", ".xml"]:
            return DataType.SEMI_STRUCTURED.value
        else:
            return DataType.UNSTRUCTURED.value
    
    def _extract_source_info(self, file_path: str) -> Tuple[str, str]:
        """Extract source organization and database from filename"""
        filename = os.path.basename(file_path)
        parts = filename.split("_")
        
        org_id = "Unknown"
        db_id = "Unknown"
        
        for part in parts:
            if part.lower().startswith("org"):
                org_id = part.capitalize()
                break
        
        # Infer db_id based on content type
        if "patient" in filename.lower():
            db_id = "Db_1"
        elif "medical" in filename.lower() or "document" in filename.lower():
            db_id = "Db_2"
        elif "transaction" in filename.lower():
            db_id = "Db_3"
        elif "market" in filename.lower():
            db_id = "Db_4"
        elif "sensor" in filename.lower():
            db_id = "Db_5"
        elif "event" in filename.lower() or "stream" in filename.lower():
            db_id = "Db_6"
        elif "public" in filename.lower() or "records.db" in filename.lower():
            db_id = "Db_7"
        elif "archive" in filename.lower():
            db_id = "Db_8"
        
        return (org_id, db_id)
    
    def transform(self, file_path: str) -> Generator[UnifiedDataRecord, None, None]:
        """
        Apply transformation F(x) = π_U ∘ σ_schema ∘ η_normalize(x)
        Transforms raw records to Unified Data Standard.
        """
        start_time = time.time()
        parser = self._get_parser(file_path)
        source_org, source_db = self._extract_source_info(file_path)
        data_type = self._infer_data_type(file_path)
        original_format = parser.get_format()
        
        record_count = 0
        bytes_count = 0
        
        for raw_record in parser.parse(file_path):
            try:
                # η_normalize: Normalize data types
                normalized = self._normalize_record(raw_record)
                
                # σ_schema: Apply schema alignment
                aligned = self._align_schema(normalized, source_db)
                
                # π_U: Project onto unified representation
                unified = UnifiedDataRecord(
                    record_id=str(uuid.uuid4()),
                    source_org=source_org,
                    source_db=source_db,
                    original_format=original_format,
                    ingestion_timestamp=datetime.now().isoformat(),
                    source_timestamp=self._extract_timestamp(raw_record),
                    data_type=data_type,
                    category=self._infer_category(file_path, raw_record),
                    payload=aligned
                )
                
                # Compute integrity hash
                unified.compute_hash()
                
                record_count += 1
                bytes_count += unified.payload_size_bytes
                
                yield unified
                
            except Exception as e:
                self.processing_stats["errors"] += 1
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Update stats
        self.processing_stats["records_processed"] += record_count
        self.processing_stats["bytes_processed"] += bytes_count
        self.processing_stats["transformation_time_ms"] += elapsed_ms
        
        source_key = f"{source_org}/{source_db}"
        if source_key not in self.processing_stats["by_source"]:
            self.processing_stats["by_source"][source_key] = {
                "records": 0, "bytes": 0, "time_ms": 0
            }
        self.processing_stats["by_source"][source_key]["records"] += record_count
        self.processing_stats["by_source"][source_key]["bytes"] += bytes_count
        self.processing_stats["by_source"][source_key]["time_ms"] += elapsed_ms
    
    def _normalize_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """η_normalize: Normalize data types and formats"""
        normalized = {}
        
        for key, value in record.items():
            # Normalize key names (lowercase, underscore)
            norm_key = key.lower().replace(" ", "_").replace("-", "_")
            
            # Normalize values
            if value is None:
                normalized[norm_key] = None
            elif isinstance(value, (dict, list)):
                normalized[norm_key] = value  # Keep complex types
            elif isinstance(value, bool):
                normalized[norm_key] = value
            elif isinstance(value, (int, float)):
                normalized[norm_key] = value
            else:
                # Convert to string and check for special formats
                str_val = str(value).strip()
                
                # Try to parse as number
                try:
                    if '.' in str_val:
                        normalized[norm_key] = float(str_val)
                    else:
                        normalized[norm_key] = int(str_val)
                except ValueError:
                    normalized[norm_key] = str_val
        
        return normalized
    
    def _align_schema(self, record: Dict[str, Any], source_db: str) -> Dict[str, Any]:
        """σ_schema: Apply schema alignment to unified model"""
        # Standard field mappings for common attributes
        field_mappings = {
            "id": "entity_id",
            "timestamp": "event_time",
            "created_at": "creation_time",
            "updated_at": "modification_time",
            "name": "entity_name",
            "type": "entity_type"
        }
        
        aligned = {}
        for key, value in record.items():
            mapped_key = field_mappings.get(key, key)
            aligned[mapped_key] = value
        
        # Add source metadata
        aligned["_source_db"] = source_db
        
        return aligned
    
    def _extract_timestamp(self, record: Dict[str, Any]) -> Optional[str]:
        """Extract timestamp from record if available"""
        timestamp_fields = ["timestamp", "created_at", "date", "time", 
                          "event_time", "ingestion_time", "ts"]
        
        for field in timestamp_fields:
            for key in record.keys():
                if field in key.lower():
                    return str(record[key])
        
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Return processing statistics"""
        stats = self.processing_stats.copy()
        if stats["transformation_time_ms"] > 0:
            stats["throughput_records_per_sec"] = (
                stats["records_processed"] / (stats["transformation_time_ms"] / 1000)
            )
            stats["throughput_bytes_per_sec"] = (
                stats["bytes_processed"] / (stats["transformation_time_ms"] / 1000)
            )
        return stats

# =============================================================================
# Instruction Set Generator - Classification and Metadata
# =============================================================================

class InstructionSetGenerator:
    """
    Generates Instruction Set IS(u) for each unified record.
    Implements classification and security level assignment.
    """
    
    def __init__(self, taxonomy: Dict[str, Any] = None):
        self.taxonomy = taxonomy or CLASSIFICATION_TAXONOMY
        self.classification_stats = {
            "total_classified": 0,
            "by_classification": {},
            "by_security_level": {}
        }
    
    def generate(self, record: UnifiedDataRecord) -> InstructionSet:
        """
        Generate IS(u) = ⟨src(u), cls(u), sec(u), ts(u), hash(u)⟩
        """
        # Determine classification based on content analysis
        classification = self._classify_content(record)
        
        # Compute security level: sec(u) = max(sec_content, sec_source, sec_policy)
        security_level = self._compute_security_level(record, classification)
        
        # Get retention and encryption requirements
        cls_config = self.taxonomy.get(classification, {})
        
        instruction_set = InstructionSet(
            record_id=record.record_id,
            source=(record.source_org, record.source_db),
            classification=classification,
            security_level=security_level,
            timestamp=record.ingestion_timestamp,
            content_hash=record.payload_hash,
            retention_days=cls_config.get("retention_days", -1),
            requires_encryption=security_level >= SecurityLevel.CONFIDENTIAL.value,
            audit_required=security_level >= SecurityLevel.INTERNAL.value
        )
        
        # Update stats
        self.classification_stats["total_classified"] += 1
        self.classification_stats["by_classification"][classification] = \
            self.classification_stats["by_classification"].get(classification, 0) + 1
        self.classification_stats["by_security_level"][security_level] = \
            self.classification_stats["by_security_level"].get(security_level, 0) + 1
        
        return instruction_set
    
    def _classify_content(self, record: UnifiedDataRecord) -> str:
        """
        cls(u) = argmax_{c ∈ C} P(c | features(u))
        Simple rule-based classification for demonstration.
        """
        payload_str = json.dumps(record.payload).lower()
        
        # PII indicators
        pii_keywords = ["ssn", "social_security", "birth", "address", "name"]
        if any(kw in payload_str for kw in pii_keywords):
            if record.source_org == "Org_1":  # Healthcare
                return "PHI"
            return "PII"
        
        # Financial indicators
        fin_keywords = ["transaction", "account", "amount", "payment", "balance"]
        if any(kw in payload_str for kw in fin_keywords):
            return "FINANCIAL"
        
        # Telemetry/IoT
        telemetry_keywords = ["sensor", "temperature", "humidity", "device", "signal"]
        if any(kw in payload_str for kw in telemetry_keywords):
            return "TELEMETRY"
        
        # Public records
        if record.source_org == "Org_4":
            if "public" in payload_str or "fouo" not in payload_str:
                return "PUBLIC"
            return "INTERNAL"
        
        return "INTERNAL"
    
    def _compute_security_level(self, record: UnifiedDataRecord, 
                                 classification: str) -> int:
        """
        sec(u) = max(sec_content(u), sec_source(u), sec_policy(u))
        """
        # sec_content: from classification
        cls_config = self.taxonomy.get(classification, {})
        sec_content = cls_config.get("security_level", SecurityLevel.INTERNAL).value \
            if isinstance(cls_config.get("security_level"), SecurityLevel) \
            else cls_config.get("security_level", SecurityLevel.INTERNAL).value
        
        # sec_source: based on source organization
        org_security = {
            "Org_1": SecurityLevel.CONFIDENTIAL.value,  # Healthcare
            "Org_2": SecurityLevel.CONFIDENTIAL.value,  # Financial
            "Org_3": SecurityLevel.INTERNAL.value,      # IoT
            "Org_4": SecurityLevel.INTERNAL.value       # Government
        }
        sec_source = org_security.get(record.source_org, SecurityLevel.INTERNAL.value)
        
        # sec_policy: default policy level
        sec_policy = SecurityLevel.INTERNAL.value
        
        return max(sec_content, sec_source, sec_policy)
    
    def get_stats(self) -> Dict[str, Any]:
        """Return classification statistics"""
        return self.classification_stats.copy()

# =============================================================================
# Batch Data Processor
# =============================================================================

class BatchDataProcessor:
    """
    Implements batch processing with partitioning:
    BatchProcess(X_batch) = ⊕_{i=1}^{k} Process(π_i(X_batch))
    """
    
    def __init__(self, num_partitions: int = 4):
        self.num_partitions = num_partitions
        self.processing_stats = {
            "batches_processed": 0,
            "records_processed": 0,
            "total_time_ms": 0,
            "partition_times_ms": []
        }
    
    def process(self, records: List[UnifiedDataRecord], 
                aggregator: callable = None) -> Dict[str, Any]:
        """
        Process batch with partitioning strategy π
        """
        start_time = time.time()
        
        # Partition records: π_i(X_batch)
        partitions = self._partition(records)
        
        # Process each partition
        partition_results = []
        for i, partition in enumerate(partitions):
            part_start = time.time()
            result = self._process_partition(partition, i)
            part_time = (time.time() - part_start) * 1000
            
            partition_results.append(result)
            self.processing_stats["partition_times_ms"].append(part_time)
        
        # Aggregate results: ⊕
        if aggregator:
            final_result = aggregator(partition_results)
        else:
            final_result = self._default_aggregate(partition_results)
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        self.processing_stats["batches_processed"] += 1
        self.processing_stats["records_processed"] += len(records)
        self.processing_stats["total_time_ms"] += elapsed_ms
        
        return {
            "result": final_result,
            "num_partitions": len(partitions),
            "records_processed": len(records),
            "processing_time_ms": elapsed_ms,
            "partition_times_ms": self.processing_stats["partition_times_ms"][-self.num_partitions:]
        }
    
    def _partition(self, records: List[UnifiedDataRecord]) -> List[List[UnifiedDataRecord]]:
        """
        Partition strategy satisfying:
        ∪_{i=1}^{k} π_i(X) = X and ∀i≠j: π_i(X) ∩ π_j(X) = ∅
        """
        partitions = [[] for _ in range(self.num_partitions)]
        
        for i, record in enumerate(records):
            partition_idx = i % self.num_partitions
            partitions[partition_idx].append(record)
        
        return partitions
    
    def _process_partition(self, partition: List[UnifiedDataRecord], 
                           partition_id: int) -> Dict[str, Any]:
        """Process individual partition"""
        if not partition:
            return {"partition_id": partition_id, "count": 0, "aggregates": {}}
        
        # Compute partition statistics
        categories = {}
        data_types = {}
        sources = {}
        
        for record in partition:
            categories[record.category] = categories.get(record.category, 0) + 1
            data_types[record.data_type] = data_types.get(record.data_type, 0) + 1
            src = f"{record.source_org}/{record.source_db}"
            sources[src] = sources.get(src, 0) + 1
        
        return {
            "partition_id": partition_id,
            "count": len(partition),
            "aggregates": {
                "by_category": categories,
                "by_data_type": data_types,
                "by_source": sources
            }
        }
    
    def _default_aggregate(self, partition_results: List[Dict]) -> Dict[str, Any]:
        """Default aggregation operator ⊕"""
        total_count = sum(p["count"] for p in partition_results)
        
        # Merge aggregates
        merged = {
            "by_category": {},
            "by_data_type": {},
            "by_source": {}
        }
        
        for result in partition_results:
            for key in merged:
                for k, v in result["aggregates"].get(key, {}).items():
                    merged[key][k] = merged[key].get(k, 0) + v
        
        return {
            "total_records": total_count,
            "aggregates": merged
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Return processing statistics"""
        stats = self.processing_stats.copy()
        if stats["total_time_ms"] > 0:
            stats["avg_partition_time_ms"] = (
                sum(stats["partition_times_ms"]) / len(stats["partition_times_ms"])
                if stats["partition_times_ms"] else 0
            )
            stats["throughput_records_per_sec"] = (
                stats["records_processed"] / (stats["total_time_ms"] / 1000)
            )
        return stats

# =============================================================================
# Stream Data Processor
# =============================================================================

class StreamDataProcessor:
    """
    Implements stream processing with windowing:
    StreamProcess(X_rt, W) = ∪_t Aggregate({x ∈ X_rt : ts(x) ∈ W_t})
    """
    
    def __init__(self, window_size_sec: float = 5.0, window_type: str = "tumbling"):
        self.window_size_sec = window_size_sec
        self.window_type = window_type
        self.windows = {}
        self.processing_stats = {
            "windows_processed": 0,
            "records_processed": 0,
            "total_time_ms": 0
        }
    
    def process_record(self, record: UnifiedDataRecord) -> Optional[Dict[str, Any]]:
        """Process single record in streaming mode"""
        # Determine window
        if record.source_timestamp:
            try:
                ts = datetime.fromisoformat(record.source_timestamp.replace('Z', '+00:00'))
            except:
                ts = datetime.now()
        else:
            ts = datetime.now()
        
        window_id = self._get_window_id(ts)
        
        # Add to window
        if window_id not in self.windows:
            self.windows[window_id] = {
                "records": [],
                "start_time": ts,
                "count": 0
            }
        
        self.windows[window_id]["records"].append(record)
        self.windows[window_id]["count"] += 1
        
        # Check for window completion
        completed = self._check_window_completion()
        
        self.processing_stats["records_processed"] += 1
        
        return completed
    
    def _get_window_id(self, timestamp: datetime) -> str:
        """Get window identifier for timestamp"""
        if self.window_type == "tumbling":
            window_num = int(timestamp.timestamp() / self.window_size_sec)
            return f"window_{window_num}"
        else:
            # Sliding window - simplified implementation
            return f"window_{int(timestamp.timestamp())}"
    
    def _check_window_completion(self) -> Optional[Dict[str, Any]]:
        """Check if any windows are complete and should be emitted"""
        current_time = datetime.now()
        completed_windows = []
        
        for window_id, window_data in list(self.windows.items()):
            window_age = (current_time - window_data["start_time"]).total_seconds()
            
            if window_age >= self.window_size_sec:
                result = self._aggregate_window(window_id, window_data)
                completed_windows.append(result)
                del self.windows[window_id]
                self.processing_stats["windows_processed"] += 1
        
        return completed_windows if completed_windows else None
    
    def _aggregate_window(self, window_id: str, 
                          window_data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggregate records within a window"""
        records = window_data["records"]
        
        return {
            "window_id": window_id,
            "record_count": len(records),
            "window_start": window_data["start_time"].isoformat(),
            "aggregates": {
                "by_source": self._count_by_field(records, "source_org"),
                "by_category": self._count_by_field(records, "category")
            }
        }
    
    def _count_by_field(self, records: List[UnifiedDataRecord], 
                        field: str) -> Dict[str, int]:
        """Count records by field value"""
        counts = {}
        for record in records:
            value = getattr(record, field, "unknown")
            counts[value] = counts.get(value, 0) + 1
        return counts
    
    def flush(self) -> List[Dict[str, Any]]:
        """Flush all remaining windows"""
        results = []
        for window_id, window_data in self.windows.items():
            results.append(self._aggregate_window(window_id, window_data))
            self.processing_stats["windows_processed"] += 1
        self.windows = {}
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Return processing statistics"""
        return self.processing_stats.copy()

# =============================================================================
# Unified Data Service Manager
# =============================================================================

class UnifiedDataServiceManager:
    """
    Central coordinator for the NeXos data processing pipeline.
    Manages the flow from heterogeneous sources to unified output.
    """
    
    def __init__(self, config: Optional[ExperimentConfig] = None):
        self.config = config or ExperimentConfig()
        
        # Initialize components
        self.data_generator = DataGenerationModule(config)
        self.instruction_generator = InstructionSetGenerator()
        self.batch_processor = BatchDataProcessor(
            num_partitions=self.config.num_partitions
        )
        self.stream_processor = StreamDataProcessor(
            window_size_sec=self.config.window_size_sec
        )
        
        # Storage for processed data
        self.unified_records: List[UnifiedDataRecord] = []
        self.instruction_sets: List[InstructionSet] = []
        
        # Overall statistics
        self.pipeline_stats = {
            "sources_processed": 0,
            "total_records": 0,
            "total_processing_time_ms": 0,
            "stages": {}
        }
    
    def process_source(self, file_path: str, 
                       mode: ProcessingMode = ProcessingMode.BATCH) -> Dict[str, Any]:
        """Process a single data source through the complete pipeline"""
        start_time = time.time()
        source_records = []
        source_instructions = []
        
        # Stage 1: Data Generation Module - Transform to UDS
        stage1_start = time.time()
        for unified_record in self.data_generator.transform(file_path):
            source_records.append(unified_record)
            
            # Stage 2: Generate Instruction Set
            instruction_set = self.instruction_generator.generate(unified_record)
            source_instructions.append(instruction_set)
        
        stage1_time = (time.time() - stage1_start) * 1000
        
        # Stage 3: Process based on mode
        stage3_start = time.time()
        if mode == ProcessingMode.BATCH:
            processing_result = self.batch_processor.process(source_records)
        else:
            # Stream processing
            for record in source_records:
                self.stream_processor.process_record(record)
            processing_result = {"windows": self.stream_processor.flush()}
        
        stage3_time = (time.time() - stage3_start) * 1000
        
        # Store results
        self.unified_records.extend(source_records)
        self.instruction_sets.extend(source_instructions)
        
        total_time = (time.time() - start_time) * 1000
        
        # Update stats
        self.pipeline_stats["sources_processed"] += 1
        self.pipeline_stats["total_records"] += len(source_records)
        self.pipeline_stats["total_processing_time_ms"] += total_time
        
        return {
            "source": file_path,
            "mode": mode.value,
            "records_processed": len(source_records),
            "total_time_ms": total_time,
            "stage_times_ms": {
                "transformation": stage1_time,
                "processing": stage3_time
            },
            "processing_result": processing_result
        }
    
    def process_all_sources(self, source_files: List[str]) -> Dict[str, Any]:
        """Process multiple sources"""
        results = []
        
        for file_path in source_files:
            # Determine processing mode based on data category
            filename = os.path.basename(file_path).lower()
            if "stream" in filename or "event" in filename or "kafka" in filename:
                mode = ProcessingMode.STREAM
            else:
                mode = ProcessingMode.BATCH
            
            result = self.process_source(file_path, mode)
            results.append(result)
        
        return {
            "sources_processed": len(results),
            "total_records": self.pipeline_stats["total_records"],
            "total_time_ms": self.pipeline_stats["total_processing_time_ms"],
            "source_results": results
        }
    
    def export_unified_data(self, output_path: str) -> Dict[str, Any]:
        """Export all unified data to JSON file"""
        start_time = time.time()
        
        export_data = {
            "metadata": {
                "export_timestamp": datetime.now().isoformat(),
                "total_records": len(self.unified_records),
                "schema_version": "1.0"
            },
            "records": [
                {
                    "unified_record": asdict(record),
                    "instruction_set": self.instruction_sets[i].to_dict()
                }
                for i, record in enumerate(self.unified_records)
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        export_time = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        return {
            "output_path": output_path,
            "records_exported": len(self.unified_records),
            "file_size_bytes": file_size,
            "export_time_ms": export_time
        }
    
    def get_comprehensive_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics from all components"""
        return {
            "pipeline": self.pipeline_stats,
            "data_generation": self.data_generator.get_stats(),
            "classification": self.instruction_generator.get_stats(),
            "batch_processing": self.batch_processor.get_stats(),
            "stream_processing": self.stream_processor.get_stats()
        }


if __name__ == "__main__":
    # Test the processing pipeline
    manager = UnifiedDataServiceManager()
    
    # Process test file
    test_file = "data/raw/org1_patient_records.csv"
    if os.path.exists(test_file):
        result = manager.process_source(test_file)
        print(json.dumps(result, indent=2, default=str))
