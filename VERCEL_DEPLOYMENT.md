# 🚀 Vercel Deployment Guide for Primer Checkout Demo

This guide will walk you through deploying your Primer checkout demo to Vercel.

## ✅ Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Primer Account**: Get your API key from [dashboard.primer.io](https://dashboard.primer.io)

## 📁 Project Structure (Updated for Vercel)

```
primer-checkout-demo/
├── api/                          # Vercel API routes
│   ├── _utils.js                 # Shared utilities
│   ├── health.js                 # Health check endpoint
│   ├── create-client-session.js  # Session creation
│   └── webhook.js                # Webhook handler
├── public/                       # Static files
│   ├── index.html                # Main application
│   └── Checkout.css              # Styles (if exists)
├── scripts/                      # Setup scripts
│   ├── setup.js
│   └── check-health.js
├── vercel.json                   # Vercel configuration
├── package.json                  # Updated with Vercel scripts
└── README.md
```

## 🔧 Step-by-Step Deployment

### **Step 1: Install Vercel CLI**

```bash
# Install globally
npm i -g vercel

# Or use npx (no installation required)
npx vercel --version
```

### **Step 2: Login to Vercel**

```bash
vercel login
```

### **Step 3: Deploy to Vercel**

```bash
# Navigate to your project directory
cd primer-checkout-1

# Deploy (follow the prompts)
vercel

# For production deployment
vercel --prod
```

### **Step 4: Configure Environment Variables**

After deployment, add your environment variables:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**
3. **Go to Settings > Environment Variables**
4. **Add these variables**:

#### **Required Variables:**
```
PRIMER_API_KEY=sk_test_your_actual_primer_api_key_here
```

#### **Optional Variables:**
```
PRIMER_API_URL=https://api.sandbox.primer.io/client-session
PRIMER_WEBHOOK_SECRET=your_webhook_secret_here
NODE_ENV=production
VERIFY_WEBHOOKS=true
```

### **Step 5: Configure Primer Dashboard**

1. **Login to Primer Dashboard**: https://dashboard.primer.io
2. **Go to Settings > Webhooks**
3. **Add your Vercel webhook URL**:
   ```
   https://your-project-name.vercel.app/webhook
   ```
4. **Select these events**:
   - `PAYMENT_CREATED`
   - `PAYMENT_AUTHORIZED` 
   - `PAYMENT_CAPTURED`
   - `PAYMENT_FAILED`
   - `PAYMENT_CANCELLED`

## 🎯 Vercel Scripts Available

```bash
# Local development with Vercel
yarn dev:vercel

# Deploy preview (staging)
yarn deploy:preview

# Deploy to production
yarn deploy

# Test health endpoint
curl https://your-project.vercel.app/health
```

## 🔍 Testing Your Deployment

### **1. Health Check**
Visit: `https://your-project.vercel.app/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "production",
  "version": "2.1.0",
  "platform": "vercel"
}
```

### **2. Main Application**
Visit: `https://your-project.vercel.app`

Should show the Primer checkout demo interface.

### **3. Test Payment**
1. Change amount/currency using the controls
2. Click "Start Secure Checkout"
3. Use Primer test cards for payments

## 🔒 Security Considerations

### **Production Checklist:**
- [ ] Use live Primer API key (`sk_live_...`)
- [ ] Set `PRIMER_API_URL` to `https://api.primer.io/client-session`
- [ ] Configure webhook secret
- [ ] Enable webhook signature verification
- [ ] Add your domain to Primer dashboard

### **Environment Variables Security:**
- [ ] Never commit API keys to git
- [ ] Use Vercel's environment variable system
- [ ] Different keys for staging vs production
- [ ] Regular key rotation

## 🚨 Troubleshooting

### **Common Issues:**

#### **1. API Key Not Configured**
```
Error: Primer API Key not configured
```
**Solution**: Add `PRIMER_API_KEY` in Vercel environment variables

#### **2. 404 on API Routes**
```
Error: 404 - API route not found
```
**Solution**: Check `vercel.json` routing configuration

#### **3. CSP Errors (Development)**
```
Content Security Policy directive violated
```
**Solution**: CSP is disabled in development, safe to ignore

#### **4. Webhook Signature Verification**
```
Error: Invalid webhook signature
```
**Solution**: 
- Add `PRIMER_WEBHOOK_SECRET` environment variable
- Or set `VERIFY_WEBHOOKS=false` for testing

### **Debug Commands:**

```bash
# Check deployment logs
vercel logs

# Local development with debugging
vercel dev --debug

# Test API endpoints locally
curl http://localhost:3000/health
```

## 📊 Monitoring & Analytics

### **Vercel Dashboard:**
- **Functions**: Monitor API performance
- **Analytics**: Track usage and performance
- **Logs**: Debug issues in production

### **Primer Dashboard:**
- **Payments**: Monitor payment success rates
- **Webhooks**: Track webhook delivery
- **Analytics**: Payment insights

## 🔄 Updates & Maintenance

### **Deploying Updates:**
```bash
# Make your changes
git add .
git commit -m "Update checkout flow"
git push

# Deploy to production
vercel --prod
```

### **Environment Updates:**
1. Update environment variables in Vercel dashboard
2. Redeploy to apply changes: `vercel --prod`

## 🎉 Success!

Your Primer checkout demo is now live on Vercel! 

- **Demo URL**: `https://your-project.vercel.app`
- **Health Check**: `https://your-project.vercel.app/health`
- **Webhook URL**: `https://your-project.vercel.app/webhook`

## 📞 Support

- **Vercel Support**: https://vercel.com/support
- **Primer Support**: https://primer.io/support
- **Documentation**: https://primer.io/docs
