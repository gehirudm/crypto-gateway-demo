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

# Default prefund amount in ETH (enough for ~2 ERC20 transfers on Optimism L2)
DEFAULT_PREFUND_ETH = 0.002

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


def prefund_with_eth(to_address: str, amount_eth: float = DEFAULT_PREFUND_ETH) -> Optional[str]:
    """Prefund a wallet with ETH from the gas wallet (index 0)."""
    gas_address, gas_acct = derive_invoice_wallet(0)
    gas_balance = get_eth_balance(gas_address)

    if gas_balance < amount_eth + 0.0005:
        print(f"  [WARN] Gas wallet only has {gas_balance:.6f} ETH, need {amount_eth + 0.0005:.6f}")
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


def check_and_sweep_invoice(invoice: Dict, config: Dict) -> bool:
    """
    Check a single invoice and sweep if paid.
    Splits USDT: commission -> master wallet, remainder -> merchant wallet.
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

    # Calculate commission split
    commission_rate = float(config.get("commission_rate", 5.0))
    commission_amount = usdt_balance * (commission_rate / 100.0)
    merchant_amount = usdt_balance - commission_amount
    master_wallet = config["master_wallet_address"]
    merchant_wallet = merchant.get("derived_wallet_address", "") if merchant else ""

    print(f"  Fully paid! Sweeping...")
    print(f"  Commission: {commission_amount:.4f} USDT ({commission_rate}%) -> {master_wallet[:12]}...")
    print(f"  Merchant:   {merchant_amount:.4f} USDT -> {merchant_wallet[:12] if merchant_wallet else 'N/A'}...")

    if not merchant_wallet:
        print(f"  [ERROR] No merchant wallet address found!")
        return False

    # Step 1: Prefund with ETH for gas if needed
    if eth_balance < 0.0005:
        print(f"  Prefunding with ETH for gas...")
        prefund_tx = prefund_with_eth(wallet_address)
        if not prefund_tx:
            print(f"  [ERROR] Prefunding failed!")
            update_invoice(invoice_id, {"status": "prefunding"})
            return False

        update_invoice(
            invoice_id,
            {
                "status": "prefunding",
                "gas_prefund_tx_hash": prefund_tx,
                "gas_prefund_amount": str(DEFAULT_PREFUND_ETH),
            },
        )

        print(f"  Waiting for ETH prefund to confirm...")
        time.sleep(5)

    # Derive the invoice wallet's private key
    _, invoice_acct = derive_invoice_wallet(derivation_index)

    # Step 2: Send commission to master wallet
    update_invoice(invoice_id, {"status": "sweeping"})

    commission_tx = None
    if commission_amount > 0.01:
        commission_tx = send_usdt(invoice_acct, master_wallet, commission_amount)
        if commission_tx:
            update_invoice(invoice_id, {"commission_tx_hash": commission_tx})
            print(f"  Waiting between transfers...")
            time.sleep(5)
        else:
            print(f"  [ERROR] Commission transfer failed!")
            return False

    # Step 3: Send remainder to merchant derived wallet
    merchant_tx = send_usdt(invoice_acct, merchant_wallet, merchant_amount)
    if merchant_tx:
        update_invoice(
            invoice_id,
            {
                "status": "completed",
                "merchant_tx_hash": merchant_tx,
                "commission_amount": str(commission_amount),
                "merchant_amount": str(merchant_amount),
            },
        )
        print(f"  ✅ Sweep complete!")
        return True
    else:
        print(f"  [ERROR] Merchant transfer failed!")
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
        prefund_with_eth(derived_address, DEFAULT_PREFUND_ETH / 2)
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
            amount = input(f"Enter ETH amount (default {DEFAULT_PREFUND_ETH}): ").strip()
            amount_eth = float(amount) if amount else DEFAULT_PREFUND_ETH
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
