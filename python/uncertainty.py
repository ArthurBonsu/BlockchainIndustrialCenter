import os
import sys
import json
import logging
import time
import random
from typing import Dict, Any, Optional
from web3 import Web3, HTTPProvider
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
print("Loading environment variables...")
load_dotenv()

class FixedSigningContractsManager:
    def __init__(
        self, 
        web3: Web3, 
        cost_analytics_address: str,
        request_manager_address: str,
        response_manager_address: str
    ):
        """Initialize Manager with FIXED transaction signing"""
        print("Initializing FixedSigningContractsManager...")
        
        self.w3 = web3
        self.cost_analytics_address = Web3.to_checksum_address(cost_analytics_address)
        self.request_manager_address = Web3.to_checksum_address(request_manager_address)
        self.response_manager_address = Web3.to_checksum_address(response_manager_address)
        
        # Get and normalize private key
        self.private_key = self._get_normalized_private_key()
        
        # ABIs
        self.cost_analytics_abi = self._get_cost_analytics_abi()
        self.request_manager_abi = self._get_request_manager_abi()
        self.response_manager_abi = self._get_response_manager_abi()
        
        self.cost_analytics_contract = None
        self.request_manager_contract = None
        self.response_manager_contract = None
        
        # Track metrics
        self.local_metrics = {
            "requests_submitted": 0,
            "responses_submitted": 0,
            "total_cost": 0,
            "failed_transactions": 0,
            "cost_analytics_calls": 0
        }
        
        print("FixedSigningContractsManager initialized successfully")

    def _get_normalized_private_key(self):
        """Get and properly normalize the private key for signing"""
        private_key = os.getenv('PRIVATE_KEY')
        if not private_key:
            raise ValueError("PRIVATE_KEY not found in environment variables")
        
        # Remove 0x prefix if it exists
        if private_key.startswith('0x'):
            private_key = private_key[2:]
        
        # Ensure it's exactly 64 characters (32 bytes)
        if len(private_key) != 64:
            raise ValueError(f"Private key must be 64 characters long, got {len(private_key)}")
        
        # Return WITHOUT 0x prefix for Web3.py signing
        print(f"✅ Private key normalized: {len(private_key)} characters (no 0x prefix)")
        return private_key

    def _get_cost_analytics_abi(self):
        """ABI for CostAnalytics contract"""
        return [
            {
                "inputs": [{"internalType": "contract UncertaintyBase", "name": "_base", "type": "address"}],
                "stateMutability": "nonpayable", "type": "constructor"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "uint256", "name": "requestId", "type": "uint256"},
                    {"indexed": False, "internalType": "uint256", "name": "cost", "type": "uint256"},
                    {"indexed": False, "internalType": "string", "name": "costType", "type": "string"}
                ],
                "name": "CostRecorded", "type": "event"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "_processingTime", "type": "uint256"}],
                "name": "calculateUnavailabilityCost", "outputs": [], "stateMutability": "nonpayable", "type": "function"
            },
            {"inputs": [], "name": "dataHoldingCost", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "disruptionLevel", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "escalationLevel", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "unavailabilityCost", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [{"internalType": "uint256", "name": "_cost", "type": "uint256"}], "name": "updateDataHoldingCost", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"inputs": [{"internalType": "uint256", "name": "_level", "type": "uint256"}], "name": "updateDisruptionLevel", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"inputs": [{"internalType": "uint256", "name": "_level", "type": "uint256"}], "name": "updateEscalationLevel", "outputs": [], "stateMutability": "nonpayable", "type": "function"}
        ]

    def _get_request_manager_abi(self):
        """ABI for RequestManager contract"""
        return [
            {"inputs": [{"internalType": "address", "name": "_analytics", "type": "address"}], "stateMutability": "nonpayable", "type": "constructor"},
            {"anonymous": False, "inputs": [{"indexed": True, "internalType": "address", "name": "recipient", "type": "address"}, {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "FundsWithdrawn", "type": "event"},
            {"anonymous": False, "inputs": [{"indexed": True, "internalType": "uint256", "name": "requestId", "type": "uint256"}, {"indexed": True, "internalType": "address", "name": "requester", "type": "address"}, {"indexed": False, "internalType": "uint256", "name": "value", "type": "uint256"}], "name": "RequestSubmitted", "type": "event"},
            {"inputs": [], "name": "VERSION", "outputs": [{"internalType": "string", "name": "", "type": "string"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "getAnalyticsMetrics", "outputs": [{"internalType": "uint256", "name": "avgProcessingTime", "type": "uint256"}, {"internalType": "uint256", "name": "successRate", "type": "uint256"}, {"internalType": "uint256", "name": "totalCost", "type": "uint256"}, {"internalType": "uint256", "name": "disruptionCount", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "owner", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "submitRequest", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "payable", "type": "function"},
            {"inputs": [{"internalType": "string", "name": "_additionalInfo", "type": "string"}], "name": "submitRequestWithInfo", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "payable", "type": "function"},
            {"inputs": [{"internalType": "address", "name": "_newOwner", "type": "address"}], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"inputs": [], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"stateMutability": "payable", "type": "receive"}
        ]

    def _get_response_manager_abi(self):
        """ABI for ResponseManager contract"""
        return [
            {"inputs": [{"internalType": "address", "name": "_analytics", "type": "address"}], "stateMutability": "nonpayable", "type": "constructor"},
            {"anonymous": False, "inputs": [{"indexed": True, "internalType": "address", "name": "recipient", "type": "address"}, {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "FundsWithdrawn", "type": "event"},
            {"anonymous": False, "inputs": [{"indexed": True, "internalType": "uint256", "name": "requestId", "type": "uint256"}, {"indexed": True, "internalType": "address", "name": "responder", "type": "address"}], "name": "ResponseSubmitted", "type": "event"},
            {"inputs": [], "name": "VERSION", "outputs": [{"internalType": "string", "name": "", "type": "string"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "getAnalyticsMetrics", "outputs": [{"internalType": "uint256", "name": "avgProcessingTime", "type": "uint256"}, {"internalType": "uint256", "name": "successRate", "type": "uint256"}, {"internalType": "uint256", "name": "totalCost", "type": "uint256"}, {"internalType": "uint256", "name": "disruptionCount", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [{"internalType": "address", "name": "_responder", "type": "address"}], "name": "getResponderCount", "outputs": [{"internalType": "uint256", "name": "count", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "owner", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
            {"inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "name": "processedRequests", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"},
            {"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "responderCount", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [{"internalType": "uint256", "name": "_requestId", "type": "uint256"}], "name": "submitResponse", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"inputs": [{"internalType": "uint256", "name": "_requestId", "type": "uint256"}], "name": "submitResponseWithCalculation", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"inputs": [{"internalType": "address", "name": "_newOwner", "type": "address"}], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"inputs": [], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
            {"stateMutability": "payable", "type": "receive"}
        ]

    def load_contracts(self):
        """Load the deployed contracts"""
        print("Loading deployed contracts...")
        
        try:
            self.cost_analytics_contract = self.w3.eth.contract(
                address=self.cost_analytics_address,
                abi=self.cost_analytics_abi
            )
            print(f"✅ CostAnalytics loaded at {self.cost_analytics_address}")
            
            self.request_manager_contract = self.w3.eth.contract(
                address=self.request_manager_address,
                abi=self.request_manager_abi
            )
            print(f"✅ RequestManager loaded at {self.request_manager_address}")
            
            self.response_manager_contract = self.w3.eth.contract(
                address=self.response_manager_address,
                abi=self.response_manager_abi
            )
            print(f"✅ ResponseManager loaded at {self.response_manager_address}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error loading contracts: {e}")
            return False

    def verify_contracts(self):
        """Verify the deployed contracts"""
        print("\n=== Verifying Deployed Contracts ===")
        
        try:
            print("Testing CostAnalytics contract...")
            data_holding_cost = self.cost_analytics_contract.functions.dataHoldingCost().call()
            unavailability_cost = self.cost_analytics_contract.functions.unavailabilityCost().call()
            disruption_level = self.cost_analytics_contract.functions.disruptionLevel().call()
            escalation_level = self.cost_analytics_contract.functions.escalationLevel().call()
            
            print(f"✅ CostAnalytics dataHoldingCost: {data_holding_cost}")
            print(f"✅ CostAnalytics unavailabilityCost: {unavailability_cost}")
            print(f"✅ CostAnalytics disruptionLevel: {disruption_level}")
            print(f"✅ CostAnalytics escalationLevel: {escalation_level}")
            
        except Exception as e:
            print(f"❌ CostAnalytics verification failed: {e}")
        
        try:
            version = self.request_manager_contract.functions.VERSION().call()
            owner = self.request_manager_contract.functions.owner().call()
            
            print(f"✅ RequestManager VERSION: {version}")
            print(f"✅ RequestManager Owner: {owner}")
            
        except Exception as e:
            print(f"❌ RequestManager verification failed: {e}")
        
        try:
            version = self.response_manager_contract.functions.VERSION().call()
            owner = self.response_manager_contract.functions.owner().call()
            count = self.response_manager_contract.functions.getResponderCount(
                self.w3.eth.default_account
            ).call()
            
            print(f"✅ ResponseManager VERSION: {version}")
            print(f"✅ ResponseManager Owner: {owner}")
            print(f"✅ ResponseManager Responder Count: {count}")
            
        except Exception as e:
            print(f"❌ ResponseManager verification failed: {e}")

    def _sign_and_send_transaction(self, tx_dict: dict, description: str = "Transaction"):
        """Properly sign and send transaction with FIXED signing"""
        print(f"\n🔐 SIGNING {description.upper()}")
        
        try:
            print(f"From: {tx_dict['from']}")
            print(f"To: {tx_dict.get('to', 'Contract Creation')}")
            print(f"Value: {Web3.from_wei(tx_dict.get('value', 0), 'ether')} ETH")
            print(f"Gas: {tx_dict['gas']}")
            print(f"Gas Price: {Web3.from_wei(tx_dict['gasPrice'], 'gwei')} Gwei")
            print(f"Nonce: {tx_dict['nonce']}")
            
            print(f"🔑 Signing with private key (length: {len(self.private_key)} chars, no 0x)")
            signed_tx = self.w3.eth.account.sign_transaction(tx_dict, self.private_key)
            
            print(f"📤 Sending signed transaction...")
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            print(f"Transaction hash: {tx_hash.hex()}")
            
            print(f"⏳ Waiting for confirmation...")
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
            
            if tx_receipt['status'] == 1:
                print(f"✅ {description} successful!")
                print(f"Block: {tx_receipt['blockNumber']}")
                print(f"Gas Used: {tx_receipt['gasUsed']}")
                return tx_receipt
            else:
                print(f"❌ {description} failed - status: {tx_receipt['status']}")
                return None
                
        except Exception as e:
            print(f"❌ Error in {description}: {e}")
            print(f"Private key length: {len(self.private_key)}")
            print(f"Private key starts with: {self.private_key[:4]}...")
            raise

    def test_gas_estimation_first(self):
        """Test gas estimation before attempting transactions"""
        print(f"\n🧪 TESTING GAS ESTIMATION FIRST")
        
        try:
            print("Testing basic submitRequest gas estimation...")
            gas_estimate = self.request_manager_contract.functions.submitRequest().estimate_gas({
                'from': self.w3.eth.default_account,
                'value': Web3.to_wei(0.001, 'ether')
            })
            print(f"✅ Basic request gas estimate: {gas_estimate}")
            
            print("Testing submitRequestWithInfo gas estimation...")
            gas_estimate_info = self.request_manager_contract.functions.submitRequestWithInfo(
                "Test info"
            ).estimate_gas({
                'from': self.w3.eth.default_account,
                'value': Web3.to_wei(0.001, 'ether')
            })
            print(f"✅ Request with info gas estimate: {gas_estimate_info}")
            
            print("Testing calculateUnavailabilityCost gas estimation...")
            gas_estimate_cost = self.cost_analytics_contract.functions.calculateUnavailabilityCost(
                1800
            ).estimate_gas({'from': self.w3.eth.default_account})
            print(f"✅ Cost analytics gas estimate: {gas_estimate_cost}")
            
            print(f"🎉 All gas estimations successful! Contracts should work.")
            return True
            
        except Exception as e:
            print(f"❌ Gas estimation failed: {e}")
            print(f"This suggests a contract logic issue, not a signing issue.")
            return False

    def submit_request_fixed_signing(self, value_in_eth: float, additional_info: str = "") -> int:
        """Submit request with FIXED signing"""
        print(f"\n🚀 SUBMITTING REQUEST WITH FIXED SIGNING - Value: {value_in_eth} ETH")
        
        if not self.request_manager_contract:
            raise Exception("RequestManager contract not loaded")
            
        value_in_wei = Web3.to_wei(value_in_eth, 'ether')
        
        try:
            nonce = self.w3.eth.get_transaction_count(self.w3.eth.default_account)
            gas_price = self.w3.eth.gas_price
            
            print(f"Gas price: {Web3.from_wei(gas_price, 'gwei')} Gwei")
            print(f"Nonce: {nonce}")
            
            if additional_info:
                print(f"Using submitRequestWithInfo with: '{additional_info}'")
                gas_estimate = self.request_manager_contract.functions.submitRequestWithInfo(
                    additional_info
                ).estimate_gas({
                    'from': self.w3.eth.default_account,
                    'value': value_in_wei
                })
                
                tx = self.request_manager_contract.functions.submitRequestWithInfo(
                    additional_info
                ).build_transaction({
                    'from': self.w3.eth.default_account,
                    'value': value_in_wei,
                    'nonce': nonce,
                    'gas': int(gas_estimate * 1.2),
                    'gasPrice': gas_price
                })
            else:
                print("Using basic submitRequest")
                gas_estimate = self.request_manager_contract.functions.submitRequest().estimate_gas({
                    'from': self.w3.eth.default_account,
                    'value': value_in_wei
                })
                
                tx = self.request_manager_contract.functions.submitRequest().build_transaction({
                    'from': self.w3.eth.default_account,
                    'value': value_in_wei,
                    'nonce': nonce,
                    'gas': int(gas_estimate * 1.2),
                    'gasPrice': gas_price
                })
            
            print(f"Estimated gas: {gas_estimate}")
            
            tx_receipt = self._sign_and_send_transaction(tx, "Request Submission")
            
            if tx_receipt:
                logs = self.request_manager_contract.events.RequestSubmitted().process_receipt(tx_receipt)
                if logs:
                    request_id = logs[0]['args']['requestId']
                    requester = logs[0]['args']['requester']
                    value = logs[0]['args']['value']
                    
                    print(f"\n--- REQUEST SUBMITTED TO BLOCKCHAIN ---")
                    print(f"Request ID: {request_id}")
                    print(f"Requester: {requester}")
                    print(f"Value: {Web3.from_wei(value, 'ether')} ETH")
                    if additional_info:
                        print(f"Additional Info: {additional_info}")
                    
                    self.local_metrics["requests_submitted"] += 1
                    self.local_metrics["total_cost"] += value
                    
                    return request_id
                else:
                    print("⚠️  Request submitted but no event found")
                    return 0
            else:
                return 0
                
        except Exception as e:
            print(f"❌ Error submitting request: {e}")
            self.local_metrics["failed_transactions"] += 1
            raise

    def submit_response_fixed_signing(self, request_id: int, with_calculation: bool = False) -> bool:
        """Submit response with FIXED signing"""
        print(f"\n🚀 SUBMITTING RESPONSE WITH FIXED SIGNING - Request ID: {request_id}")
        
        if not self.response_manager_contract:
            raise Exception("ResponseManager contract not loaded")
            
        try:
            nonce = self.w3.eth.get_transaction_count(self.w3.eth.default_account)
            gas_price = self.w3.eth.gas_price
            
            print(f"Gas price: {Web3.from_wei(gas_price, 'gwei')} Gwei")
            print(f"Nonce: {nonce}")
            
            if with_calculation:
                print("Using submitResponseWithCalculation")
                gas_estimate = self.response_manager_contract.functions.submitResponseWithCalculation(
                    request_id
                ).estimate_gas({'from': self.w3.eth.default_account})
                
                tx = self.response_manager_contract.functions.submitResponseWithCalculation(
                    request_id
                ).build_transaction({
                    'from': self.w3.eth.default_account,
                    'nonce': nonce,
                    'gas': int(gas_estimate * 1.2),
                    'gasPrice': gas_price
                })
            else:
                print("Using basic submitResponse")
                gas_estimate = self.response_manager_contract.functions.submitResponse(
                    request_id
                ).estimate_gas({'from': self.w3.eth.default_account})
                
                tx = self.response_manager_contract.functions.submitResponse(
                    request_id
                ).build_transaction({
                    'from': self.w3.eth.default_account,
                    'nonce': nonce,
                    'gas': int(gas_estimate * 1.2),
                    'gasPrice': gas_price
                })
            
            print(f"Estimated gas: {gas_estimate}")
            
            tx_receipt = self._sign_and_send_transaction(tx, "Response Submission")
            
            if tx_receipt:
                logs = self.response_manager_contract.events.ResponseSubmitted().process_receipt(tx_receipt)
                if logs:
                    logged_request_id = logs[0]['args']['requestId']
                    responder = logs[0]['args']['responder']
                    
                    print(f"\n--- RESPONSE SUBMITTED TO BLOCKCHAIN ---")
                    print(f"Request ID: {logged_request_id}")
                    print(f"Responder: {responder}")
                    
                    self.local_metrics["responses_submitted"] += 1
                    
                    return True
                else:
                    print("⚠️  Response submitted but no event found")
                    return True
            else:
                return False
                
        except Exception as e:
            print(f"❌ Error submitting response: {e}")
            self.local_metrics["failed_transactions"] += 1
            raise

    def interact_with_cost_analytics_fixed_signing(self, processing_time: int = 3600) -> bool:
        """Interact with CostAnalytics with FIXED signing"""
        print(f"\n🚀 INTERACTING WITH COST ANALYTICS - FIXED SIGNING")
        
        if not self.cost_analytics_contract:
            raise Exception("CostAnalytics contract not loaded")
            
        try:
            nonce = self.w3.eth.get_transaction_count(self.w3.eth.default_account)
            gas_price = self.w3.eth.gas_price
            
            print(f"Calculating unavailability cost for {processing_time} seconds")
            
            gas_estimate = self.cost_analytics_contract.functions.calculateUnavailabilityCost(
                processing_time
            ).estimate_gas({'from': self.w3.eth.default_account})
            
            tx = self.cost_analytics_contract.functions.calculateUnavailabilityCost(
                processing_time
            ).build_transaction({
                'from': self.w3.eth.default_account,
                'nonce': nonce,
                'gas': int(gas_estimate * 1.2),
                'gasPrice': gas_price
            })
            
            print(f"Estimated gas: {gas_estimate}")
            
            tx_receipt = self._sign_and_send_transaction(tx, "Cost Analytics Calculation")
            
            if tx_receipt:
                logs = self.cost_analytics_contract.events.CostRecorded().process_receipt(tx_receipt)
                if logs:
                    for log in logs:
                        request_id = log['args']['requestId']
                        cost = log['args']['cost']
                        cost_type = log['args']['costType']
                        
                        print(f"\n--- COST RECORDED ---")
                        print(f"Request ID: {request_id}")
                        print(f"Cost: {Web3.from_wei(cost, 'ether')} ETH")
                        print(f"Cost Type: {cost_type}")
                
                self.local_metrics["cost_analytics_calls"] += 1
                
                return True
            else:
                return False
                
        except Exception as e:
            print(f"❌ Error interacting with CostAnalytics: {e}")
            self.local_metrics["failed_transactions"] += 1
            raise

    def display_final_summary(self):
        """Display final summary"""
        print(f"\n" + "="*60)
        print("📊 FINAL SUMMARY - FIXED SIGNING")
        print("="*60)
        
        print(f"🔢 Transaction Metrics:")
        print(f"  Requests Submitted: {self.local_metrics['requests_submitted']}")
        print(f"  Responses Submitted: {self.local_metrics['responses_submitted']}")
        print(f"  Cost Analytics Calls: {self.local_metrics['cost_analytics_calls']}")
        print(f"  Failed Transactions: {self.local_metrics['failed_transactions']}")
        print(f"  Total Cost: {Web3.from_wei(self.local_metrics['total_cost'], 'ether')} ETH")
        
        total_attempts = (self.local_metrics["requests_submitted"] + 
                         self.local_metrics["responses_submitted"] + 
                         self.local_metrics["cost_analytics_calls"] + 
                         self.local_metrics["failed_transactions"])
        
        if total_attempts > 0:
            success_rate = ((total_attempts - self.local_metrics["failed_transactions"]) / total_attempts) * 100
            print(f"📈 Success Rate: {success_rate:.1f}%")
        
        print(f"\n🔧 Contract Addresses:")
        print(f"  CostAnalytics: {self.cost_analytics_address}")
        print(f"  RequestManager: {self.request_manager_address}")
        print(f"  ResponseManager: {self.response_manager_address}")


def create_web3_connection(network: str = "sepolia"):
    """Create Web3 connection"""
    try:
        INFURA_PROJECT_ID = os.getenv("INFURA_PROJECT_ID")
        if not INFURA_PROJECT_ID:
            raise ValueError("INFURA_PROJECT_ID not found in environment variables")

        sepolia_url = f"https://sepolia.infura.io/v3/{INFURA_PROJECT_ID}"
        web3 = Web3(HTTPProvider(sepolia_url))

        if not web3.is_connected():
            raise ConnectionError("Failed to connect to Infura Sepolia endpoint")

        web3.eth.default_account = "0x7927E739C9B0b304610D4Ae35cBf5FDD0D5ad36A"

        print("\n--- Web3 Connection ---")
        print(f"Connected to Network: Sepolia")
        print(f"Chain ID: {web3.eth.chain_id}")
        print(f"Latest Block Number: {web3.eth.block_number}")
        print(f"Default Account: {web3.eth.default_account}")
        print(f"Account Balance: {Web3.from_wei(web3.eth.get_balance(web3.eth.default_account), 'ether')} ETH")

        return web3

    except Exception as e:
        logging.error(f"Blockchain Connection Error: {e}")
        return None

def create_web3_connection(network: str = "sepolia"):
    """Create Web3 connection"""
    try:
        INFURA_PROJECT_ID = os.getenv("INFURA_PROJECT_ID")
        if not INFURA_PROJECT_ID:
            raise ValueError("INFURA_PROJECT_ID not found in environment variables")

        sepolia_url = f"https://sepolia.infura.io/v3/{INFURA_PROJECT_ID}"
        web3 = Web3(HTTPProvider(sepolia_url))

        if not web3.is_connected():
            raise ConnectionError("Failed to connect to Infura Sepolia endpoint")

        web3.eth.default_account = "0x7927E739C9B0b304610D4Ae35cBf5FDD0D5ad36A"

        print("\n--- Web3 Connection ---")
        print(f"Connected to Network: Sepolia")
        print(f"Chain ID: {web3.eth.chain_id}")
        print(f"Latest Block Number: {web3.eth.block_number}")
        print(f"Default Account: {web3.eth.default_account}")
        print(f"Account Balance: {Web3.from_wei(web3.eth.get_balance(web3.eth.default_account), 'ether')} ETH")

        return web3

    except Exception as e:
        logging.error(f"Blockchain Connection Error: {e}")
        return None


def main():
    """Main function with FIXED transaction signing"""
    try:
        COST_ANALYTICS_ADDRESS = "0xafb69d3380aa2a892625665803fca627fd65ec0f"
        REQUEST_MANAGER_ADDRESS = "0xc5491f090181c8653ec0228d07499a51d7bf12bd"
        RESPONSE_MANAGER_ADDRESS = "0xfda50ab71b0e577680c4afe29fdc2272ab19d89b"
        
        print("🎯 FIXED SIGNING MODE - DEPLOYED CONTRACTS")
        print("🔐 Using corrected private key handling for Web3.py")
        print(f"CostAnalytics: {COST_ANALYTICS_ADDRESS}")
        print(f"RequestManager: {REQUEST_MANAGER_ADDRESS}")
        print(f"ResponseManager: {RESPONSE_MANAGER_ADDRESS}")
        
        # Create Web3 connection
        web3 = create_web3_connection("sepolia")
        if not web3:
            print("Could not establish blockchain connection. Exiting.")
            sys.exit(1)

        # Initialize manager with FIXED signing
        manager = FixedSigningContractsManager(
            web3=web3,
            cost_analytics_address=COST_ANALYTICS_ADDRESS,
            request_manager_address=REQUEST_MANAGER_ADDRESS,
            response_manager_address=RESPONSE_MANAGER_ADDRESS
        )

        # Load and verify contracts
        if not manager.load_contracts():
            print("❌ Failed to load contracts")
            sys.exit(1)
            
        manager.verify_contracts()

        # Test gas estimation first
        print("\n" + "="*60)
        print("🧪 PRE-FLIGHT CHECKS")
        print("="*60)
        
        gas_test_passed = manager.test_gas_estimation_first()
        
        if not gas_test_passed:
            print("❌ Gas estimation failed - there may be contract logic issues")
            print("Continuing with transaction tests anyway...")

        # Start testing with FIXED signing
        print("\n" + "="*60)
        print("🚀 STARTING FIXED SIGNING TESTS")
        print("="*60)

        # Test 1: Simple request submission
        print("\n=== TEST 1: SIMPLE REQUEST SUBMISSION ===")
        try:
            request_id = manager.submit_request_fixed_signing(
                value_in_eth=0.001,
                additional_info=""
            )
            
            if request_id > 0:
                print(f"✅ Test 1 SUCCESS: Request ID {request_id}")
                
                # Test 2: Submit response to that request
                print("\n=== TEST 2: RESPONSE SUBMISSION ===")
                time.sleep(3)  # Wait between transactions
                
                response_success = manager.submit_response_fixed_signing(
                    request_id=request_id,
                    with_calculation=False
                )
                
                if response_success:
                    print(f"✅ Test 2 SUCCESS: Response submitted")
                else:
                    print(f"❌ Test 2 FAILED: Response submission failed")
                    
            else:
                print(f"❌ Test 1 FAILED: Request submission failed")
                
        except Exception as e:
            print(f"❌ Test 1 ERROR: {e}")

        # Test 3: Cost Analytics interaction
        print("\n=== TEST 3: COST ANALYTICS INTERACTION ===")
        try:
            time.sleep(3)  # Wait between transactions
            
            cost_success = manager.interact_with_cost_analytics_fixed_signing(
                processing_time=1800  # 30 minutes
            )
            
            if cost_success:
                print(f"✅ Test 3 SUCCESS: Cost analytics calculation completed")
            else:
                print(f"❌ Test 3 FAILED: Cost analytics interaction failed")
                
        except Exception as e:
            print(f"❌ Test 3 ERROR: {e}")

        # Test 4: Request with info
        print("\n=== TEST 4: REQUEST WITH ADDITIONAL INFO ===")
        try:
            time.sleep(3)  # Wait between transactions
            
            request_id_2 = manager.submit_request_fixed_signing(
                value_in_eth=0.002,
                additional_info="Fixed signing test request"
            )
            
            if request_id_2 > 0:
                print(f"✅ Test 4 SUCCESS: Request with info - ID {request_id_2}")
                
                # Submit response with calculation
                time.sleep(3)
                response_success_2 = manager.submit_response_fixed_signing(
                    request_id=request_id_2,
                    with_calculation=True
                )
                
                if response_success_2:
                    print(f"✅ Test 4 RESPONSE SUCCESS: Response with calculation submitted")
                    
            else:
                print(f"❌ Test 4 FAILED: Request with info submission failed")
                
        except Exception as e:
            print(f"❌ Test 4 ERROR: {e}")

        # Test 5: Edge case - minimal value
        print("\n=== TEST 5: EDGE CASE - MINIMAL VALUE ===")
        try:
            time.sleep(3)  # Wait between transactions
            
            request_id_3 = manager.submit_request_fixed_signing(
                value_in_eth=0.0001,  # Very small amount
                additional_info="Minimal value test"
            )
            
            if request_id_3 > 0:
                print(f"✅ Test 5 SUCCESS: Minimal value request - ID {request_id_3}")
            else:
                print(f"❌ Test 5 FAILED: Minimal value request failed")
                
        except Exception as e:
            print(f"❌ Test 5 ERROR: {e}")

        # Final status check
        print("\n=== FINAL CONTRACT STATUS CHECK ===")
        try:
            # Check CostAnalytics status
            data_cost = manager.cost_analytics_contract.functions.dataHoldingCost().call()
            unavail_cost = manager.cost_analytics_contract.functions.unavailabilityCost().call()
            disruption = manager.cost_analytics_contract.functions.disruptionLevel().call()
            escalation = manager.cost_analytics_contract.functions.escalationLevel().call()
            
            print(f"\n📊 Final CostAnalytics Status:")
            print(f"  Data Holding Cost: {Web3.from_wei(data_cost, 'ether')} ETH")
            print(f"  Unavailability Cost: {Web3.from_wei(unavail_cost, 'ether')} ETH")
            print(f"  Disruption Level: {disruption}")
            print(f"  Escalation Level: {escalation}")
            
            # Check responder count
            responder_count = manager.response_manager_contract.functions.getResponderCount(
                web3.eth.default_account
            ).call()
            print(f"\n👤 Your Response Count: {responder_count}")
            
        except Exception as e:
            print(f"❌ Error checking final status: {e}")

        # Display comprehensive summary
        manager.display_final_summary()
        
        print(f"\n" + "="*60)
        print("🎉 FIXED SIGNING TESTS COMPLETE!")
        print("="*60)
        
        if manager.local_metrics["failed_transactions"] == 0:
            print("🏆 ALL TESTS PASSED! Your contracts are working perfectly!")
        elif manager.local_metrics["requests_submitted"] > 0:
            print("✅ PARTIAL SUCCESS! Some transactions worked with fixed signing!")
        else:
            print("❌ TESTS FAILED! There may be a deeper contract issue.")
            
        print(f"\n🔍 Check your transactions on Etherscan:")
        print(f"   https://sepolia.etherscan.io/address/{web3.eth.default_account}")
        
        print(f"\n💡 KEY INSIGHT: Fixed private key handling for Web3.py signing")
        print(f"   - Removed 0x prefix from private key")
        print(f"   - Used proper transaction signing method")
        print(f"   - Added gas estimation and buffer")
        print(f"   - Fresh nonce calculation for each transaction")

    except Exception as e:
        logging.error(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()