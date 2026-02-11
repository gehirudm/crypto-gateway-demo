"""
Optimism USDT ERC20 Recovery & Sweep Script

This script provides standalone recovery and sweep operations for the
Optimism-based payment gateway. It can:

1. Derive invoice/merchant wallets from the master mnemonic
2. Check USDT (ERC20) and ETH balances
3. Sweep stuck invoices (USDT -> commission to master + remainder to merchant)
4. Prefund wallets with ETH for gas
5. List all invoices and their statuses

Dependencies:
    pip install -r requirements.txt

Usage:
    python check_and_sweep.py
"""

import os
import time
from typing import List, Dict, Optional
from web3 import Web3
from eth_account import Account
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Enable HD wallet features
Account.enable_unaudited_hdwallet_features()

# ---------------- CONFIG ----------------
RPC_URL = os.getenv("OPTIMISM_RPC_URL", "https://mainnet.optimism.io")
USDT_CONTRACT = os.getenv(
    "OPTIMISM_USDT_CONTRACT", "0x94b008aA00579c1307B0EF2c499aD98a8ce58e68"
)

MNEMONIC = os.getenv("MASTER_MNEMONIC")
if not MNEMONIC:
    raise ValueError("MASTER_MNEMONIC not set in environment variables")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Minimal ERC20 ABI for balanceOf and transfer
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
]

# Create Web3 client
w3 = Web3(Web3.HTTPProvider(RPC_URL))
usdt_contract = w3.eth.contract(
    address=Web3.to_checksum_address(USDT_CONTRACT), abi=ERC20_ABI
)


# ================== WALLET DERIVATION ==================


def derive_invoice_wallet(index: int):
    """
    Derive invoice wallet from mnemonic.
    BIP44 path: m/44'/60'/0'/0/{index}
    Index 0 = gas wallet, 1+ = invoice wallets.
    Returns (address, account).
    """
    acct = Account.from_mnemonic(MNEMONIC, account_path=f"m/44'/60'/0'/0/{index}")
    return acct.address, acct


def derive_merchant_wallet(index: int):
    """
    Derive merchant wallet from mnemonic.
    BIP44 path: m/44'/60'/1'/0/{index}
    Returns (address, account).
    """
    acct = Account.from_mnemonic(MNEMONIC, account_path=f"m/44'/60'/1'/0/{index}")
    return acct.address, acct


# ================== BALANCE FUNCTIONS ==================


def get_eth_balance(address: str) -> float:
    """Get ETH balance of an address in ETH units."""
    try:
        balance = w3.eth.get_balance(Web3.to_checksum_address(address))
        return float(w3.from_wei(balance, "ether"))
    except Exception as e:
        print(f"  [WARN] Failed to get ETH balance for {address}: {e}")
        return 0.0


def get_usdt_balance(address: str) -> float:
    """Get USDT ERC20 balance in USDT units (6 decimals)."""
    try:
        raw = usdt_contract.functions.balanceOf(
            Web3.to_checksum_address(address)
        ).call()
        return float(raw) / 1e6
    except Exception as e:
        print(f"  [WARN] Failed to get USDT balance for {address}: {e}")
        return 0.0


# ================== TRANSFER FUNCTIONS ==================


def send_eth(from_acct, to_address: str, amount_eth: float) -> Optional[str]:
    """Send ETH from a wallet. Returns tx hash or None."""
    try:
        to = Web3.to_checksum_address(to_address)
        value = w3.to_wei(amount_eth, "ether")
        nonce = w3.eth.get_transaction_count(from_acct.address)

        tx = {
            "to": to,
            "value": value,
            "gas": 21000,
            "nonce": nonce,
            "chainId": w3.eth.chain_id,
        }

        # Use EIP-1559 fees (Optimism supports this)
        fee_data = w3.eth.fee_history(1, "latest", [50])
        base_fee = fee_data["baseFeePerGas"][-1]
        tx["maxFeePerGas"] = base_fee * 2
        tx["maxPriorityFeePerGas"] = w3.to_wei(0.001, "gwei")

        signed = from_acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            print(f"  [ETH] Sent {amount_eth:.6f} ETH -> {to_address} | tx: {tx_hash.hex()}")
            return tx_hash.hex()
        else:
            print(f"  [ERROR] ETH transfer reverted!")
            return None
    except Exception as e:
        print(f"  [ERROR] Failed to send ETH: {e}")
        return None


def send_usdt(from_acct, to_address: str, amount_usdt: float) -> Optional[str]:
    """Send USDT ERC20 from a wallet. Returns tx hash or None."""
    try:
        to = Web3.to_checksum_address(to_address)
        raw_amount = int(amount_usdt * 1e6)
        nonce = w3.eth.get_transaction_count(from_acct.address)

        tx = usdt_contract.functions.transfer(to, raw_amount).build_transaction(
            {
                "from": from_acct.address,
                "nonce": nonce,
                "chainId": w3.eth.chain_id,
            }
        )

        # Use EIP-1559 fees
        fee_data = w3.eth.fee_history(1, "latest", [50])
        base_fee = fee_data["baseFeePerGas"][-1]
        tx["maxFeePerGas"] = base_fee * 2
        tx["maxPriorityFeePerGas"] = w3.to_wei(0.001, "gwei")

        gas_estimate = w3.eth.estimate_gas(tx)
        tx["gas"] = int(gas_estimate * 1.2)

        signed = from_acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            print(f"  [USDT] Sent {amount_usdt:.4f} USDT -> {to_address} | tx: {tx_hash.hex()}")
            return tx_hash.hex()
        else:
            print(f"  [ERROR] USDT transfer reverted!")
            return None
    except Exception as e:
        print(f"  [ERROR] Failed to send USDT: {e}")
        return None


def prefund_with_eth(to_address: str, amount_eth: float = 0.0) -> Optional[str]:
    """Prefund a wallet with ETH from the gas wallet (index 0).
    If amount_eth is 0 or not provided, estimates the required gas dynamically."""
    gas_address, gas_acct = derive_invoice_wallet(0)
    gas_balance = get_eth_balance(gas_address)

    if amount_eth <= 0:
        amount_eth = estimate_sweep_cost() * 1.25  # 25% buffer

    # Only need a tiny buffer for the ETH transfer gas itself (~21000 gas)
    try:
        gas_price = w3.eth.gas_price
        eth_transfer_cost = float(w3.from_wei(gas_price * 21000 * 2, "ether"))
    except Exception:
        eth_transfer_cost = 0.00005

    total_needed = amount_eth + eth_transfer_cost

    if gas_balance < total_needed:
        print(f"  [WARN] Gas wallet only has {gas_balance:.8f} ETH, need {total_needed:.8f}")
        return None

    return send_eth(gas_acct, to_address, amount_eth)


# ================== DATABASE FUNCTIONS ==================


def get_admin_config() -> Dict:
    """Fetch admin configuration."""
    result = supabase.table("admin_config").select("*").limit(1).execute()
    if result.data:
        return result.data[0]
    raise ValueError("No admin config found! Run setup first.")


def get_pending_invoices() -> List[Dict]:
    """Get all invoices that might need sweeping."""
    result = (
        supabase.table("invoices")
        .select("*, merchants(name, derived_wallet_address, external_wallet_address)")
        .in_("status", ["pending", "received", "prefunding", "sweeping"])
        .execute()
    )
    return result.data or []


def get_all_invoices(limit: int = 50) -> List[Dict]:
    """Get recent invoices with merchant info."""
    result = (
        supabase.table("invoices")
        .select("*, merchants(name)")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def update_invoice(invoice_id: str, updates: Dict):
    """Update an invoice in the database."""
    supabase.table("invoices").update(updates).eq("id", invoice_id).execute()


# ================== SWEEP LOGIC ==================


def estimate_sweep_cost() -> float:
    """
    Estimate the ETH cost for a sweep transaction on Optimism.
    Includes L2 gas cost + estimated L1 data fee buffer.
    """
    try:
        # Get current gas price (L2)
        gas_price = w3.eth.gas_price
        # Standard ERC20 transfer gas limit (safe upper bound)
        gas_limit = 100000 
        l2_cost = float(w3.from_wei(gas_price * gas_limit, 'ether'))
        
        # L1 data fee estimation (buffer)
        # Optimism L1 fee varies but 0.00015 ETH is a safe conservative upper bound for a simple transfer
        l1_buffer = 0.00015
        
        total_estimated = l2_cost + l1_buffer
        return total_estimated
    except Exception as e:
        print(f"  [WARN] Failed to estimate gas cost: {e}")
        return 0.0003  # Fallback


def check_and_sweep_invoice(invoice: Dict, config: Dict) -> bool:
    """
    Check a single invoice and sweep if paid.
    Sweeps ALL USDT to the master wallet.
    Returns True if swept successfully.
    """
    invoice_id = invoice["id"]
    wallet_address = invoice["wallet_address"]
    derivation_index = invoice["derivation_index"]
    amount_expected = float(invoice["amount_expected"])
    status = invoice["status"]
    merchant = invoice.get("merchants", {})
    merchant_name = merchant.get("name", "Unknown") if merchant else "Unknown"

    print(f"\n--- Invoice {invoice_id[:8]}... (Merchant: {merchant_name}) ---")
    print(f"  Status: {status} | Expected: {amount_expected} USDT")
    print(f"  Wallet: {wallet_address}")

    usdt_balance = get_usdt_balance(wallet_address)
    eth_balance = get_eth_balance(wallet_address)
    print(f"  Balance: {usdt_balance:.6f} USDT, {eth_balance:.6f} ETH")

    update_invoice(invoice_id, {"current_balance": str(usdt_balance)})

    if usdt_balance < amount_expected * 0.99:
        print(f"  Waiting... ({usdt_balance:.2f} / {amount_expected:.2f})")
        return False

    master_wallet = config["master_wallet_address"]
    print(f"  Fully paid! Sweeping {usdt_balance:.4f} USDT -> {master_wallet[:12]}...")

    # Step 1: Calculate gas and prefund if needed
    estimated_gas_cost = estimate_sweep_cost()
    required_eth = estimated_gas_cost * 1.5  # 1.5x Safety margin
    
    if eth_balance < required_eth:
        needed = required_eth - eth_balance
        # Ensure we prefund at least a sensible minimum to avoid tiny dust transfers
        prefund_amount = max(needed, 0.0002)
        
        print(f"  Prefunding {prefund_amount:.6f} ETH for gas (est cost: {estimated_gas_cost:.6f})...")
        
        prefund_tx = prefund_with_eth(wallet_address, prefund_amount)
        if not prefund_tx:
            print(f"  [ERROR] Prefunding failed!")
            update_invoice(invoice_id, {"status": "prefunding"})
            return False

        update_invoice(
            invoice_id,
            {
                "status": "prefunding",
                "gas_prefund_tx_hash": prefund_tx,
                "gas_prefund_amount": str(prefund_amount),
            },
        )

        print(f"  Waiting for ETH prefund to confirm...")
        time.sleep(5)

    # Derive the invoice wallet's private key
    _, invoice_acct = derive_invoice_wallet(derivation_index)

    # Step 2: Sweep to master wallet
    update_invoice(invoice_id, {"status": "sweeping"})

    sweep_tx = send_usdt(invoice_acct, master_wallet, usdt_balance)
    if sweep_tx:
        update_invoice(
            invoice_id,
            {
                "status": "completed",
                "merchant_tx_hash": sweep_tx, # Storing main tx hash here
                "commission_amount": "0",
                "merchant_amount": str(usdt_balance),
            },
        )
        print(f"  ✅ Sweep complete!")
        return True
    else:
        print(f"  [ERROR] Sweep transfer failed!")
        return False


# ================== MERCHANT SWEEP ==================


def sweep_merchant_to_external(merchant_id: str):
    """Sweep all USDT from a merchant's derived wallet to their external wallet."""
    result = (
        supabase.table("merchants")
        .select("*")
        .eq("id", merchant_id)
        .single()
        .execute()
    )
    merchant = result.data

    if not merchant:
        print(f"Merchant {merchant_id} not found!")
        return

    derived_address = merchant["derived_wallet_address"]
    external_address = merchant.get("external_wallet_address", "")
    derivation_index = merchant["derivation_index"]

    if not external_address:
        print(f"No external wallet set for merchant {merchant['name']}!")
        return

    print(f"\n=== Sweeping Merchant: {merchant['name']} ===")
    print(f"  Derived: {derived_address}")
    print(f"  External: {external_address}")

    usdt_balance = get_usdt_balance(derived_address)
    eth_balance = get_eth_balance(derived_address)
    print(f"  Balance: {usdt_balance:.4f} USDT, {eth_balance:.6f} ETH")

    if usdt_balance < 0.01:
        print(f"  No USDT to sweep.")
        return

    # Prefund with ETH if gas is too low
    if eth_balance < 0.0003:
        print(f"  Prefunding with ETH for gas...")
        prefund_with_eth(derived_address)
        time.sleep(5)

    _, merchant_acct = derive_merchant_wallet(derivation_index)
    tx = send_usdt(merchant_acct, external_address, usdt_balance)
    if tx:
        print(f"  ✅ Swept {usdt_balance:.4f} USDT to external wallet")
    else:
        print(f"  ❌ Sweep failed!")


# ================== DISPLAY FUNCTIONS ==================


def list_invoices():
    """List all recent invoices."""
    invoices = get_all_invoices(50)
    if not invoices:
        print("No invoices found.")
        return

    print(f"\n{'='*100}")
    print(f"{'ID':<10} {'Status':<12} {'Expected':<12} {'Balance':<12} {'Merchant':<20} {'Created':<20}")
    print(f"{'='*100}")

    for inv in invoices:
        merchant = inv.get("merchants", {})
        merchant_name = merchant.get("name", "N/A") if merchant else "N/A"
        print(
            f"{inv['id'][:8]:<10} "
            f"{inv['status']:<12} "
            f"{float(inv['amount_expected']):<12.4f} "
            f"{float(inv.get('current_balance', 0)):<12.4f} "
            f"{merchant_name:<20} "
            f"{inv['created_at'][:19]:<20}"
        )


def list_merchants():
    """List all merchants with balances."""
    result = (
        supabase.table("merchants")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    merchants = result.data or []

    if not merchants:
        print("No merchants found.")
        return

    print(f"\n{'='*110}")
    print(f"{'Name':<20} {'Active':<8} {'Derived Wallet':<44} {'USDT':<12} {'ETH':<14}")
    print(f"{'='*110}")

    for m in merchants:
        usdt = get_usdt_balance(m["derived_wallet_address"])
        eth = get_eth_balance(m["derived_wallet_address"])
        print(
            f"{m['name']:<20} "
            f"{'Y' if m['is_active'] else 'N':<8} "
            f"{m['derived_wallet_address']:<44} "
            f"{usdt:<12.4f} "
            f"{eth:<14.6f}"
        )


def check_gas_wallet():
    """Show gas wallet status."""
    gas_address, _ = derive_invoice_wallet(0)
    eth = get_eth_balance(gas_address)
    usdt = get_usdt_balance(gas_address)

    print(f"\n=== Gas Wallet ===")
    print(f"  Address: {gas_address}")
    print(f"  ETH Balance: {eth:.6f} ETH")
    print(f"  USDT Balance: {usdt:.6f} USDT")
    print(f"  Explorer: https://optimistic.etherscan.io/address/{gas_address}")
    print(f"  Status: {'✅ Funded' if eth > 0.001 else '⚠️  LOW - needs funding!'}")


def sweep_all_pending():
    """Check and sweep all eligible invoices."""
    config = get_admin_config()
    invoices = get_pending_invoices()

    if not invoices:
        print("No pending invoices to process.")
        return

    print(f"\nProcessing {len(invoices)} pending invoices...")
    print(f"Commission rate: {config.get('commission_rate', 5)}%")
    print(f"Master wallet: {config['master_wallet_address']}")

    swept = 0
    for invoice in invoices:
        try:
            if check_and_sweep_invoice(invoice, config):
                swept += 1
        except Exception as e:
            print(f"  [ERROR] {e}")

    print(f"\nSwept {swept}/{len(invoices)} invoices")


# ================== MAIN MENU ==================


def main():
    """Interactive menu."""
    print("=" * 60)
    print("  Optimism USDT ERC20 Gateway - Recovery & Sweep Tool")
    print("=" * 60)

    while True:
        print("\n--- Menu ---")
        print("1. Check gas wallet status")
        print("2. List recent invoices")
        print("3. List merchants & balances")
        print("4. Sweep all pending invoices")
        print("5. Sweep specific merchant to external wallet")
        print("6. Prefund a wallet with ETH")
        print("7. Check specific invoice wallet balance")
        print("0. Exit")

        choice = input("\nChoice: ").strip()

        if choice == "1":
            check_gas_wallet()

        elif choice == "2":
            list_invoices()

        elif choice == "3":
            list_merchants()

        elif choice == "4":
            sweep_all_pending()

        elif choice == "5":
            merchant_id = input("Enter merchant ID: ").strip()
            if merchant_id:
                sweep_merchant_to_external(merchant_id)

        elif choice == "6":
            address = input("Enter address to prefund: ").strip()
            amount = input("Enter ETH amount (0 = auto-estimate): ").strip()
            amount_eth = float(amount) if amount else 0.0
            prefund_with_eth(address, amount_eth)

        elif choice == "7":
            index = input("Enter derivation index: ").strip()
            if index.isdigit():
                addr, _ = derive_invoice_wallet(int(index))
                print(f"  Address: {addr}")
                print(f"  USDT: {get_usdt_balance(addr):.6f}")
                print(f"  ETH:  {get_eth_balance(addr):.6f}")
                print(f"  Explorer: https://optimistic.etherscan.io/address/{addr}")

        elif choice == "0":
            print("Bye!")
            break

        else:
            print("Invalid choice.")


if __name__ == "__main__":
    main()
