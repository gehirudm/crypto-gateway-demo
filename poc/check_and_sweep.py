import os
import time
from typing import List, Dict, Optional
from web3 import Web3
from eth_account import Account
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ---------------- CONFIG ----------------
Account.enable_unaudited_hdwallet_features()

RPC_URL = os.getenv("NEXT_PUBLIC_RPC_URL", "https://mainnet.optimism.io")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

MNEMONIC = os.getenv("MASTER_MNEMONIC")
if not MNEMONIC:
    raise ValueError("MASTER_MNEMONIC not set in environment variables")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# USDC contract address on Optimism Mainnet
USDC_CONTRACT_ADDRESS = os.getenv("NEXT_PUBLIC_USDC_CONTRACT_ADDRESS", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85")

# ERC-20 ABI (minimal for balanceOf + transfer)
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
]

usdc_contract = w3.eth.contract(
    address=Web3.to_checksum_address(USDC_CONTRACT_ADDRESS), abi=ERC20_ABI
)

CONFIRMATIONS_REQUIRED = 6
ETH_GAS_LIMIT = 21000
USDC_GAS_LIMIT = 65000  # ERC-20 transfers use ~65k gas
GAS_BUFFER = 1.5  # 50% buffer on all gas estimates
POLL_INTERVAL = 5
# ----------------------------------------


def get_master_wallet_address() -> str:
    """Get master wallet address from admin config in Supabase"""
    response = supabase.table("admin_config").select("*").eq("id", "default").execute()

    if not response.data or len(response.data) == 0:
        raise ValueError("Master wallet not configured in admin_config table")

    master_address = response.data[0].get("master_wallet_address")
    if not master_address:
        raise ValueError("master_wallet_address not set in admin_config")

    return master_address


def load_invoices() -> List[Dict]:
    """Load all invoices from Supabase"""
    response = (
        supabase.table("invoices").select("*").order("created_at", desc=True).execute()
    )
    return response.data if response.data else []


def update_invoice_status(
    invoice_id: str, status: str, sweep_tx_hash: Optional[str] = None
):
    """Update invoice status in Supabase"""
    update_data = {
        "status": status,
        "last_checked_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }

    if sweep_tx_hash:
        update_data["sweep_tx_hash"] = sweep_tx_hash

    supabase.table("invoices").update(update_data).eq("id", invoice_id).execute()


def derive_wallet(index):
    """
    Derive wallet using the same method as the TypeScript code.
    Must match ethers.js HDNodeWallet.fromMnemonic(mnemonic, path) behavior.
    """
    account_path = f"m/44'/60'/0'/0/{index}"
    account = Account.from_mnemonic(MNEMONIC, account_path=account_path)
    return account


def get_gas_wallet():
    """Get the gas wallet (derivation index 0) - same as main app"""
    return derive_wallet(0)


def get_usdc_balance(address: str) -> int:
    """Get USDC balance of an address (raw units, 6 decimals)"""
    return usdc_contract.functions.balanceOf(
        Web3.to_checksum_address(address)
    ).call()


def get_usdc_balance_formatted(address: str) -> float:
    """Get USDC balance of an address as a float"""
    raw = get_usdc_balance(address)
    return raw / 1e6


def display_invoices(invoices: List[Dict]):
    """Display invoices with current balances"""
    print("\n=== AVAILABLE INVOICES ===")
    for inv in invoices:
        address = inv["wallet_address"]
        eth_balance_wei = w3.eth.get_balance(address)
        eth_balance = w3.from_wei(eth_balance_wei, "ether")

        currency = inv["currency"]
        expected = inv["amount_expected"]

        # Verify derivation
        derived = derive_wallet(inv["derivation_index"])
        address_match = (
            "✓" if derived.address.lower() == address.lower() else "✗ MISMATCH!"
        )

        # Get currency-specific balance
        if currency == "USDC":
            usdc_balance = get_usdc_balance_formatted(address)
            balance_str = f"{usdc_balance:.6f} USDC (+ {eth_balance:.8f} ETH for gas)"
        else:
            balance_str = f"{eth_balance} ETH"

        print(f"\nInvoice ID: {inv['id'][:8]}...")
        print(f"  Full ID: {inv['id']}")
        print(f"  Address: {address}")
        print(f"  Derived: {derived.address} {address_match}")
        print(f"  Currency: {currency}")
        print(f"  Expected: {expected} {currency}")
        print(f"  Balance: {balance_str}")
        print(f"  Status: {inv['status']}")
        print(f"  Derivation Index: {inv['derivation_index']}")
        print(f"  Created: {inv['created_at']}")
    print()


def wait_for_payment(invoice: Dict):
    """Monitor wallet for incoming payment"""
    address = invoice["wallet_address"]
    expected = float(invoice["amount_expected"])
    currency = invoice["currency"]

    print(f"\nMonitoring wallet: {address}")
    print(f"Expected amount: {expected} {currency}")
    print("Checking for incoming payments...\n")

    while True:
        if currency == "ETH":
            balance_wei = w3.eth.get_balance(address)
            balance = float(w3.from_wei(balance_wei, "ether"))
            print(f"  Current balance: {balance:.8f} ETH", end="\r")

            if balance >= expected:
                print(f"\n✅ Payment detected: {balance} ETH")
                return
        elif currency == "USDC":
            usdc_balance = get_usdc_balance_formatted(address)
            print(f"  Current USDC balance: {usdc_balance:.6f} USDC", end="\r")

            if usdc_balance >= expected:
                print(f"\n✅ USDC Payment detected: {usdc_balance:.6f} USDC")
                return

        time.sleep(POLL_INTERVAL)


def prefund_invoice_wallet(invoice_address: str):
    """
    Send ETH from the gas wallet (index 0) to the invoice wallet
    to cover gas fees for a USDC transfer.
    Uses 50% buffer on estimated gas cost.
    """
    gas_wallet = get_gas_wallet()
    gas_price = w3.eth.gas_price

    # Estimate how much ETH the invoice wallet needs for a USDC transfer
    usdc_transfer_cost = gas_price * USDC_GAS_LIMIT
    amount_to_send = int(usdc_transfer_cost * GAS_BUFFER)  # 50% buffer

    print(f"\n⛽ Prefunding invoice wallet with ETH for gas...")
    print(f"  Gas wallet: {gas_wallet.address}")
    print(f"  Invoice wallet: {invoice_address}")
    print(f"  Estimated USDC transfer gas: {w3.from_wei(usdc_transfer_cost, 'ether'):.10f} ETH")
    print(f"  Sending (with 50% buffer): {w3.from_wei(amount_to_send, 'ether'):.10f} ETH")

    # Check gas wallet balance
    gas_wallet_balance = w3.eth.get_balance(gas_wallet.address)
    eth_transfer_cost = int(gas_price * ETH_GAS_LIMIT * GAS_BUFFER)
    total_needed = amount_to_send + eth_transfer_cost

    if gas_wallet_balance < total_needed:
        raise Exception(
            f"Gas wallet insufficient balance. "
            f"Has: {w3.from_wei(gas_wallet_balance, 'ether')} ETH, "
            f"Needs: {w3.from_wei(total_needed, 'ether')} ETH"
        )

    tx = {
        "to": Web3.to_checksum_address(invoice_address),
        "value": amount_to_send,
        "gas": ETH_GAS_LIMIT,
        "gasPrice": gas_price,
        "nonce": w3.eth.get_transaction_count(gas_wallet.address),
        "chainId": w3.eth.chain_id,
    }

    signed = gas_wallet.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)

    print(f"  📤 Prefund TX sent: {tx_hash.hex()}")

    # Wait for confirmation
    print(f"  ⏳ Waiting for prefund confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status == 1:
        print(f"  ✅ Prefund confirmed in block {receipt.blockNumber}")
    else:
        raise Exception("Prefund transaction failed!")

    return tx_hash


def sweep_invoice(invoice: Dict, master_address: str):
    """Sweep funds from invoice wallet to master wallet"""
    acct = derive_wallet(invoice["derivation_index"])
    currency = invoice["currency"]
    gas_price = w3.eth.gas_price

    if currency == "ETH":
        balance = w3.eth.get_balance(acct.address)

        # For ETH, deduct gas from the amount being sent with 50% buffer
        gas_cost = int(gas_price * ETH_GAS_LIMIT * GAS_BUFFER)
        value = balance - gas_cost

        if value <= 0:
            raise Exception("Not enough ETH to cover gas for sweep")

        print(f"\n💸 Sweeping ETH...")
        print(f"  Balance: {w3.from_wei(balance, 'ether')} ETH")
        print(f"  Gas cost (with 50% buffer): {w3.from_wei(gas_cost, 'ether')} ETH")
        print(f"  Net amount: {w3.from_wei(value, 'ether')} ETH")

        tx = {
            "to": Web3.to_checksum_address(master_address),
            "value": value,
            "gas": ETH_GAS_LIMIT,
            "gasPrice": gas_price,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "chainId": w3.eth.chain_id,
        }

        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)

    elif currency == "USDC":
        # Get USDC balance
        usdc_balance_raw = get_usdc_balance(acct.address)

        if usdc_balance_raw <= 0:
            raise Exception("No USDC balance to sweep")

        usdc_balance_formatted = usdc_balance_raw / 1e6

        # Check ETH balance for gas
        eth_balance = w3.eth.get_balance(acct.address)
        estimated_gas_cost = int(gas_price * USDC_GAS_LIMIT * GAS_BUFFER)

        if eth_balance < estimated_gas_cost:
            raise Exception(
                f"Invoice wallet needs ETH for gas. "
                f"Has: {w3.from_wei(eth_balance, 'ether')} ETH, "
                f"Needs: ~{w3.from_wei(estimated_gas_cost, 'ether')} ETH. "
                f"Run prefunding first."
            )

        print(f"\n💸 Sweeping USDC...")
        print(f"  USDC Balance: {usdc_balance_formatted:.6f} USDC")
        print(f"  ETH for gas: {w3.from_wei(eth_balance, 'ether')} ETH")
        print(f"  Estimated gas cost: {w3.from_wei(estimated_gas_cost, 'ether')} ETH")

        # Build ERC-20 transfer transaction
        transfer_tx = usdc_contract.functions.transfer(
            Web3.to_checksum_address(master_address), usdc_balance_raw
        ).build_transaction(
            {
                "from": acct.address,
                "gas": USDC_GAS_LIMIT,
                "gasPrice": gas_price,
                "nonce": w3.eth.get_transaction_count(acct.address),
                "chainId": w3.eth.chain_id,
            }
        )

        signed = acct.sign_transaction(transfer_tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)

    else:
        raise ValueError(f"Unsupported currency: {currency}")

    print(f"📤 Sweep transaction sent: {tx_hash.hex()}")
    return tx_hash


def wait_for_confirmations(tx_hash):
    print("⏳ Waiting for confirmations...")
    while True:
        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            if receipt and receipt.blockNumber:
                confirmations = w3.eth.block_number - receipt.blockNumber
                print(
                    f"  Confirmations: {confirmations}/{CONFIRMATIONS_REQUIRED}",
                    end="\r",
                )
                if confirmations >= CONFIRMATIONS_REQUIRED:
                    print(
                        f"\n  ✅ Confirmed with {confirmations} confirmations"
                    )
                    if receipt.status != 1:
                        print("  ⚠️  WARNING: Transaction reverted!")
                        return False
                    return True
        except Exception:
            pass
        time.sleep(POLL_INTERVAL)


# ---------------- MAIN ----------------

if __name__ == "__main__":
    try:
        print("\n🔧 Crypto Gateway Recovery Tool")
        print("================================\n")

        # Get master wallet address from database
        master_address = get_master_wallet_address()
        print(f"Master Wallet: {master_address}")

        # Show gas wallet info
        gas_wallet = get_gas_wallet()
        gas_balance = w3.eth.get_balance(gas_wallet.address)
        print(f"Gas Wallet:    {gas_wallet.address}")
        print(f"Gas Balance:   {w3.from_wei(gas_balance, 'ether')} ETH\n")

        # Load invoices from Supabase
        invoices = load_invoices()

        if not invoices:
            print("❌ No invoices found in database")
            exit(1)

        display_invoices(invoices)

        # Ask user which invoice to check
        while True:
            try:
                invoice_id_input = input(
                    "Enter Invoice ID (full or first 8 chars) to monitor and sweep: "
                )

                # Try to find by full ID first, then by prefix
                selected_invoice = next(
                    (
                        inv
                        for inv in invoices
                        if inv["id"] == invoice_id_input
                        or inv["id"].startswith(invoice_id_input)
                    ),
                    None,
                )

                if selected_invoice:
                    break
                else:
                    print(
                        f"❌ Invoice ID {invoice_id_input} not found. Please try again."
                    )
            except KeyboardInterrupt:
                print("\n\n👋 Cancelled by user")
                exit(0)

        currency = selected_invoice["currency"]
        expected = float(selected_invoice["amount_expected"])
        address = selected_invoice["wallet_address"]

        print(f"\n🔍 Selected Invoice ID: {selected_invoice['id']}")
        print(f"📍 Address: {address}")
        print(f"💰 Currency: {currency}")
        print(f"📊 Expected: {expected} {currency}")

        # Check current balance based on currency
        if currency == "ETH":
            current_balance_wei = w3.eth.get_balance(address)
            current_balance = float(w3.from_wei(current_balance_wei, "ether"))
            print(f"💵 Current balance: {current_balance} ETH")

            if current_balance >= expected:
                print(f"✅ Wallet already has sufficient funds!")
            else:
                print(f"⏳ Insufficient funds. Waiting for payment...")
                wait_for_payment(selected_invoice)

        elif currency == "USDC":
            usdc_balance = get_usdc_balance_formatted(address)
            eth_balance = float(
                w3.from_wei(w3.eth.get_balance(address), "ether")
            )
            print(f"💵 Current USDC balance: {usdc_balance:.6f} USDC")
            print(f"⛽ Current ETH balance (for gas): {eth_balance:.10f} ETH")

            if usdc_balance >= expected:
                print(f"✅ Wallet already has sufficient USDC!")
            else:
                print(f"⏳ Insufficient USDC. Waiting for payment...")
                wait_for_payment(selected_invoice)

            # Now check if we need to prefund with ETH for gas
            eth_balance = float(
                w3.from_wei(w3.eth.get_balance(address), "ether")
            )
            gas_price = w3.eth.gas_price
            min_gas_needed = float(
                w3.from_wei(int(gas_price * USDC_GAS_LIMIT * GAS_BUFFER), "ether")
            )

            if eth_balance < min_gas_needed:
                print(
                    f"\n⛽ Invoice wallet needs ETH for gas "
                    f"(has {eth_balance:.10f}, needs ~{min_gas_needed:.10f})"
                )
                prefund_invoice_wallet(address)
            else:
                print(
                    f"✅ Invoice wallet already has enough ETH for gas ({eth_balance:.10f} ETH)"
                )

        # Perform the sweep
        print("\n--- Starting Sweep ---")
        tx_hash = sweep_invoice(selected_invoice, master_address)

        # Wait for confirmations
        success = wait_for_confirmations(tx_hash)

        if success:
            # Update invoice status in Supabase
            update_invoice_status(
                selected_invoice["id"], "completed", tx_hash.hex()
            )

            print("\n✅ SWEEP COMPLETE")
            print(f"💰 Funds transferred to: {master_address}")
            print(f"🔗 Transaction: {tx_hash.hex()}")
        else:
            print("\n❌ Sweep transaction reverted. Manual investigation required.")
            update_invoice_status(selected_invoice["id"], "sweeping")

    except KeyboardInterrupt:
        print("\n\n👋 Cancelled by user")
        exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
        exit(1)
