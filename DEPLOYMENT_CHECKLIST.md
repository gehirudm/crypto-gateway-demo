# Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Generate new master mnemonic for production
  - [ ] Store securely (hardware wallet or secure vault)
  - [ ] Never commit to version control
  - [ ] Back up recovery codes
- [ ] Create strong admin token
  - [ ] Use `openssl rand -hex 32` or similar
  - [ ] Store securely
  - [ ] Document creation method
- [ ] Set up Supabase production database
  - [ ] Create new project (don't use testing DB)
  - [ ] Run database migrations
  - [ ] Enable backups
  - [ ] Configure replication
- [ ] Obtain Optimism mainnet RPC endpoint
  - [ ] Choose reliable provider (Infura, Alchemy, etc.)
  - [ ] Test endpoint availability
  - [ ] Note any rate limits
  - [ ] Set up fallback endpoints

### 2. Wallet Preparation
- [ ] Create master wallet from mnemonic
  - [ ] Verify address matches expected
  - [ ] Fund with production funds
  - [ ] Monitor balance regularly
- [ ] Create/verify gas wallet
  - [ ] Ensure it's funded with ETH (recommended: 0.5-1 ETH)
  - [ ] Monitor gas costs
  - [ ] Set up low-balance alerts
- [ ] Test wallet derivation
  - [ ] Verify index 0 generates gas wallet
  - [ ] Verify index 1 generates invoice wallet
  - [ ] Confirm path follows BIP-44 standard

### 3. Security Audit
- [ ] Review all API endpoints
  - [ ] Verify token authentication on admin routes
  - [ ] Check input validation
  - [ ] Confirm no secrets in logs
- [ ] Check environment variables
  - [ ] MASTER_MNEMONIC not accessible from client
  - [ ] ADMIN_TOKEN not exposed anywhere
  - [ ] NEXT_PUBLIC_* only have public data
- [ ] Validate database RLS policies
  - [ ] Test row-level security
  - [ ] Verify unauthorized access is blocked
  - [ ] Check data isolation between invoices
- [ ] Test transaction signing
  - [ ] Verify private keys never leave server
  - [ ] Confirm transactions are properly signed
  - [ ] Check transaction receipts are verified

### 4. Network Configuration
- [ ] Switch RPC_URL to mainnet
  - [ ] Verify: `https://mainnet.optimism.io`
  - [ ] Test connection
  - [ ] Check block height
- [ ] Confirm contract addresses
  - [ ] USDT: `0x7F5c764cBc14f9669B88837ca1490cCa17c31607`
  - [ ] Verify on Optimism mainnet
  - [ ] Test balance queries
- [ ] Update domain in code
  - [ ] Update nav links if using custom domain
  - [ ] Update emailRedirectTo if using auth
  - [ ] Update CORS settings if needed

## Testing & Validation

### 5. Functional Testing
- [ ] Test invoice creation
  - [ ] Create ETH invoice
  - [ ] Create USDT invoice
  - [ ] Verify wallet addresses are unique
- [ ] Test payment flow
  - [ ] Send small ETH payment to invoice
  - [ ] Monitor real-time status updates
  - [ ] Verify automatic sweep occurs
  - [ ] Check funds arrive in master wallet
- [ ] Test USDT flow
  - [ ] Send small USDT payment to invoice
  - [ ] Monitor gas prefunding
  - [ ] Verify sweep occurs
  - [ ] Confirm USDT in master wallet
- [ ] Test admin panel
  - [ ] Authenticate with correct token
  - [ ] View configuration
  - [ ] See all transactions
  - [ ] Filter by status
  - [ ] Verify balances shown

### 6. Edge Cases & Error Handling
- [ ] Test error scenarios
  - [ ] Invalid currency
  - [ ] Negative amount
  - [ ] Zero amount
  - [ ] Missing invoice ID
- [ ] Test timeout scenarios
  - [ ] Invoice expires after 10 minutes
  - [ ] Failed transaction handling
  - [ ] Network error recovery
- [ ] Test boundary conditions
  - [ ] Very small amounts (dust)
  - [ ] Very large amounts (limits)
  - [ ] High gas price scenarios
  - [ ] Network congestion

### 7. Performance Testing
- [ ] Load test invoice creation
  - [ ] 100 concurrent requests
  - [ ] Measure response times
  - [ ] Check error rates
- [ ] Load test polling
  - [ ] 1000 concurrent polls
  - [ ] Monitor DB query times
  - [ ] Check RPC rate limits
- [ ] Monitor gas costs
  - [ ] Calculate average sweep cost
  - [ ] Monitor total monthly usage
  - [ ] Compare with projections

## Security Hardening

### 8. Access Control
- [ ] Verify admin authentication
  - [ ] Only correct token works
  - [ ] Tokens can't be guessed
  - [ ] Rate limiting on auth attempts
- [ ] Test authorization
  - [ ] Users can't access other invoices
  - [ ] Anonymous users can create invoices
  - [ ] Admin-only operations require token
- [ ] Implement audit logging
  - [ ] Log all admin actions
  - [ ] Log failed authentication attempts
  - [ ] Log large transactions
  - [ ] Store logs securely

### 9. Data Protection
- [ ] Enable database backups
  - [ ] Automated daily backups
  - [ ] Test backup restoration
  - [ ] Verify backups are encrypted
- [ ] Encrypt sensitive data
  - [ ] Database encryption at rest
  - [ ] HTTPS for all connections
  - [ ] Encrypted backups
- [ ] Set up monitoring
  - [ ] Database size monitoring
  - [ ] API error rate monitoring
  - [ ] Transaction failure monitoring

### 10. Compliance & Documentation
- [ ] Update terms of service
  - [ ] Mention non-custodial model
  - [ ] List accepted currencies
  - [ ] Disclaimer about test phase if any
- [ ] Create privacy policy
  - [ ] Disclose data collected
  - [ ] Explain data usage
  - [ ] Provide data deletion process
- [ ] Document recovery procedures
  - [ ] Mnemonic recovery process
  - [ ] Disaster recovery plan
  - [ ] Rollback procedures

## Deployment Execution

### 11. Pre-Production Staging
- [ ] Deploy to staging environment
  - [ ] Use staging Supabase database
  - [ ] Use testnet RPC endpoints
  - [ ] Use test mnemonic
- [ ] Run full regression testing
  - [ ] All user flows
  - [ ] All admin functions
  - [ ] Error handling
- [ ] Performance validation
  - [ ] Load tests pass
  - [ ] Response times acceptable
  - [ ] No memory leaks

### 12. Production Deployment
- [ ] Final security review
  - [ ] Code review completed
  - [ ] No hardcoded secrets
  - [ ] All dependencies up-to-date
  - [ ] No vulnerable packages
- [ ] Set environment variables in Vercel
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_RPC_URL (mainnet)
  NEXT_PUBLIC_USDT_CONTRACT_ADDRESS
  MASTER_MNEMONIC (production)
  ADMIN_TOKEN (strong, random)
  ```
- [ ] Deploy to Vercel
  - [ ] Connect GitHub repository
  - [ ] Enable auto-deploy on push
  - [ ] Test deployed instance
- [ ] Verify production deployment
  - [ ] Visit deployed domain
  - [ ] Test invoice creation
  - [ ] Test admin panel
  - [ ] Monitor logs for errors

## Post-Deployment Monitoring

### 13. Operational Monitoring
- [ ] Set up alerting
  - [ ] High error rate alerts
  - [ ] Database performance alerts
  - [ ] Failed transaction alerts
  - [ ] Low gas wallet balance alerts
- [ ] Monitor key metrics
  - [ ] Number of invoices created
  - [ ] Total transaction volume
  - [ ] Average transaction time
  - [ ] Error rates
- [ ] Regular health checks
  - [ ] Daily: Gas wallet balance
  - [ ] Daily: Error logs
  - [ ] Weekly: Failed transactions
  - [ ] Weekly: Performance metrics
  - [ ] Monthly: Security audit

### 14. Maintenance Plan
- [ ] Schedule regular backups
  - [ ] Database backups (automated)
  - [ ] Document backups (manual)
- [ ] Plan dependency updates
  - [ ] Monthly security patches
  - [ ] Quarterly feature updates
  - [ ] Validate before deploying
- [ ] Establish on-call process
  - [ ] Who handles urgent issues
  - [ ] Escalation procedures
  - [ ] Communication channels

### 15. Incident Response
- [ ] Document incident procedures
  - [ ] How to detect issues
  - [ ] Escalation path
  - [ ] Communication plan
  - [ ] Rollback procedures
- [ ] Test disaster recovery
  - [ ] Test database restore
  - [ ] Test code rollback
  - [ ] Practice incident response
- [ ] Create runbooks
  - [ ] Common issues and fixes
  - [ ] Emergency contacts
  - [ ] Recovery procedures

## Post-Deployment Validation

### 16. User Acceptance Testing
- [ ] Real payment flow test
  - [ ] Create invoice with small amount
  - [ ] Make actual payment
  - [ ] Verify automatic sweep
  - [ ] Check confirmation email/notification
- [ ] Admin acceptance test
  - [ ] Verify all features work
  - [ ] Check reporting accuracy
  - [ ] Validate transaction history
- [ ] User feedback
  - [ ] Collect UX feedback
  - [ ] Note any issues reported
  - [ ] Plan improvements

### 17. Documentation Updates
- [ ] Update README
  - [ ] Reflect production status
  - [ ] Update links
  - [ ] Add support contact
- [ ] Create operations guide
  - [ ] Daily tasks
  - [ ] Weekly tasks
  - [ ] Monthly tasks
- [ ] Create troubleshooting guide
  - [ ] Common issues
  - [ ] Error messages explained
  - [ ] How to reach support

## Sign-Off

- [ ] CTO/Lead Developer Approval
  - Name: _________________
  - Date: __________________
  - Comments: ________________________________________________
  
- [ ] Security Auditor Approval
  - Name: _________________
  - Date: __________________
  - Comments: ________________________________________________
  
- [ ] Product Manager Approval
  - Name: _________________
  - Date: __________________
  - Comments: ________________________________________________

---

## Quick Reference

### Critical Paths
1. **Mainnet Deployment**: Must use production mnemonic and mainnet RPC
2. **Admin Token**: Must be strong and stored securely
3. **Gas Wallet**: Must always have sufficient ETH
4. **Database**: Must have backups enabled before production
5. **Monitoring**: Must have alerts set up before going live

### Emergency Contacts
- Support: ___________________
- On-Call: ___________________
- Security: ___________________

### Useful Links
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Console: https://app.supabase.com
- Optimism Explorer: https://optimiscan.io
- Transaction Tracker: [Your monitoring tool]

### Rollback Procedure
1. Check Vercel deployment history
2. Select previous working deployment
3. Promote to production
4. Verify functionality
5. Check logs and metrics

---

**Last Updated**: [Date]
**Deployed By**: [Name]
**Deployment ID**: [Version/Commit Hash]
