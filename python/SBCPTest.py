import requests
import json

# Test basic connection
response = requests.get("http://localhost:8000/")
print("Health check:", response.json())

# Test transaction sending
tx_data = {
    "tx_id": "test_tx",
    "from_addr": "addr1", 
    "to_addr": "addr2",
    "value": 100.0,
    "timestamp": 1693574400.0,
    "risk_score": 0.1,
    "complexity_class": 1,
    "security_level": 2,
    "nonce": 0
}

response = requests.post("http://localhost:8000/transaction/propose", json=tx_data, timeout=10)
print("Transaction response:", response.json())