# API Documentation

Complete reference for all API endpoints in the Crypto Payment Gateway.

## Invoice Endpoints

### Create Invoice

**Endpoint:** `POST /api/invoices/create`

Creates a new invoice with a unique wallet address derived from the master mnemonic.

**Request Body:**
```json
{
  "amount": 0.01,
  "currency": "ETH"
}
```

**Parameters:**
- `amount` (number, required): Payment amount in the specified currency
  - ETH: Can be fractional (e.g., 0.01, 0.5, 1.0)
  - USDT: Can be fractional (e.g., 10.5, 100.0)
- `currency` (string, required): Either "ETH" or "USDT"

**Response (Success):**
```json
{
  "success": true,
  "invoice": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 0.01,
    "currency": "ETH",
    "walletAddress": "0x1234...5678",
    "balance": 0,
    "status": "pending",
    "createdAt": "2024-02-07T12:00:00.000Z"
  }
}
```

**Response (Error):**
```json
{
  "error": "Missing required fields"
}
```

**Possible Errors:**
- 400: Missing or invalid fields, unsupported currency
- 500: Gateway not configured (MASTER_MNEMONIC missing)

**Example:**
```bash
curl -X POST http://localhost:3000/api/invoices/create \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "currency": "ETH"}'
```

---

### Poll Invoice Status

**Endpoint:** `POST /api/invoices/poll`

Checks the current status of an invoice, including wallet balance and transaction confirmations. Automatically triggers fund sweeping when payment is detected.

**Request Body:**
```json
{
  "invoiceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Parameters:**
- `invoiceId` (string, required): The UUID of the invoice to check

**Response (Success):**
```json
{
  "success": true,
  "invoice": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "balance": 0,
    "requiredAmount": 0.01,
    "confirmationCount": 0,
    "isPaymentReceived": false,
    "lastChecked": "2024-02-07T12:00:15.000Z"
  }
}
```

**Response Status Transitions:**
```
pending         → User hasn't sent payment yet
  ↓
received        → Payment detected in invoice wallet
  ↓
prefunding      → (USDT only) Gas is being prefunded
  ↓
sweeping        → Funds are being transferred to master wallet
  ↓
completed       → Sweep confirmed, funds delivered
```

**Response Fields:**
- `status`: Current payment status
- `balance`: Current wallet balance (in specified currency)
- `requiredAmount`: Target amount to receive
- `confirmationCount`: Number of block confirmations
- `isPaymentReceived`: Boolean indicating if target amount reached
- `lastChecked`: Timestamp of last poll

**Possible Errors:**
- 400: Missing invoiceId
- 404: Invoice not found
- 500: Polling or sweep error

**Example:**
```bash
curl -X POST http://localhost:3000/api/invoices/poll \
  -H "Content-Type: application/json" \
  -d '{"invoiceId": "550e8400-e29b-41d4-a716-446655440000"}'
```

---

## Admin Endpoints

All admin endpoints require the `Authorization: Bearer {ADMIN_TOKEN}` header.

### Get Admin Configuration

**Endpoint:** `GET /api/admin/config`

Retrieves current gateway configuration including master wallet and gas wallet details.

**Headers:**
```
Authorization: Bearer your_admin_token_here
```

**Response (Configured):**
```json
{
  "configured": true,
  "masterWalletAddress": "0xabcd...ef12",
  "gasWalletAddress": "0x9876...5432",
  "gasWalletBalance": 0.5,
  "createdAt": "2024-02-07T12:00:00.000Z"
}
```

**Response (Not Configured):**
```json
{
  "configured": false,
  "error": "Gateway not configured. Master wallet key required.",
  "requiredSettings": ["Master Wallet Key"]
}
```

**Possible Errors:**
- 401: Missing or invalid authorization token
- 500: Configuration fetch error

**Example:**
```bash
curl http://localhost:3000/api/admin/config \
  -H "Authorization: Bearer your_admin_token_here"
```

---

### Update Admin Configuration

**Endpoint:** `POST /api/admin/config`

Sets the master wallet address and initializes gas wallet if needed.

**Headers:**
```
Authorization: Bearer your_admin_token_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "masterWalletAddress": "0xabcd...ef12"
}
```

**Parameters:**
- `masterWalletAddress` (string, required): Ethereum address where funds will be swept
  - Must be valid 42-character hex address starting with "0x"

**Response (Success):**
```json
{
  "success": true,
  "config": {
    "masterWalletAddress": "0xabcd...ef12",
    "gasWalletAddress": "0x9876...5432",
    "gasWalletBalance": 0.0
  }
}
```

**Possible Errors:**
- 400: Missing or invalid master wallet address
- 401: Missing or invalid authorization token
- 500: Configuration update error

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/config \
  -H "Authorization: Bearer your_admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{"masterWalletAddress": "0xabcd...ef12"}'
```

---

### Get All Transactions

**Endpoint:** `GET /api/admin/transactions`

Fetches all invoices with their transaction history and current status.

**Headers:**
```
Authorization: Bearer your_admin_token_here
```

**Response (Success):**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2024-02-07T12:00:00.000Z",
      "currency": "ETH",
      "amount_expected": 0.01,
      "wallet_address": "0x1234...5678",
      "derivation_index": 1,
      "status": "completed",
      "current_balance": 0.01,
      "confirmation_count": 12,
      "last_checked_at": "2024-02-07T12:05:00.000Z",
      "sweep_tx_hash": "0xabc...def"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "created_at": "2024-02-07T12:10:00.000Z",
      "currency": "USDT",
      "amount_expected": 10.0,
      "wallet_address": "0x9876...5432",
      "derivation_index": 2,
      "status": "pending",
      "current_balance": 0,
      "confirmation_count": 0,
      "last_checked_at": "2024-02-07T12:10:15.000Z"
    }
  ]
}
```

**Response Fields (per invoice):**
- `id`: Invoice UUID
- `created_at`: Invoice creation timestamp
- `currency`: "ETH" or "USDT"
- `amount_expected`: Target payment amount
- `wallet_address`: Unique wallet for this invoice
- `derivation_index`: HD wallet derivation index
- `status`: Current payment status
- `current_balance`: Current wallet balance
- `confirmation_count`: Block confirmations
- `last_checked_at`: Last poll timestamp
- `sweep_tx_hash`: Transaction hash of sweep (if completed)

**Possible Errors:**
- 401: Missing or invalid authorization token
- 500: Transaction fetch error

**Example:**
```bash
curl http://localhost:3000/api/admin/transactions \
  -H "Authorization: Bearer your_admin_token_here"
```

---

## Error Handling

All endpoints return consistent error responses:

**Generic Error Response:**
```json
{
  "error": "Descriptive error message"
}
```

**HTTP Status Codes:**
- 200: Success
- 400: Bad request (validation error)
- 401: Unauthorized (invalid/missing admin token)
- 404: Not found (invoice doesn't exist)
- 500: Internal server error

---

## Rate Limiting

Currently, there are no rate limits implemented. For production:

**Recommended Rate Limits:**
```
POST /api/invoices/create:    100 requests per minute
POST /api/invoices/poll:      1000 requests per minute
GET /api/admin/config:        100 requests per minute
POST /api/admin/config:       10 requests per minute
GET /api/admin/transactions:  100 requests per minute
```

---

## Security Considerations

### Authentication
- Admin endpoints require valid `ADMIN_TOKEN` in Authorization header
- Token should be cryptographically random (32+ bytes recommended)
- Tokens are compared using constant-time comparison to prevent timing attacks

### Input Validation
- All numeric inputs validated for positive values
- Addresses validated as proper Ethereum format
- Currency validated against allowed values

### Web3 Interactions
- Private keys never sent in requests or responses
- Transaction signing happens server-side only
- All blockchain operations go through secure RPC endpoints

### Data Protection
- Supabase Row-Level Security policies protect invoice data
- No sensitive data stored in plaintext
- HTTPS enforced on all endpoints

---

## Webhook Endpoints (Future)

Planned for future releases:

```
POST /api/webhooks/invoice-paid
POST /api/webhooks/sweep-completed
POST /api/webhooks/sweep-failed
```

---

## Client Examples

### JavaScript/TypeScript

```javascript
// Create invoice
const response = await fetch('/api/invoices/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 0.01,
    currency: 'ETH'
  })
});
const data = await response.json();
console.log(data.invoice.walletAddress);

// Poll status
const pollResponse = await fetch('/api/invoices/poll', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceId: data.invoice.id
  })
});
const pollData = await pollResponse.json();
console.log(pollData.invoice.status);
```

### Python

```python
import requests

# Create invoice
response = requests.post('http://localhost:3000/api/invoices/create', json={
    'amount': 0.01,
    'currency': 'ETH'
})
invoice = response.json()['invoice']
print(invoice['walletAddress'])

# Poll status
poll_response = requests.post('http://localhost:3000/api/invoices/poll', json={
    'invoiceId': invoice['id']
})
status = poll_response.json()['invoice']['status']
print(status)
```

### cURL

```bash
# Create invoice
curl -X POST http://localhost:3000/api/invoices/create \
  -H 'Content-Type: application/json' \
  -d '{"amount": 0.01, "currency": "ETH"}'

# Poll status
curl -X POST http://localhost:3000/api/invoices/poll \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId": "550e8400-e29b-41d4-a716-446655440000"}'
```

---

## Testing

For testing API endpoints, use:

- **Postman**: Import endpoints and test with your variables
- **curl**: Command-line testing (see examples above)
- **Thunder Client**: VS Code extension for REST testing
- **REST Client**: VS Code extension with `.http` files

---

## Changelog

### Version 1.0.0
- Initial release
- ETH and USDT payment support
- Admin configuration panel
- Real-time polling
- Automatic fund sweeping
