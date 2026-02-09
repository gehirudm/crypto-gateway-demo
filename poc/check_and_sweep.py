"""
TRON USDT TRC20 Recovery & Sweep Script

This script provides standalone recovery and sweep operations for the
TRON-based payment gateway. It can:

1. Derive invoice/merchant wallets from the master mnemonic
2. Check USDT (TRC20) and TRX balances
3. Sweep stuck invoices (USDT -> commission to master + remainder to merchant)
4. Prefund wallets with TRX for gas
5. List all invoices and their statuses

Dependencies:
    pip install tronpy mnemonic supabase python-dotenv

Usage:
    python check_and_sweep.py
"""

import os
import time
import hashlib
import hmac
import struct
from typing import List, Dict, Optional, Tuple
from tronpy import Tron
from tronpy.keys import PrivateKey
from supabase import create_client, Client
from dotenv import load_dotenv
from mnemonic import Mnemonic

load_dotenv()

# ---------------- CONFIG ----------------
TRON_API_URL = os.getenv("TRON_RPC_URL", "https://api.trongrid.io")
TRON_API_KEY = os.getenv("TRON_API_KEY", "")
USDT_CONTRACT = os.getenv("TRON_USDT_CONTRACT", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")

MNEMONIC = os.getenv("TRON_MASTER_MNEMONIC")
if not MNEMONIC:
    raise ValueError("TRON_MASTER_MNEMONIC not set in environment variables")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Fee limit for TRC20 transfers (in SUN) - 150 TRX
FEE_LIMIT = 150_000_000
SUN_PER_TRX = 1_000_000
DEFAULT_PREFUND_TRX = 80  # Enough for ~2 USDT transfers

# Create Tron client
client = Tron(network="mainnet")


# ================== BIP32 HD KEY DERIVATION ==================

SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
HARDENED_OFFSET = 0x80000000


def _hmac_sha512(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha512).digest()


def _derive_master_key(seed: bytes) -> Tuple[bytes, bytes]:
    """Derive master private key and chain code from seed."""
    I = _hmac_sha512(b"Bitcoin seed", seed)
    return I[:32], I[32:]


def _derive_child_key_hardened(
    parent_key: bytes, parent_chain: bytes, index: int
) -> Tuple[bytes, bytes]:
    """Derive a hardened child key."""
    data = b"\x00" + parent_key + struct.pack(">I", index)
    I = _hmac_sha512(parent_chain, data)
    child_key_int = (
        int.from_bytes(I[:32], "big") + int.from_bytes(parent_key, "big")
    ) % SECP256K1_ORDER
    child_key = child_key_int.to_bytes(32, "big")
    return child_key, I[32:]


def _derive_child_key_normal(
    parent_key: bytes, parent_chain: bytes, index: int
) -> Tuple[bytes, bytes]:
    """Derive a normal (non-hardened) child key using the compressed public key."""
    priv = PrivateKey(parent_key)
    # Get compressed public key (33 bytes)
    pub_hex = priv.public_key.hex()
    pub_bytes = bytes.fromhex(pub_hex)

    data = pub_bytes + struct.pack(">I", index)
    I = _hmac_sha512(parent_chain, data)
    child_key_int = (
        int.from_bytes(I[:32], "big") + int.from_bytes(parent_key, "big")
    ) % SECP256K1_ORDER
    child_key = child_key_int.to_bytes(32, "big")
    return child_key, I[32:]


def derive_wallet(mnemonic_phrase: str, path: str) -> Tuple[str, bytes]:
    """
    Derive a TRON wallet address and private key from mnemonic and BIP44 path.

    Path format: m/44'/195'/account'/change/index
    For invoices: m/44'/195'/0'/0/index (index 0 = gas wallet)
    For merchants: m/44'/195'/1'/0/index
    """
    mnemo = Mnemonic("english")
    seed = mnemo.to_seed(mnemonic_phrase, passphrase="")

    components = path.replace("m/", "").split("/")
    key, chain = _derive_master_key(seed)

    for comp in components:
        if comp.endswith("'"):
            idx = int(comp[:-1]) + HARDENED_OFFSET
            key, chain = _derive_child_key_hardened(key, chain, idx)
        else:
            idx = int(comp)
            key, chain = _derive_child_key_normal(key, chain, idx)

    priv = PrivateKey(key)
    address = priv.public_key.to_base58check_address()

    return address, key


def derive_invoice_wallet(index: int) -> Tuple[str, bytes]:
    """Derive invoice wallet. Index 0 = gas wallet, 1+ = invoices."""
    return derive_wallet(MNEMONIC, f"m/44'/195'/0'/0/{index}")


def derive_merchant_wallet(index: int) -> Tuple[str, bytes]:
    """Derive merchant wallet at separate account path."""
    return derive_wallet(MNEMONIC, f"m/44'/195'/1'/0/{index}")


# ================== BALANCE FUNCTIONS ==================


def get_trx_balance(address: str) -> float:
    """Get TRX balance of an address in TRX units."""
    try:
        balance = client.get_account_balance(address)
        return float(balance)
    except Exception:
        return 0.0


def get_usdt_balance(address: str) -> float:
    """Get USDT TRC20 balance in USDT units (6 decimals)."""
    try:
        contract = client.get_contract(USDT_CONTRACT)
        raw = contract.functions.balanceOf(address)
        return float(raw) / 1e6
    except Exception as e:
        print(f"  [WARN] Failed to get USDT balance for {address}: {e}")
        return 0.0


# ================== TRANSFER FUNCTIONS ==================


def send_trx(from_key: bytes, to_address: str, amount_trx: float) -> Optional[str]:
    """Send TRX from a wallet. Returns txid or None."""
    try:
        priv = PrivateKey(from_key)
        from_address = priv.public_key.to_base58check_address()
        amount_sun = int(amount_trx * SUN_PER_TRX)

        txn = (
            client.trx.transfer(from_address, to_address, amount_sun)
            .build()
            .sign(priv)
        )
        result = txn.broadcast()
        txid = result.get("txid", "")
        print(f"  [TRX] Sent {amount_trx} TRX -> {to_address} | txid: {txid}")
        return txid
    except Exception as e:
        print(f"  [ERROR] Failed to send TRX: {e}")
        return None


def send_usdt(
    from_key: bytes, to_address: str, amount_usdt: float
) -> Optional[str]:
    """Send USDT TRC20 from a wallet. Returns txid or None."""
    try:
        priv = PrivateKey(from_key)
        from_address = priv.public_key.to_base58check_address()
        raw_amount = int(amount_usdt * 1e6)

        contract = client.get_contract(USDT_CONTRACT)
        txn = (
            contract.functions.transfer(to_address, raw_amount)
            .with_owner(from_address)
            .fee_limit(FEE_LIMIT)
            .build()
            .sign(priv)
        )
        result = txn.broadcast()
        txid = result.get("txid", "")
        print(f"  [USDT] Sent {amount_usdt:.4f} USDT -> {to_address} | txid: {txid}")
        return txid
    except Exception as e:
        print(f"  [ERROR] Failed to send USDT: {e}")
        return None


def prefund_with_trx(to_address: str, amount_trx: float = DEFAULT_PREFUND_TRX) -> Optional[str]:
    """Prefund a wallet with TRX from the gas wallet."""
    gas_address, gas_key = derive_invoice_wallet(0)
    gas_balance = get_trx_balance(gas_address)

    if gas_balance < amount_trx + 2:
        print(f"  [WARN] Gas wallet only has {gas_balance:.2f} TRX, need {amount_trx + 2}")
        return None

    return send_trx(gas_key, to_address, amount_trx)


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
        .in_("status", ["pending", "confirming", "prefunding", "sweeping"])
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
    trx_balance = get_trx_balance(wallet_address)
    print(f"  Balance: {usdt_balance:.6f} USDT, {trx_balance:.2f} TRX")

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
    print(f"  Commission: {commission_amount:.4f} USDT ({commission_rate}%) -> {master_wallet[:10]}...")
    print(f"  Merchant:   {merchant_amount:.4f} USDT -> {merchant_wallet[:10] if merchant_wallet else 'N/A'}...")

    if not merchant_wallet:
        print(f"  [ERROR] No merchant wallet address found!")
        return False

    # Step 1: Prefund with TRX if needed
    if trx_balance < 20:
        print(f"  Prefunding with TRX...")
        prefund_tx = prefund_with_trx(wallet_address)
        if not prefund_tx:
            print(f"  [ERROR] Prefunding failed!")
            update_invoice(invoice_id, {"status": "prefunding"})
            return False

        update_invoice(invoice_id, {
            "status": "prefunding",
            "gas_prefund_tx_hash": prefund_tx,
            "gas_prefund_amount": str(DEFAULT_PREFUND_TRX),
        })

        print(f"  Waiting for TRX prefund to confirm...")
        time.sleep(10)

    # Derive the invoice wallet's private key
    _, invoice_key = derive_invoice_wallet(derivation_index)

    # Step 2: Send commission to master wallet
    update_invoice(invoice_id, {"status": "sweeping"})

    commission_tx = None
    if commission_amount > 0.01:
        commission_tx = send_usdt(invoice_key, master_wallet, commission_amount)
        if commission_tx:
            update_invoice(invoice_id, {"commission_tx_hash": commission_tx})
            print(f"  Waiting between transfers...")
            time.sleep(8)
        else:
            print(f"  [ERROR] Commission transfer failed!")
            return False

    # Step 3: Send remainder to merchant derived wallet
    merchant_tx = send_usdt(invoice_key, merchant_wallet, merchant_amount)
    if merchant_tx:
        update_invoice(invoice_id, {
            "status": "completed",
            "merchant_tx_hash": merchant_tx,
            "commission_amount": str(commission_amount),
            "merchant_amount": str(merchant_amount),
        })
        print(f"  Sweep complete!")
        return True
    else:
        print(f"  [ERROR] Merchant transfer failed!")
        return False


# ================== MERCHANT SWEEP ==================


def sweep_merchant_to_external(merchant_id: str):
    """Sweep all USDT from a merchant's derived wallet to their external wallet."""
    result = supabase.table("merchants").select("*").eq("id", merchant_id).single().execute()
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
    trx_balance = get_trx_balance(derived_address)
    print(f"  Balance: {usdt_balance:.4f} USDT, {trx_balance:.2f} TRX")

    if usdt_balance < 0.01:
        print(f"  No USDT to sweep.")
        return

    if trx_balance < 15:
        print(f"  Prefunding with TRX...")
        prefund_with_trx(derived_address, DEFAULT_PREFUND_TRX)
        time.sleep(10)

    _, merchant_key = derive_merchant_wallet(derivation_index)
    tx = send_usdt(merchant_key, external_address, usdt_balance)
    if tx:
        print(f"  Swept {usdt_balance:.4f} USDT to external wallet")
    else:
        print(f"  Sweep failed!")


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
    result = supabase.table("merchants").select("*").order("created_at", desc=True).execute()
    merchants = result.data or []

    if not merchants:
        print("No merchants found.")
        return

    print(f"\n{'='*100}")
    print(f"{'Name':<20} {'Active':<8} {'Derived Wallet':<36} {'USDT':<12} {'TRX':<12}")
    print(f"{'='*100}")

    for m in merchants:
        usdt = get_usdt_balance(m["derived_wallet_address"])
        trx = get_trx_balance(m["derived_wallet_address"])
        print(
            f"{m['name']:<20} "
            f"{'Y' if m['is_active'] else 'N':<8} "
            f"{m['derived_wallet_address']:<36} "
            f"{usdt:<12.4f} "
            f"{trx:<12.2f}"
        )


def check_gas_wallet():
    """Show gas wallet status."""
    gas_address, _ = derive_invoice_wallet(0)
    trx = get_trx_balance(gas_address)
    usdt = get_usdt_balance(gas_address)

    print(f"\n=== Gas Wallet ===")
    print(f"  Address: {gas_address}")
    print(f"  TRX Balance: {trx:.2f} TRX")
    print(f"  USDT Balance: {usdt:.6f} USDT")
    print(f"  Status: {'Funded' if trx > 10 else 'LOW - needs funding!'}")


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
    print("  TRON USDT TRC20 Payment Gateway - Recovery & Sweep Tool")
    print("=" * 60)

    while True:
        print("\n--- Menu ---")
        print("1. Check gas wallet status")
        print("2. List recent invoices")
        print("3. List merchants & balances")
        print("4. Sweep all pending invoices")
        print("5. Sweep specific merchant to external wallet")
        print("6. Prefund a wallet with TRX")
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
            address = input("Enter TRON address to prefund: ").strip()
            amount = input(f"Enter TRX amount (default {DEFAULT_PREFUND_TRX}): ").strip()
            amount_trx = float(amount) if amount else DEFAULT_PREFUND_TRX
            prefund_with_trx(address, amount_trx)

        elif choice == "7":
            index = input("Enter derivation index: ").strip()
            if index.isdigit():
                addr, _ = derive_invoice_wallet(int(index))
                print(f"  Address: {addr}")
                print(f"  USDT: {get_usdt_balance(addr):.6f}")
                print(f"  TRX:  {get_trx_balance(addr):.2f}")

        elif choice == "0":
            print("Bye!")
            break

        else:
            print("Invalid choice.")


if __name__ == "__main__":
    main()
