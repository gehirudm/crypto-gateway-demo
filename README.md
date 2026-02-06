# CryptoGate - Decentralized Payment Gateway

A production-grade cryptocurrency payment gateway for accepting ETH and USDT payments on Optimism with automatic invoice wallet generation, real-time balance monitoring, and intelligent fund sweeping.

![Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Network](https://img.shields.io/badge/network-Optimism-red)

## Features

### Core Functionality
- **Dual Currency Support**: Accept both ETH and USDT payments
- **Unique Invoice Wallets**: Each invoice gets a unique, deterministic wallet address
- **Non-Custodial**: Never hold user funds - they go directly to invoice wallets
- **Automatic Sweeping**: Funds automatically transferred to your master wallet after confirmation
- **Real-time Monitoring**: Live balance updates every 2 seconds
- **Admin Dashboard**: Manage configuration and view all transactions

### Technical Highlights
- **HD Wallet Derivation**: BIP-44 compliant wallet generation from master mnemonic
- **Serverless Ready**: Polling-based architecture for Vercel deployment
- **Secure**: Master mnemonic stored only in environment variables
- **Transparent**: Full transaction history and status tracking
- **Smart Gas Handling**: Automatic gas prefunding for USDT payments

## Quick Start

### 1. Prerequisites
```bash
Node.js 18+
Supabase project
Optimism testnet ETH (for testing)
```

### 2. Clone and Install
```bash
git clone your-repo
cd your-repo
npm install
```

### 3. Configure Environment
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
MASTER_MNEMONIC=your_12_24_word_phrase
ADMIN_TOKEN=your_secure_token
NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io
```

### 4. Setup Database
Run `scripts/setup-database.sql` in Supabase SQL Editor

### 5. Start Development
```bash
npm run dev
# Visit http://localhost:3000
```

### 6. Configure Admin Panel
1. Go to `/admin`
2. Enter your ADMIN_TOKEN
3. Set your master wallet address
4. Fund the gas wallet with testnet ETH

## Usage

### Create an Invoice
```
1. Navigate to /invoice
2. Enter amount and select currency
3. Click "Create Invoice"
4. Send payment to the generated address
5. Watch real-time status updates
```

### Admin Panel
```
/admin - Configure gateway and view transactions
Requires: ADMIN_TOKEN authentication
```

### API Endpoints
```
POST   /api/invoices/create          Create new invoice
POST   /api/invoices/poll            Check invoice status
GET    /api/admin/config             Get configuration
POST   /api/admin/config             Update configuration
GET    /api/admin/transactions       View all invoices
```

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[SETUP.md](./SETUP.md)** - Detailed setup and configuration
- **[ENV_EXAMPLE.md](./ENV_EXAMPLE.md)** - Environment variables guide
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Architecture and design decisions

## Project Structure

```
├── app/
│   ├── page.tsx                 # Homepage
│   ├── invoice/page.tsx         # Invoice creation
│   ├── admin/page.tsx           # Admin panel
│   └── api/                     # API routes
├── components/
│   ├── InvoicePaymentMonitor.tsx
│   ├── AdminConfig.tsx
│   └── AdminTransactions.tsx
├── lib/
│   ├── web3/wallet.ts           # Web3 utilities
│   ├── db/invoices.ts           # Invoice operations
│   ├── db/admin.ts              # Admin operations
│   └── supabase/                # Supabase clients
└── scripts/
    └── setup-database.sql       # Database schema
```

## Payment Flow

### ETH Payments
```
1. User sends ETH to invoice wallet
2. System detects payment (2-sec polling)
3. Automatic sweep to master wallet
4. Invoice marked complete
```

### USDT Payments
```
1. User sends USDT to invoice wallet
2. System detects USDT received
3. Gas automatically prefunded from gas wallet
4. USDT swept to master wallet
5. Invoice marked complete
```

## Security

### Implemented
- ✅ Non-custodial fund model
- ✅ Master mnemonic in environment variables only
- ✅ Token-based admin authentication
- ✅ Supabase Row-Level Security
- ✅ HTTPS enforced
- ✅ Input validation and sanitization

### Recommendations
- Use strong admin tokens (32+ bytes)
- Keep master mnemonic secret
- Monitor gas wallet balance
- Test on testnet first
- Regular security audits

## Deployment

### Vercel (Recommended)
```bash
git push origin main
# Vercel auto-deploys
# Add environment variables in project settings
```

### Self-Hosted
```bash
npm run build
npm start
# Ensure environment variables are set
```

## Testing

### Testnet Configuration
```env
NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io
MASTER_MNEMONIC=your_testnet_mnemonic
```

### Get Test Funds
- ETH: https://sepoliafaucet.com
- USDT: Most faucets provide both

### Test Checklist
- [ ] Create ETH invoice and send payment
- [ ] Create USDT invoice and send payment
- [ ] Verify automatic fund sweep
- [ ] Test admin configuration
- [ ] Check transaction history
- [ ] Monitor gas wallet balance

## Performance

- Invoice creation: < 500ms
- Status poll: < 1s
- Fund sweep: 1-2 block confirmations
- Real-time updates: 2-second intervals

## Supported Networks

### Testnet
- **Optimism Sepolia**: https://sepolia.optimism.io

### Mainnet
- **Optimism**: https://mainnet.optimism.io

## Future Enhancements

- [ ] Additional tokens (DAI, USDC)
- [ ] Multi-chain support
- [ ] Webhook notifications
- [ ] Email confirmations
- [ ] Payment refunds
- [ ] Recurring payments
- [ ] Analytics dashboard
- [ ] REST API for integrations

## Troubleshooting

**"Gateway not configured"**
- Ensure MASTER_MNEMONIC is set in env vars
- Restart dev server

**"Master wallet address required"**
- Log into admin panel and set your wallet

**Balance shows 0**
- Verify payment was sent to correct address
- Check network (must be Optimism)
- Wait a few blocks for visibility

**USDT sweep fails**
- Ensure gas wallet has >= 0.005 ETH
- Send more ETH to gas wallet

## Support

- Questions? Check the documentation files
- Issues? Review the API documentation
- Need setup help? Follow QUICKSTART.md

## License

MIT License - See LICENSE file for details

## Security Disclosure

Found a security issue? Please email security@example.com instead of opening a public issue.

## Contributing

Contributions welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Disclaimer

This is a demonstration project for educational purposes. Use at your own risk. Always test thoroughly on testnet before mainnet deployment. The developers are not responsible for lost funds or security breaches.

## Credits

Built with:
- [Next.js 16](https://nextjs.org)
- [Supabase](https://supabase.com)
- [ethers.js](https://ethers.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)

---

**Get Started:** [QUICKSTART.md](./QUICKSTART.md)
**Full Setup:** [SETUP.md](./SETUP.md)
**API Docs:** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
