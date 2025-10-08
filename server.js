import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import Joi from 'joi';
import crypto from 'crypto';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Helper for ES Modules to get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primer API Configuration
const PRIMER_API_URL = process.env.PRIMER_API_URL || 'https://api.sandbox.primer.io/client-session';
const PRIMER_WEBHOOK_URL = 'https://api.sandbox.primer.io/webhooks';
const PRIMER_API_KEY = process.env.PRIMER_API_KEY;
const WEBHOOK_SECRET = process.env.PRIMER_WEBHOOK_SECRET;

// Validation schemas
const createSessionSchema = Joi.object({
  userId: Joi.string().min(1).max(100),
  cartId: Joi.string().min(1).max(100),
  amount: Joi.number().positive().max(9999999),
  currency: Joi.string().length(3).uppercase().valid('GBP', 'USD', 'EUR', 'JPY').default('GBP'),
  customerEmail: Joi.string().email(),
  items: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    amount: Joi.number().positive().required(),
    quantity: Joi.number().integer().positive().required()
  }))
});

// Security middleware - disable CSP in development for Primer SDK compatibility
if (NODE_ENV === 'production') {
  // Production CSP (more restrictive)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://*.primer.io"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://*.primer.io"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://*.primer.io"],
        frameSrc: ["'self'", "https://*.primer.io"],
        formAction: ["'self'", "https://*.primer.io"]
      }
    }
  }));
} else {
  // Development - disable CSP to allow Primer SDK full functionality
  console.log('🔓 CSP disabled in development mode for Primer SDK compatibility');
  app.use(helmet({
    contentSecurityPolicy: false  // Completely disable CSP in development
  }));
}

// CORS configuration
const corsOptions = {
  origin: NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : true,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const createSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many session creation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Higher limit for webhooks
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use('/create-client-session', createSessionLimiter);
app.use('/webhook', webhookLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Utility functions
function validateApiKey() {
  if (!PRIMER_API_KEY || PRIMER_API_KEY === 'sk_test_...') {
    throw new Error('Primer API Key not configured. Please check your .env file.');
  }
}

function generateOrderId() {
  return `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function verifyWebhookSignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured - skipping signature verification');
    return true;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details.map(d => d.message)
    });
  }
  
  res.status(500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '2.0.0'
  });
});

// Enhanced route to create the Client Session
app.post('/create-client-session', async (req, res) => {
  try {
    // Validate API key
    validateApiKey();
    
    // Validate request body
    const { error, value } = createSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.details.map(d => d.message)
      });
    }
    
    const { userId, cartId, amount = 4999, currency = 'GBP', customerEmail, items } = value;
    
    // Build order data following official Primer API format
    const orderData = {
      // Required fields per official documentation
      orderId: generateOrderId(),
      currencyCode: currency,
      amount: amount,
      
      // Customer information (as per official docs)
      customer: {
        emailAddress: customerEmail || "demo@example.com"
      },
      
      // Order details with line items (required per official docs)
      order: {
        lineItems: items ? items.map(item => ({
          itemId: item.id,
          description: item.name,
          amount: item.amount,
          quantity: item.quantity
        })) : [{
          itemId: "hoodie-sku-1",
          description: "Premium Primer Hoodie", 
          amount: amount,
          quantity: 1
        }],
        // Optional: Add country code for better payment method selection
        countryCode: "GB"
      },
      
      // Optional: Payment method configuration
      paymentMethod: {
        vaultOnSuccess: false
      }
    };
    
    // Make API call with retry logic
    const response = await retryWithBackoff(async () => {
      const apiResponse = await fetch(PRIMER_API_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': PRIMER_API_KEY,
          'Content-Type': 'application/json',
          'X-API-VERSION': '2.4',
          'User-Agent': 'PrimerCheckoutDemo/2.0.0'
        },
        body: JSON.stringify(orderData),
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        const error = new Error(data.message || 'Primer API request failed');
        error.status = apiResponse.status;
        error.data = data;
        throw error;
      }

      return data;
    });

    // Log successful session creation (without sensitive data)
    console.log(`✅ Client session created successfully for order: ${orderData.orderId}`);
    
    // Return enhanced response
    res.json({
      clientToken: response.clientToken,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currencyCode,
      expiresAt: response.expiresAt
    });

  } catch (error) {
    console.error('❌ Failed to create client session:', error.message);
    
    // Enhanced error response
    const statusCode = error.status || 500;
    const errorResponse = {
      error: 'Failed to create client session',
      message: error.message,
      timestamp: new Date().toISOString()
    };
    
    // Add debug info in development
    if (NODE_ENV === 'development' && error.data) {
      errorResponse.debug = error.data;
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

// Webhook endpoint following official Primer documentation
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.headers['x-primer-signature'];
    const payload = req.body;
    
    console.log('📥 Received webhook request');
    
    // Verify webhook signature (recommended for production)
    if (process.env.VERIFY_WEBHOOKS !== 'false' && !verifyWebhookSignature(payload, signature)) {
      console.warn('⚠️ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event = JSON.parse(payload);
    const { eventType, data } = event;
    const payment = data?.payment;
    
    console.log(`📡 Processing webhook: ${eventType}`, {
      paymentId: payment?.id,
      status: payment?.status,
      amount: payment?.amount,
      currency: payment?.currencyCode
    });
    
    // Handle different webhook events following official Primer patterns
    switch (eventType) {
      case 'PAYMENT_CREATED':
        handlePaymentCreated(payment);
        break;
        
      case 'PAYMENT_AUTHORIZED':
        handlePaymentAuthorized(payment);
        break;
        
      case 'PAYMENT_CAPTURED':
        handlePaymentCaptured(payment);
        break;
        
      case 'PAYMENT_FAILED':
        handlePaymentFailed(payment);
        break;
        
      case 'PAYMENT_CANCELLED':
        handlePaymentCancelled(payment);
        break;
        
      default:
        console.log('📧 Unhandled webhook event type:', eventType);
    }
    
    // Always acknowledge webhook receipt (important for Primer)
    res.status(200).json({ 
      received: true,
      eventType: eventType,
      paymentId: payment?.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🚨 Webhook processing error:', error.message);
    // Return 400 for client errors, 500 for server errors
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    res.status(statusCode).json({ 
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook event handlers following official Primer best practices

function handlePaymentCreated(payment) {
  console.log('💳 Payment Created:', {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currencyCode,
    status: payment.status
  });
  
  // TODO: Update your database to record payment creation
  // - Store payment ID and status
  // - Link payment to order
  // - Set order status to "payment_initiated"
}

function handlePaymentAuthorized(payment) {
  console.log('✅ Payment Authorized:', {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currencyCode,
    paymentMethodType: payment.paymentMethodType
  });
  
  // TODO: Implement order fulfillment logic
  // - Update order status to "authorized"
  // - Reserve inventory
  // - Send order confirmation email
  // - Trigger fulfillment processes
  
  console.log('🚀 Order fulfillment triggered for payment:', payment.id);
}

function handlePaymentCaptured(payment) {
  console.log('💰 Payment Captured:', {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amount,
    currency: payment.currencyCode
  });
  
  // TODO: Complete order fulfillment
  // - Update order status to "paid"
  // - Process shipping
  // - Send tracking information
  // - Update accounting records
  
  console.log('✅ Payment capture completed for order:', payment.orderId);
}

function handlePaymentFailed(payment) {
  console.log('❌ Payment Failed:', {
    id: payment.id,
    orderId: payment.orderId,
    failureReason: payment.failureReason,
    status: payment.status
  });
  
  // TODO: Handle payment failure
  // - Update order status to "payment_failed"
  // - Release reserved inventory
  // - Notify customer of failure
  // - Offer alternative payment methods
  
  console.log('🔄 Payment failure handling initiated for order:', payment.orderId);
}

function handlePaymentCancelled(payment) {
  console.log('🚫 Payment Cancelled:', {
    id: payment.id,
    orderId: payment.orderId,
    status: payment.status
  });
  
  // TODO: Handle payment cancellation
  // - Update order status to "cancelled"
  // - Release reserved inventory
  // - Send cancellation confirmation
};

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with enhanced error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Primer Checkout Demo server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🔐 API Key configured: ${PRIMER_API_KEY ? '✅' : '❌'}`);
  console.log(`🔗 Webhook secret configured: ${WEBHOOK_SECRET ? '✅' : '❌'}`);
});

// Handle server startup errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log('💡 Solutions:');
    console.log(`   • Kill existing process: pkill -f "node server.js"`);
    console.log(`   • Use different port: PORT=3001 yarn start`);
    console.log(`   • Find process using port: lsof -ti:${PORT}`);
  } else {
    console.error(`❌ Server startup error:`, err.message);
  }
  process.exit(1);
});