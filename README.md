# 🚀 Primer Universal Checkout Integration

A Primer Universal Checkout integration with comprehensive debugging tools, side-by-side developer interface.

Built as an engineering demo to showcase payment integration capabilities with developer tools


**Live Demo:**  
👉 [Try the Universal Checkout Demo here](https://primer-checkout-xi.vercel.app/)  




## 🎯 Project Goals

- ✅ **Basic Primer Integration**: Implement Universal Checkout Web SDK
- ✅ **Developer Experience**: Debug panel
- ✅ **Payment Vaulting**: Stored payment methods
- ✅ **Multiple Payment Methods**: Apple Pay, Google Pay, Cards, Klarna, PayPal
- ✅ **Production Ready**: Dual environment support with proper security
- ✅ **Testing Tools**: Scenario testing and status monitoring

## ✨ Key Features

### 💳 Payment Integration
- **Universal Checkout**: Primer SDK integration with multiple payment methods
- **Customer Vaulting**: Secure payment method storage for returning customers
- **Real-time Processing**: Live payment flow with error handling
- **Payment Status API**: Query transaction status and details by payment ID

### 🛠️ Developer Tools
- **Side-by-Side Debug Panel**: Always-visible development interface
- **Custom Client Sessions**: Override default behavior with custom JSON payloads
- **Test Scenarios**: Pre-configured test cases for different payment flows
  - ✅ Success Case (£1.00)
  - 💾 Vault Customer (£49.99)
  - 🔄 Subscription (£19.99)
- **Quick Amount Presets**: Instant amount selection (£1.00, £9.99, £49.99, £99.99)
- **API Request Monitor**: Real-time request/response logging
- **Payment Status Checker**: Live payment verification by ID
- **JSON Validation**: Built-in validator for custom session payloads

### 🌐 Architecture
- **Local Development**: Express server with hot reload and detailed logging
- **Production Ready**: Vercel serverless deployment
- **Environment Parity**: Identical behavior across development and production
- **Security Headers**: Proper CSP, security headers, and CORS configuration

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.0.0
- **Yarn** (preferred) or **npm**
- **Primer Account** with API access (At [https://sandbox-dashboard.primer.io/developers/apiKeys](https://sandbox-dashboard.primer.io/developers/apiKeys))

### 1. Clone & Install
```bash
git clone <repository-url>
cd primer-checkout
yarn install
```

### 2. Environment Setup
```bash
# Create environment file
cp .env.example .env

# Add your Primer API key (get from https://dashboard.primer.io)
echo "PRIMER_API_KEY=sk_test_your_actual_api_key_here" >> .env
```

### 3. Start Development
```bash
yarn dev
```

### 4. Open Application
Navigate to `http://localhost:3000` to see the full interface:
- **Left Side**: Main checkout application
- **Right Side**: Developer debug panel with testing tools

### 5. Deploy to Production
```bash
yarn deploy
# or
vercel --prod
```

## 🔧 Configuration Options

### Required Environment Variables
```bash
PRIMER_API_KEY=sk_test_your_primer_api_key_here
```

### Optional Configuration
```bash
PORT=3000                                    # Development server port
NODE_ENV=development                         # Environment mode
PRIMER_WEBHOOK_SECRET=your_webhook_secret    # Webhook signature verification
```

## 🏗️ Architecture Overview

```
primer-checkout-1/
├── 🚀 api/                          # Vercel serverless functions
│   ├── _utils.js                   # Shared utilities & validation
│   ├── create-client-session.js    # Payment session creation
│   ├── health.js                   # Health check endpoint
│   ├── payments/[id].js           # Payment status queries
│   └── webhook.js                  # Payment event handling
├── 🎨 public/
│   ├── index.html                  # Main application
│   ├── css/checkout.css            # Styling
│   └── assets/                     # Icons, favicons, manifest
├── 🖥️ server.js                     # Local development server
├── ⚙️ vercel.json                   # Deployment configuration
├── 📦 package.json                  # Dependencies & scripts
└── 📚 README.md                     # This file
```

## 🛠️ Available Commands

| Command | Description | Environment |
|---------|-------------|-------------|
| `yarn dev` | Start development server with hot reload | Local |
| `yarn start` | Start production server locally | Local |
| `yarn deploy` | Deploy to Vercel production | Cloud |
| `yarn test` | Run integration tests | Any |
| `yarn health` | Check system health and API connectivity | Any |
| `yarn setup` | Interactive environment setup wizard | Local |

## 🎯 Developer Debug Panel Features

### 🔑 Custom Client Sessions
- **JSON Editor**: Modify client session creation parameters
- **Validation**: Real-time JSON validation with error reporting
- **Override Modes**: Use custom JWT tokens or session objects
- **Auto-generation**: Fall back to form-based session creation

### 🎭 Test Scenarios
Pre-configured test cases for comprehensive payment testing:

```javascript
// Success Case - Quick positive test
{ amount: 1.00, email: "success@test.com" }

// Vault Customer - Test payment method storage
{ amount: 49.99, email: "vault@customer.com", vaultOnSuccess: true }

// Subscription - Recurring payment testing
{ amount: 19.99, email: "subscription@test.com", recurring: true }
```

### 📊 API Monitoring
- **Request Logger**: See exactly what data is sent to Primer
- **Response Inspector**: View complete API responses with formatting
- **Error Tracking**: Detailed error messages with resolution hints
- **Performance Metrics**: Response times and success rates

### 💳 Payment Status Tools
- **ID Lookup**: Query any payment by ID for status verification  
- **Response Formatting**: Beautifully formatted JSON responses
- **History Tracking**: Remember recent payment lookups
- **Error Handling**: Clear error messages for invalid IDs

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| `GET` | `/` | Main application interface | - |
| `GET` | `/health` | System health check | - |
| `POST` | `/create-client-session` | Create payment session | `amount`, `currency`, `customerEmail`, etc. |
| `GET` | `/payments/{id}` | Query payment status | `id` (path parameter) |
| `POST` | `/webhook` | Handle payment events | Primer webhook payload |

### Example API Usage

#### Creating a Client Session
```javascript
const response = await fetch('/create-client-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 4999,           // £49.99 in pence
    currency: 'GBP',
    customerEmail: 'customer@example.com',
    customerId: 'customer-123',
    vaultOnSuccess: true    // Save payment method
  })
});
```

#### Checking Payment Status
```javascript
const payment = await fetch('/payments/XYZABC').then(r => r.json());
console.log('Payment Status:', payment.status);
```

## 🚨 Troubleshooting Guide

### Common Issues & Solutions

**🔑 API Key Problems**
```bash
# Verify your API key is set correctly
echo $PRIMER_API_KEY

# If missing, add it:
echo "PRIMER_API_KEY=sk_test_your_key_here" >> .env
```

**🌐 Port Conflicts**
```bash
# Check what's using port 3000
lsof -i :3000

# Use different port
echo "PORT=3001" >> .env
yarn dev
```

**🛡️ CSP/Security Errors**
- Check browser console for Content Security Policy violations
- Ensure Primer domains are whitelisted in `vercel.json`
- Verify CORS headers are properly configured

**💳 Payment Method Issues**
- Ensure your Primer account has the required payment methods enabled
- Verify webhook endpoints are accessible if using live payments

**🔧 Development vs Production Differences**
- Environment variables may differ between local and Vercel
- Check `NODE_ENV` is set correctly
- Verify all required secrets are configured in Vercel dashboard

## 🔮 Future Enhancements

### Planned Features
- [ ] **Mobile SDK Integration**: React Native companion app

### Technical Improvements
- [ ] **Database Integration**: Persistent customer and payment storage
- [ ] **Testing**: Comprehensive end-to-end test suite

## 📚 Resources & Documentation

### Official Primer Resources
- [🏠 Primer Documentation](https://primer.io/docs)
- [💳 Universal Checkout Guide](https://primer.io/docs/checkout/drop-in/overview)
- [📖 API Reference](https://primer.io/docs/api-reference/v2.4)
- [🔧 SDK Documentation](https://primer.io/docs/sdk)

### Development Resources
- [⚛️ React Native Integration](https://primer.io/docs/checkout/drop-in/customization/react-native)
- [📱 Mobile SDKs](https://primer.io/docs/sdk/mobile)
- [🪝 Webhooks Guide](https://primer.io/docs/api-reference/get-started/configure-webhooks)

### Testing Resources
- [🧪 Test Cards](https://primer.io/docs/testing/3d-secure)
