import json
import time
from pathlib import Path
from web3 import Web3
from eth_account import Account
import qrcode

# ---------------- CONFIG ----------------
Account.enable_unaudited_hdwallet_features()

RPC_URL = "https://mainnet.optimism.io"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

MNEMONIC = "metal high topic pass cannon mushroom gossip dizzy match quality wear thunder"

MASTER_ADDRESS = "0x3960a057230648EE68c7EE8050c1714Ed8C67562"

INVOICE_FILE = Path("invoices.json")

EXPECTED_ETH = 0.00025        # change as needed
CONFIRMATIONS_REQUIRED = 3
GAS_LIMIT = 21000
GAS_MULTIPLIER = 1.3
POLL_INTERVAL = 5
# ----------------------------------------


def load_invoices():
    if INVOICE_FILE.exists():
        return json.loads(INVOICE_FILE.read_text())
    return []


def save_invoices(invoices):
    INVOICE_FILE.write_text(json.dumps(invoices, indent=2))


def derive_wallet(index):
    return Account.from_mnemonic(
        MNEMONIC,
        account_path=f"m/44'/60'/0'/0/{index}"
    )


def create_invoice(expected_eth):
    invoices = load_invoices()
    index = len(invoices) + 1

    acct = derive_wallet(index)

    invoice = {
        "invoice_id": index,
        "derivation_index": index,
        "address": acct.address,
        "expected_eth": expected_eth,
        "status": "pending",
        "created_at": int(time.time())
    }

    invoices.append(invoice)
    save_invoices(invoices)

    return invoice


def wait_for_payment(invoice):
    print(f"Waiting for payment to {invoice['address']}")

    while True:
        balance = w3.eth.get_balance(invoice["address"])
        eth_balance = w3.from_wei(balance, "ether")

        print(f"Current balance: {eth_balance} ETH", end="\r")

        if float(eth_balance) >= float(invoice["expected_eth"]):
            print(f"\n✅ Payment detected: {eth_balance} ETH")
            return balance

        time.sleep(POLL_INTERVAL)


def sweep_invoice(invoice):
    acct = derive_wallet(invoice["derivation_index"])

    balance = w3.eth.get_balance(acct.address)
    gas_price = w3.eth.gas_price
    
    # Use 1.5x buffer to account for gas price fluctuations
    gas_cost = int(gas_price * GAS_LIMIT * GAS_MULTIPLIER * 1.5)

    value = balance - gas_cost
    if value <= 0:
        raise Exception("Not enough ETH to cover gas for sweep")

    print(f"\n💸 Sweeping funds...")
    print(f"  Balance: {w3.from_wei(balance, 'ether')} ETH")
    print(f"  Gas cost (with buffer): {w3.from_wei(gas_cost, 'ether')} ETH")
    print(f"  Net amount: {w3.from_wei(value, 'ether')} ETH")

    tx = {
        "to": MASTER_ADDRESS,
        "value": value,
        "gas": GAS_LIMIT,
        "gasPrice": int(gas_price * GAS_MULTIPLIER),
        "nonce": w3.eth.get_transaction_count(acct.address),
        "chainId": w3.eth.chain_id,
    }

    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    print(f"📤 Sweep transaction sent: {tx_hash.hex()}")
    return tx_hash


def wait_for_confirmations(tx_hash):
    print("⏳ Waiting for confirmations...")
    while True:
        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            if receipt and receipt.blockNumber:
                confirmations = w3.eth.block_number - receipt.blockNumber
                print(f"Confirmations: {confirmations}/{CONFIRMATIONS_REQUIRED}", end="\r")
                if confirmations >= CONFIRMATIONS_REQUIRED:
                    print(f"\n✅ Sweep confirmed with {confirmations} confirmations")
                    return
        except Exception:
            # Transaction not mined yet, keep waiting
            pass
        time.sleep(POLL_INTERVAL)


# ---------------- MAIN ----------------

invoice = create_invoice(EXPECTED_ETH)

print("\n=== NEW PAYMENT INVOICE ===")
print("Invoice ID:", invoice["invoice_id"])
print("Send ETH (Optimism) to:", invoice["address"])
print("Amount:", invoice["expected_eth"], "ETH\n")

# Display QR code for payment address
qr = qrcode.QRCode()
qr.add_data(invoice["address"])
qr.print_ascii(invert=True)
print()

wait_for_payment(invoice)

tx_hash = sweep_invoice(invoice)
wait_for_confirmations(tx_hash)

# Update invoice status
invoices = load_invoices()
for inv in invoices:
    if inv["invoice_id"] == invoice["invoice_id"]:
        inv["status"] = "swept"
save_invoices(invoices)

print("\n✅ PAYMENT COMPLETE")
print(f"💰 Funds transferred to: {MASTER_ADDRESS}")