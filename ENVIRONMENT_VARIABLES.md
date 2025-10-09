# 🔐 Environment Variables for Vercel Deployment

Copy these variables to your Vercel project settings.

## 📝 How to Add Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings > Environment Variables**
4. Add each variable below

## ✅ Required Variables

```
PRIMER_API_KEY
```
**Value**: `sk_test_your_actual_primer_api_key_here`
**Description**: Your Primer API key from dashboard.primer.io

## 🔧 Optional Variables

```
PRIMER_API_URL
```
**Value**: `https://api.sandbox.primer.io/client-session`
**Description**: Primer API endpoint (use sandbox for testing)

```
PRIMER_WEBHOOK_SECRET
```  
**Value**: `your_webhook_secret_here`
**Description**: Webhook secret from Primer dashboard

```
NODE_ENV
```
**Value**: `production`
**Description**: Environment type (Vercel sets this automatically)

```
VERIFY_WEBHOOKS
```
**Value**: `true`
**Description**: Enable webhook signature verification

## 🚀 Production Values

For production deployment, update these values:

```
PRIMER_API_KEY=sk_live_your_live_api_key_here
PRIMER_API_URL=https://api.primer.io/client-session
VERIFY_WEBHOOKS=true
```

## 📋 Quick Copy Format

For easy copying into Vercel:

```
Name: PRIMER_API_KEY
Value: sk_test_your_actual_primer_api_key_here

Name: PRIMER_API_URL  
Value: https://api.sandbox.primer.io/client-session

Name: PRIMER_WEBHOOK_SECRET
Value: your_webhook_secret_here

Name: VERIFY_WEBHOOKS
Value: true
```

## 🔍 Where to Find Values

- **PRIMER_API_KEY**: [Primer Dashboard](https://dashboard.primer.io) > Settings > API Keys
- **PRIMER_WEBHOOK_SECRET**: [Primer Dashboard](https://dashboard.primer.io) > Settings > Webhooks > Create Webhook
- **PRIMER_API_URL**: Use sandbox URL for testing, production URL for live payments
