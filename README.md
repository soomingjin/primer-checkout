# 🚀 Primer Universal Checkout Integration

A production-ready **Primer Universal Checkout** integration with debugging tools and dual environment support (local + Vercel).

Built in **5 days** as a solo engineering project to demonstrate rapid payment integration capabilities.

## 🎯 Project Goals

- ✅ Integrate Primer Universal Checkout SDK
- ✅ Support customer management and payment vaulting  
- ✅ Handle Apple Pay and modern payment methods
- ✅ Work in both development and production environments
- ✅ Provide debugging tools for testing scenarios
- ✅ Maintain clean, readable code for future enhancements

## ✨ Key Features

### 💳 Payment Integration
- **Universal Checkout**: Full Primer SDK integration with all payment methods
- **Customer Vaulting**: Save payment methods for returning customers
- **Apple Pay Support**: Configured for standard, recurring, and deferred payments
- **Real-time Processing**: Live payment flow with success/error handling

### 🛠️ Developer Tools
- **Debug Panel**: Test different payment scenarios instantly
- **Request Monitoring**: See API requests/responses in real-time
- **Payment Status Checker**: Query payment status by ID
- **Test Scenarios**: Pre-configured amounts for testing success/failure cases

### 🌐 Dual Environment
- **Local Development**: Express server with hot reload
- **Production Ready**: Vercel serverless deployment with proper CSP
- **Environment Parity**: Same code runs in both environments

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.0.0
- **Yarn** (preferred) or **npm**
- **Primer Account** (free at [primer.io](https://primer.io))

### 1. Install Dependencies
```bash
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

### 4. Open Browser
Navigate to `http://localhost:3000` and start testing payments!

### 5. Deploy to Vercel (Optional)
```bash
vercel --prod
```

## 📋 Configuration

### Required
```bash
PRIMER_API_KEY=sk_test_your_primer_api_key_here
```

### Optional
```bash
PORT=3000
NODE_ENV=development
PRIMER_WEBHOOK_SECRET=your_webhook_secret_here
```

## 🏗️ Project Structure

```
primer-checkout-1/
├── api/                      # Vercel serverless functions
│   ├── _utils.js            # Shared utilities and validation
│   ├── create-client-session.js
│   ├── health.js
│   └── payments/[id].js     # Payment status endpoint
├── public/
│   ├── index.html           # Main application
│   └── css/checkout.css     # Styles
├── server.js                # Local development server
├── vercel.json              # Vercel deployment config
└── package.json
```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server with hot reload |
| `yarn start` | Start production server |
| `vercel --prod` | Deploy to Vercel |

## 🎯 How It Works

### 1. Client Session Creation
```javascript
// Backend creates secure session with Primer
const orderData = {
  orderId: "ORD-1234567890",
  currencyCode: "GBP", 
  amount: 4999,
  customer: { emailAddress: "customer@example.com" },
  paymentMethod: { vaultOnSuccess: true } // Save cards for returning customers
};
```

### 2. Frontend Integration
```javascript
// Initialize Primer Universal Checkout
await Primer.showUniversalCheckout(clientToken, {
  container: '#primer-container',
  onCheckoutComplete({ payment }) {
    console.log('Payment successful!', payment.id);
  }
});
```

## 📡 API Endpoints

- `GET /` - Main application
- `GET /health` - Health check
- `POST /create-client-session` - Create payment session
- `GET /payments/{id}` - Check payment status
- `POST /webhook` - Payment webhooks (basic implementation)

## 🚨 Troubleshooting

**API Key Issues:**
```bash
# Make sure your API key is set
echo "PRIMER_API_KEY=sk_test_your_key_here" >> .env
```

**Port Conflicts:**
```bash
# Use different port
echo "PORT=3001" >> .env
```

**CSP Errors:** Check browser console - some payment methods need specific CSP permissions.

## 🔮 Future Improvements

- [ ] Complete webhook signature verification
- [ ] Add more payment method configurations  
- [ ] Implement proper error retry logic
- [ ] Add customer database integration
- [ ] Build admin dashboard for payments

## 📚 Resources

- [Primer Documentation](https://primer.io/docs)
- [Universal Checkout Guide](https://primer.io/docs/checkout/drop-in/overview)
- [API Reference](https://primer.io/docs/api-reference)

---

**Built in 5 days** as a rapid prototype for Primer Universal Checkout integration.

See `IMPLEMENTATION_GUIDE.md` for detailed development notes and technical architecture.