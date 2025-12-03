"""
NeXos Data Generators
=====================
Generates heterogeneous data in multiple formats to simulate
data from Db_1, Db_2, ..., Db_m across organizations.
"""

import csv
import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
import random
import string
import time
import hashlib
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Any, Generator, Tuple
from dataclasses import dataclass, asdict
import threading
import queue
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    DataType, DataCategory, SecurityLevel, 
    ORGANIZATIONS, DATABASE_CONFIGS
)

# =============================================================================
# Data Models
# =============================================================================

@dataclass
class PatientRecord:
    """Structured data model for healthcare (Org_1)"""
    patient_id: str
    name: str
    dob: str
    diagnosis_code: str
    admission_date: str
    department: str
    physician_id: str
    insurance_id: str
    
@dataclass
class FinancialTransaction:
    """Structured data model for financial institution (Org_2)"""
    transaction_id: str
    account_id: str
    timestamp: str
    amount: float
    currency: str
    transaction_type: str
    merchant_id: str
    status: str

@dataclass
class SensorReading:
    """Time-series data model for IoT (Org_3)"""
    sensor_id: str
    timestamp: str
    temperature: float
    humidity: float
    pressure: float
    location: str
    battery_level: float
    signal_strength: int

@dataclass
class PublicRecord:
    """Document data model for government (Org_4)"""
    record_id: str
    record_type: str
    title: str
    content: str
    created_date: str
    department: str
    classification: str
    keywords: List[str]

# =============================================================================
# Base Generator Class
# =============================================================================

class BaseDataGenerator:
    """Base class for all data generators"""
    
    def __init__(self, org_id: str, db_id: str, seed: int = 42):
        self.org_id = org_id
        self.db_id = db_id
        self.seed = seed
        random.seed(seed)
        self.generation_stats = {
            "records_generated": 0,
            "bytes_generated": 0,
            "generation_time_ms": 0,
            "errors": 0
        }
    
    def _generate_id(self, prefix: str) -> str:
        """Generate unique identifier"""
        return f"{prefix}_{hashlib.md5(str(random.random()).encode()).hexdigest()[:12]}"
    
    def _random_date(self, start_year: int = 2020, end_year: int = 2024) -> str:
        """Generate random date string"""
        start = datetime(start_year, 1, 1)
        end = datetime(end_year, 12, 31)
        delta = end - start
        random_days = random.randint(0, delta.days)
        return (start + timedelta(days=random_days)).strftime("%Y-%m-%d %H:%M:%S")
    
    def _random_string(self, length: int = 10) -> str:
        """Generate random alphanumeric string"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    
    def get_stats(self) -> Dict[str, Any]:
        """Return generation statistics"""
        return self.generation_stats.copy()

# =============================================================================
# CSV Generator (Structured Data - X_rel)
# =============================================================================

class CSVDataGenerator(BaseDataGenerator):
    """
    Generates CSV data simulating relational databases.
    Maps to: Db_1 (Patient Records), Db_3 (Transactions), Db_5 (Sensors), Db_7 (Public Records)
    """
    
    def generate_patient_records(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate patient records CSV (Org_1, Db_1)"""
        start_time = time.time()
        
        departments = ["Cardiology", "Neurology", "Oncology", "Pediatrics", "Emergency"]
        
        records = []
        for _ in range(count):
            record = PatientRecord(
                patient_id=self._generate_id("PAT"),
                name=f"{self._random_string(8)} {self._random_string(10)}",
                dob=self._random_date(1940, 2010),
                diagnosis_code=f"ICD-{random.randint(100, 999)}.{random.randint(0, 9)}",
                admission_date=self._random_date(2023, 2024),
                department=random.choice(departments),
                physician_id=self._generate_id("PHY"),
                insurance_id=self._generate_id("INS")
            )
            records.append(asdict(record))
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "CSV",
            "data_type": DataType.STRUCTURED.value,
            "category": DataCategory.RELATIONAL.value,
            "record_count": count,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }
    
    def generate_financial_transactions(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate financial transactions CSV (Org_2, Db_3)"""
        start_time = time.time()
        
        transaction_types = ["DEBIT", "CREDIT", "TRANSFER", "PAYMENT", "REFUND"]
        currencies = ["USD", "EUR", "GBP", "JPY", "CNY"]
        statuses = ["COMPLETED", "PENDING", "FAILED", "CANCELLED"]
        
        records = []
        for _ in range(count):
            record = FinancialTransaction(
                transaction_id=self._generate_id("TXN"),
                account_id=self._generate_id("ACC"),
                timestamp=self._random_date(2024, 2024),
                amount=round(random.uniform(10, 50000), 2),
                currency=random.choice(currencies),
                transaction_type=random.choice(transaction_types),
                merchant_id=self._generate_id("MER"),
                status=random.choice(statuses)
            )
            records.append(asdict(record))
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "CSV",
            "data_type": DataType.STRUCTURED.value,
            "category": DataCategory.RELATIONAL.value,
            "record_count": count,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }
    
    def generate_sensor_readings(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate sensor time-series CSV (Org_3, Db_5)"""
        start_time = time.time()
        
        locations = ["Building_A", "Building_B", "Warehouse_1", "Factory_Floor", "Outdoor"]
        
        records = []
        base_time = datetime.now()
        for i in range(count):
            timestamp = (base_time - timedelta(seconds=i*5)).strftime("%Y-%m-%d %H:%M:%S")
            record = SensorReading(
                sensor_id=f"SENSOR_{random.randint(1, 100):03d}",
                timestamp=timestamp,
                temperature=round(random.uniform(-10, 45), 2),
                humidity=round(random.uniform(20, 95), 2),
                pressure=round(random.uniform(980, 1040), 2),
                location=random.choice(locations),
                battery_level=round(random.uniform(0, 100), 1),
                signal_strength=random.randint(-100, -30)
            )
            records.append(asdict(record))
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "CSV",
            "data_type": DataType.STRUCTURED.value,
            "category": DataCategory.REAL_TIME.value,
            "record_count": count,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }

# =============================================================================
# JSON Generator (Semi-Structured Data - X_doc / X_rt)
# =============================================================================

class JSONDataGenerator(BaseDataGenerator):
    """
    Generates JSON data simulating document stores and API responses.
    Maps to: Db_2 (Medical Documents), Db_4 (Market Data)
    """
    
    def generate_medical_documents(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate medical documents JSON (Org_1, Db_2)"""
        start_time = time.time()
        
        document_types = ["Lab Report", "Radiology Report", "Discharge Summary", 
                         "Progress Note", "Consultation"]
        
        documents = []
        for _ in range(count):
            doc = {
                "document_id": self._generate_id("DOC"),
                "patient_id": self._generate_id("PAT"),
                "document_type": random.choice(document_types),
                "created_at": self._random_date(2023, 2024),
                "author": {
                    "physician_id": self._generate_id("PHY"),
                    "name": f"Dr. {self._random_string(8)}",
                    "specialty": random.choice(["Internal Medicine", "Surgery", "Radiology"])
                },
                "content": {
                    "findings": self._random_string(200),
                    "impression": self._random_string(100),
                    "recommendations": [self._random_string(50) for _ in range(3)]
                },
                "metadata": {
                    "version": random.randint(1, 5),
                    "status": random.choice(["DRAFT", "FINAL", "AMENDED"]),
                    "confidentiality": random.choice(["NORMAL", "RESTRICTED", "VIP"])
                },
                "attachments": [
                    {"name": f"attachment_{i}.pdf", "size_kb": random.randint(100, 5000)}
                    for i in range(random.randint(0, 3))
                ]
            }
            documents.append(doc)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(documents, f, indent=2)
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "JSON",
            "data_type": DataType.SEMI_STRUCTURED.value,
            "category": DataCategory.DOCUMENT.value,
            "record_count": count,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }
    
    def generate_market_data(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate market data feed JSON (Org_2, Db_4)"""
        start_time = time.time()
        
        symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "TSLA", "BRK.A"]
        exchanges = ["NYSE", "NASDAQ", "LSE", "TSE"]
        
        market_events = []
        base_time = datetime.now()
        
        for i in range(count):
            timestamp = (base_time - timedelta(milliseconds=i*100)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            symbol = random.choice(symbols)
            base_price = random.uniform(50, 500)
            
            event = {
                "event_id": self._generate_id("MKT"),
                "timestamp": timestamp,
                "symbol": symbol,
                "exchange": random.choice(exchanges),
                "event_type": random.choice(["TRADE", "QUOTE", "ORDER"]),
                "data": {
                    "price": round(base_price, 2),
                    "bid": round(base_price * 0.999, 2),
                    "ask": round(base_price * 1.001, 2),
                    "volume": random.randint(100, 100000),
                    "vwap": round(base_price * random.uniform(0.98, 1.02), 2)
                },
                "source": {
                    "feed_id": f"FEED_{random.randint(1, 10)}",
                    "latency_us": random.randint(10, 1000)
                }
            }
            market_events.append(event)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(market_events, f, indent=2)
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "JSON",
            "data_type": DataType.SEMI_STRUCTURED.value,
            "category": DataCategory.REAL_TIME.value,
            "record_count": count,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }

# =============================================================================
# XML Generator (Semi-Structured/Unstructured Data)
# =============================================================================

class XMLDataGenerator(BaseDataGenerator):
    """
    Generates XML data simulating document archives and legacy systems.
    Maps to: Db_8 (Document Archive)
    """
    
    def generate_public_records(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate public records XML (Org_4, Db_8)"""
        start_time = time.time()
        
        record_types = ["Birth Certificate", "Property Deed", "Business License",
                       "Court Filing", "Tax Record", "Permit"]
        departments = ["Vital Records", "Property", "Business Services", "Courts", "Treasury"]
        classifications = ["PUBLIC", "FOUO", "RESTRICTED"]
        
        root = ET.Element("PublicRecordsArchive")
        root.set("xmlns", "http://nexos.gov/schema/records")
        root.set("version", "1.0")
        root.set("generated", datetime.now().isoformat())
        
        for _ in range(count):
            record = ET.SubElement(root, "Record")
            record.set("id", self._generate_id("REC"))
            
            ET.SubElement(record, "RecordType").text = random.choice(record_types)
            ET.SubElement(record, "Title").text = f"Record: {self._random_string(20)}"
            ET.SubElement(record, "CreatedDate").text = self._random_date(2010, 2024)
            ET.SubElement(record, "Department").text = random.choice(departments)
            ET.SubElement(record, "Classification").text = random.choice(classifications)
            
            content = ET.SubElement(record, "Content")
            ET.SubElement(content, "Summary").text = self._random_string(150)
            ET.SubElement(content, "Body").text = self._random_string(500)
            
            metadata = ET.SubElement(record, "Metadata")
            ET.SubElement(metadata, "FileNumber").text = f"FN-{random.randint(100000, 999999)}"
            ET.SubElement(metadata, "PageCount").text = str(random.randint(1, 50))
            ET.SubElement(metadata, "RetentionYears").text = str(random.randint(5, 100))
            
            keywords = ET.SubElement(record, "Keywords")
            for kw in [self._random_string(8) for _ in range(random.randint(2, 6))]:
                ET.SubElement(keywords, "Keyword").text = kw
            
            audit = ET.SubElement(record, "AuditTrail")
            for j in range(random.randint(1, 5)):
                entry = ET.SubElement(audit, "Entry")
                entry.set("timestamp", self._random_date(2020, 2024))
                entry.set("action", random.choice(["CREATED", "VIEWED", "MODIFIED", "EXPORTED"]))
                entry.set("user", self._generate_id("USR"))
        
        # Pretty print XML
        xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(xml_str)
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "XML",
            "data_type": DataType.SEMI_STRUCTURED.value,
            "category": DataCategory.DOCUMENT.value,
            "record_count": count,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }

# =============================================================================
# SQL/SQLite Generator (Structured Relational Data)
# =============================================================================

class SQLDataGenerator(BaseDataGenerator):
    """
    Generates SQLite database simulating OLTP systems.
    Maps to: Db_1, Db_3, Db_5, Db_7 (relational databases)
    """
    
    def generate_relational_database(self, count: int, output_path: str) -> Dict[str, Any]:
        """Generate SQLite database with multiple tables (Org_4, Db_7)"""
        start_time = time.time()
        
        # Remove existing database to start fresh
        if os.path.exists(output_path):
            os.remove(output_path)
        
        conn = sqlite3.connect(output_path)
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS citizens (
                citizen_id TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                date_of_birth TEXT,
                ssn_hash TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                zip_code TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS licenses (
                license_id TEXT PRIMARY KEY,
                citizen_id TEXT,
                license_type TEXT,
                issue_date TEXT,
                expiry_date TEXT,
                status TEXT,
                issuing_authority TEXT,
                FOREIGN KEY (citizen_id) REFERENCES citizens(citizen_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                txn_id TEXT PRIMARY KEY,
                citizen_id TEXT,
                service_type TEXT,
                amount REAL,
                payment_method TEXT,
                txn_date TEXT,
                status TEXT,
                FOREIGN KEY (citizen_id) REFERENCES citizens(citizen_id)
            )
        ''')
        
        # Generate citizen data
        states = ["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI"]
        cities = ["Los Angeles", "New York", "Houston", "Miami", "Chicago", 
                  "Philadelphia", "Columbus", "Atlanta", "Charlotte", "Detroit"]
        
        citizens = []
        for _ in range(count):
            citizen = (
                self._generate_id("CIT"),
                self._random_string(8),
                self._random_string(10),
                self._random_date(1950, 2005),
                hashlib.sha256(self._random_string(9).encode()).hexdigest(),
                f"{random.randint(100, 9999)} {self._random_string(10)} St",
                random.choice(cities),
                random.choice(states),
                f"{random.randint(10000, 99999)}",
                self._random_date(2015, 2020),
                self._random_date(2020, 2024)
            )
            citizens.append(citizen)
        
        cursor.executemany('''
            INSERT INTO citizens VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', citizens)
        
        # Generate licenses
        license_types = ["DRIVER", "BUSINESS", "PROFESSIONAL", "HUNTING", "FISHING"]
        statuses = ["ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED"]
        
        licenses = []
        for citizen in citizens[:count//2]:  # Half the citizens have licenses
            for _ in range(random.randint(1, 3)):
                license_record = (
                    self._generate_id("LIC"),
                    citizen[0],
                    random.choice(license_types),
                    self._random_date(2018, 2023),
                    self._random_date(2024, 2028),
                    random.choice(statuses),
                    f"Authority_{random.randint(1, 10)}"
                )
                licenses.append(license_record)
        
        cursor.executemany('''
            INSERT INTO licenses VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', licenses)
        
        # Generate transactions
        service_types = ["TAX_FILING", "LICENSE_RENEWAL", "PERMIT_APPLICATION", 
                        "RECORD_REQUEST", "FEE_PAYMENT"]
        payment_methods = ["CREDIT_CARD", "DEBIT_CARD", "CHECK", "CASH", "WIRE"]
        
        transactions = []
        for citizen in citizens:
            for _ in range(random.randint(0, 5)):
                txn = (
                    self._generate_id("TXN"),
                    citizen[0],
                    random.choice(service_types),
                    round(random.uniform(10, 500), 2),
                    random.choice(payment_methods),
                    self._random_date(2022, 2024),
                    random.choice(["COMPLETED", "PENDING", "FAILED"])
                )
                transactions.append(txn)
        
        cursor.executemany('''
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', transactions)
        
        conn.commit()
        
        # Get stats
        cursor.execute("SELECT COUNT(*) FROM citizens")
        citizen_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM licenses")
        license_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM transactions")
        txn_count = cursor.fetchone()[0]
        
        conn.close()
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        total_records = citizen_count + license_count + txn_count
        
        self.generation_stats["records_generated"] += total_records
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "SQLite",
            "data_type": DataType.STRUCTURED.value,
            "category": DataCategory.RELATIONAL.value,
            "record_count": total_records,
            "table_counts": {
                "citizens": citizen_count,
                "licenses": license_count,
                "transactions": txn_count
            },
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }

# =============================================================================
# Kafka Stream Simulator (Real-Time Streaming Data - X_rt)
# =============================================================================

class KafkaStreamSimulator(BaseDataGenerator):
    """
    Simulates Kafka streaming data for real-time processing.
    Maps to: Db_4 (Market Data Feed), Db_6 (Event Stream)
    """
    
    def __init__(self, org_id: str, db_id: str, seed: int = 42):
        super().__init__(org_id, db_id, seed)
        self.message_queue = queue.Queue()
        self.running = False
        self.producer_thread = None
    
    def generate_event_stream(self, count: int, output_path: str, 
                              events_per_second: int = 100) -> Dict[str, Any]:
        """Generate simulated Kafka event stream (Org_3, Db_6)"""
        start_time = time.time()
        
        event_types = ["SENSOR_READING", "ALERT", "HEARTBEAT", "CONFIG_CHANGE", "ERROR"]
        severity_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        
        events = []
        base_time = datetime.now()
        
        for i in range(count):
            # Simulate timestamp with microsecond precision
            event_time = base_time + timedelta(microseconds=i * (1000000 / events_per_second))
            
            event = {
                "kafka_metadata": {
                    "topic": f"iot-events-{self.org_id.lower()}",
                    "partition": random.randint(0, 7),
                    "offset": i,
                    "timestamp": int(event_time.timestamp() * 1000),
                    "key": f"device_{random.randint(1, 100):03d}"
                },
                "payload": {
                    "event_id": self._generate_id("EVT"),
                    "event_type": random.choice(event_types),
                    "timestamp": event_time.isoformat(),
                    "device_id": f"DEVICE_{random.randint(1, 1000):04d}",
                    "data": {
                        "value": round(random.uniform(0, 100), 3),
                        "unit": random.choice(["celsius", "percent", "ppm", "kwh"]),
                        "quality": random.randint(0, 100)
                    },
                    "metadata": {
                        "severity": random.choice(severity_levels),
                        "source_ip": f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
                        "correlation_id": self._generate_id("COR")
                    }
                }
            }
            events.append(event)
        
        # Save as newline-delimited JSON (typical Kafka export format)
        with open(output_path, 'w', encoding='utf-8') as f:
            for event in events:
                f.write(json.dumps(event) + '\n')
        
        elapsed_ms = (time.time() - start_time) * 1000
        file_size = os.path.getsize(output_path)
        
        self.generation_stats["records_generated"] += count
        self.generation_stats["bytes_generated"] += file_size
        self.generation_stats["generation_time_ms"] += elapsed_ms
        
        return {
            "source": f"{self.org_id}/{self.db_id}",
            "format": "Kafka/NDJSON",
            "data_type": DataType.SEMI_STRUCTURED.value,
            "category": DataCategory.REAL_TIME.value,
            "record_count": count,
            "simulated_throughput_eps": events_per_second,
            "file_size_bytes": file_size,
            "generation_time_ms": elapsed_ms,
            "output_path": output_path
        }

# =============================================================================
# Unified Data Generator Manager
# =============================================================================

class DataGeneratorManager:
    """
    Manages all data generators and coordinates data generation
    across multiple organizations and databases.
    """
    
    def __init__(self, output_dir: str = "data/raw"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.generators = {}
        self.generation_results = []
    
    def generate_all_data(self, records_per_source: int = 1000) -> List[Dict[str, Any]]:
        """Generate data for all configured sources"""
        results = []
        
        # Org_1: Healthcare - CSV + JSON
        csv_gen = CSVDataGenerator("Org_1", "Db_1")
        results.append(csv_gen.generate_patient_records(
            records_per_source, 
            os.path.join(self.output_dir, "org1_patient_records.csv")
        ))
        
        json_gen = JSONDataGenerator("Org_1", "Db_2")
        results.append(json_gen.generate_medical_documents(
            records_per_source,
            os.path.join(self.output_dir, "org1_medical_documents.json")
        ))
        
        # Org_2: Financial - CSV + JSON
        csv_gen_fin = CSVDataGenerator("Org_2", "Db_3")
        results.append(csv_gen_fin.generate_financial_transactions(
            records_per_source,
            os.path.join(self.output_dir, "org2_transactions.csv")
        ))
        
        json_gen_mkt = JSONDataGenerator("Org_2", "Db_4")
        results.append(json_gen_mkt.generate_market_data(
            records_per_source,
            os.path.join(self.output_dir, "org2_market_data.json")
        ))
        
        # Org_3: IoT - CSV + Kafka
        csv_gen_iot = CSVDataGenerator("Org_3", "Db_5")
        results.append(csv_gen_iot.generate_sensor_readings(
            records_per_source,
            os.path.join(self.output_dir, "org3_sensor_readings.csv")
        ))
        
        kafka_sim = KafkaStreamSimulator("Org_3", "Db_6")
        results.append(kafka_sim.generate_event_stream(
            records_per_source,
            os.path.join(self.output_dir, "org3_event_stream.ndjson")
        ))
        
        # Org_4: Government - SQL + XML
        sql_gen = SQLDataGenerator("Org_4", "Db_7")
        results.append(sql_gen.generate_relational_database(
            records_per_source,
            os.path.join(self.output_dir, "org4_public_records.db")
        ))
        
        xml_gen = XMLDataGenerator("Org_4", "Db_8")
        results.append(xml_gen.generate_public_records(
            records_per_source,
            os.path.join(self.output_dir, "org4_document_archive.xml")
        ))
        
        self.generation_results = results
        return results
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of generated data"""
        total_records = sum(r.get("record_count", 0) for r in self.generation_results)
        total_bytes = sum(r.get("file_size_bytes", 0) for r in self.generation_results)
        total_time = sum(r.get("generation_time_ms", 0) for r in self.generation_results)
        
        return {
            "total_sources": len(self.generation_results),
            "total_records": total_records,
            "total_bytes": total_bytes,
            "total_generation_time_ms": total_time,
            "throughput_records_per_sec": total_records / (total_time / 1000) if total_time > 0 else 0,
            "sources": self.generation_results
        }


if __name__ == "__main__":
    # Test data generation
    manager = DataGeneratorManager("data/raw")
    results = manager.generate_all_data(records_per_source=100)
    summary = manager.get_summary()
    print(json.dumps(summary, indent=2))
