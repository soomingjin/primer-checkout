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

// Validation schemas - Support both internal format and direct Primer API format
const createSessionSchema = Joi.object({
  // Internal format fields
  userId: Joi.string().min(1).max(100).optional(),
  cartId: Joi.string().min(1).max(100).optional(),
  amount: Joi.number().positive().max(9999999).optional(),
  currency: Joi.string().length(3).uppercase().valid('GBP', 'USD', 'EUR', 'JPY').default('GBP').optional(),
  customerEmail: Joi.string().email().optional(),
  customerId: Joi.string().min(1).max(256).optional(), // Support for Primer customerId
  
  // Direct Primer API format fields
  orderId: Joi.string().min(1).max(256).optional(), // Direct Primer API format
  currencyCode: Joi.string().length(3).uppercase().valid('GBP', 'USD', 'EUR', 'JPY').optional(), // Primer API format
  
  // Apple Pay specific parameters (as per Primer Apple Pay docs)
  countryCode: Joi.string().length(2).uppercase().default('GB').optional(), // Required for Apple Pay
  applePayMerchantName: Joi.string().min(1).max(128).optional(), // Override merchant name
  applePayRecurring: Joi.boolean().default(false).optional(), // Enable recurring payments
  applePayDeferred: Joi.boolean().default(false).optional(), // Enable deferred payments  
  applePayAutoReload: Joi.boolean().default(false).optional(), // Enable automatic reload
  
  // Internal format items
  items: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    amount: Joi.number().positive().required(),
    quantity: Joi.number().integer().positive().required()
  })).optional(),
  
  // Direct Primer API format
  order: Joi.object({
    countryCode: Joi.string().length(2).uppercase().optional(),
    lineItems: Joi.array().items(Joi.object({
      itemId: Joi.string().required(),
      description: Joi.string().required(),
      amount: Joi.number().positive().required(),
      quantity: Joi.number().integer().positive().required()
    })).optional()
  }).optional(),
  
  // Direct Primer API customer format
  customer: Joi.object({
    emailAddress: Joi.string().email().optional()
  }).optional(),
  
  // Direct Primer API payment method format
  paymentMethod: Joi.object({
    vaultOnSuccess: Joi.boolean().optional(),
    firstPaymentReason: Joi.string().valid('CardOnFile', 'Recurring', 'Unscheduled').optional(),
    options: Joi.object({
      APPLE_PAY: Joi.object({
        merchantName: Joi.string().optional(),
        recurringPaymentRequest: Joi.object().unknown().optional(),
        deferredPaymentRequest: Joi.object().unknown().optional(),
        automaticReloadRequest: Joi.object().unknown().optional()
      }).optional()
    }).optional()
  }).optional(),
  
  // Payment type for recurring payments (as per Primer API v2.4+)
  paymentType: Joi.string().valid('FIRST_PAYMENT', 'ECOMMERCE', 'SUBSCRIPTION', 'UNSCHEDULED').optional(),
  
  // Allow any other Primer API fields
  metadata: Joi.object().unknown().optional()
}).unknown(); // Allow unknown fields for direct Primer API compatibility

// Security middleware - disable CSP for Vercel deployment (CSP handled by vercel.json)
if (NODE_ENV === 'production') {
  // Disable CSP in production - handled by vercel.json headers
  console.log('🔒 CSP configured via vercel.json headers for production');
  app.use(helmet({
    contentSecurityPolicy: false  // Let vercel.json handle CSP
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
app.use(express.static(path.join(__dirname, 'public')));

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

// Payment status endpoint - GET /payments/{id}
app.get('/payments/:id', async (req, res) => {
  try {
    // Validate API key
    if (!PRIMER_API_KEY || PRIMER_API_KEY === 'sk_test_...') {
      return res.status(500).json({
        error: 'Primer API Key not configured. Please check your environment variables.',
        timestamp: new Date().toISOString()
      });
    }
    
    const { id: paymentId } = req.params;
    
    if (!paymentId) {
      return res.status(400).json({
        error: 'Payment ID is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Fetching payment status for ID: ${paymentId}`);

    // Make request to Primer API
    const response = await fetch(`https://api.sandbox.primer.io/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': PRIMER_API_KEY,
        'Content-Type': 'application/json',
        'X-API-Version': '2.4',
        'User-Agent': 'PrimerCheckoutDemo/2.1.0'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Primer API error:`, data);
      return res.status(response.status).json({
        error: data.message || 'Failed to get payment status',
        details: data,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ Payment status retrieved for ID: ${paymentId}`);
    return res.json(data);

  } catch (error) {
    console.error('❌ Payment status check failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Charge payment method token endpoint - POST /charge-payment-method
app.post('/charge-payment-method', async (req, res) => {
  try {
    // Validate API key
    if (!PRIMER_API_KEY || PRIMER_API_KEY === 'sk_test_...') {
      return res.status(500).json({
        error: 'Primer API Key not configured. Please check your environment variables.',
        timestamp: new Date().toISOString()
      });
    }

    // Validation schema
    const chargeSchema = Joi.object({
      paymentMethodToken: Joi.string().required(),
      amount: Joi.number().positive().max(9999999).required(),
      currencyCode: Joi.string().length(3).uppercase().valid('GBP', 'USD', 'EUR', 'JPY').default('GBP').required(),
      orderId: Joi.string().min(1).max(256).optional(),
      paymentType: Joi.string().valid('FIRST_PAYMENT', 'ECOMMERCE', 'SUBSCRIPTION', 'UNSCHEDULED').optional(),
      firstPaymentReason: Joi.string().valid('CardOnFile', 'Recurring', 'Unscheduled').optional(),
      customerId: Joi.string().min(1).max(256).optional(),
      customerEmail: Joi.string().email().optional(),
      description: Joi.string().max(500).optional(),
      metadata: Joi.object().unknown().optional()
    });
    
    // Validate request body
    const { error, value } = chargeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.details.map(d => d.message),
        timestamp: new Date().toISOString()
      });
    }

    console.log('💳 Processing payment method token charge:', {
      token: value.paymentMethodToken.substring(0, 20) + '...',
      amount: value.amount,
      currency: value.currencyCode,
      paymentType: value.paymentType
    });

    // Prepare payment request for Primer Payments API
    const paymentRequest = {
      orderId: value.orderId || generateOrderId(),
      amount: value.amount,
      currencyCode: value.currencyCode,
      paymentMethodToken: value.paymentMethodToken,
      ...(value.paymentType && { paymentType: value.paymentType }),
      ...(value.customerId && { customerId: value.customerId }),
      ...(value.description && { description: value.description }),
      ...(value.metadata && { metadata: value.metadata })
    };

    // Add paymentMethod object with firstPaymentReason if provided
    if (value.firstPaymentReason) {
      paymentRequest.paymentMethod = {
        firstPaymentReason: value.firstPaymentReason
      };
    }

    console.log('📤 Sending payment request to Primer:', JSON.stringify(paymentRequest, null, 2));

    // Call Primer Payments API with retry logic
    const paymentResponse = await retryWithBackoff(async () => {
      const response = await fetch('https://api.sandbox.primer.io/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': PRIMER_API_KEY,
          'X-Api-Version': '2.4',
          'X-Idempotency-Key': `charge-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        },
        body: JSON.stringify(paymentRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Primer Payments API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Primer Payments API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    }, 3);

    console.log('✅ Payment processed successfully:', {
      paymentId: paymentResponse.id,
      status: paymentResponse.status,
      amount: paymentResponse.amount,
      currency: paymentResponse.currencyCode
    });

    return res.json({
      success: true,
      payment: paymentResponse,
      message: `Payment ${paymentResponse.status.toLowerCase()} successfully`
    });

  } catch (error) {
    console.error('❌ Payment method token charge failed:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Failed to charge payment method token';
    if (error.message.includes('Primer Payments API request failed')) {
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = `Payment processing error: ${error.message}`;
    }

    return res.status(500).json({
      error: errorMessage,
      timestamp: new Date().toISOString(),
      debug: NODE_ENV === 'development' ? error.message : undefined
    });
  }
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
    
    // Handle both internal format and direct Primer API format
    let orderData;
    
    // Check if this is direct Primer API format (has orderId or currencyCode)
    if (value.orderId || value.currencyCode || value.order) {
      console.log('📦 Processing direct Primer API format');
      
      // Use the payload directly but ensure required fields
      orderData = {
        // Use provided orderId or generate one
        orderId: value.orderId || generateOrderId(),
        
        // Handle currency - prefer currencyCode, fallback to currency
        currencyCode: value.currencyCode || value.currency || 'GBP',
        
        // Use provided amount or default
        amount: value.amount || 4999,
        
        // Pass through other Primer API fields
        ...(value.customerId && { customerId: value.customerId }),
        ...(value.customer && { customer: value.customer }),
        ...(value.order && { order: value.order }),
        ...(value.paymentMethod && { paymentMethod: value.paymentMethod }),
        ...(value.paymentType && { paymentType: value.paymentType }),
        ...(value.metadata && { metadata: value.metadata }),
        
        // Ensure we have customer info if not provided
        ...(!value.customer && {
          customer: {
            emailAddress: value.customerEmail || "demo@example.com"
          }
        }),
        
        // Ensure we have order info if not provided
        ...(!value.order && {
          order: {
            countryCode: value.countryCode || "GB",
            lineItems: [{
              itemId: "direct-api-item",
              description: "Direct API Test Item",
              amount: value.amount || 4999,
              quantity: 1
            }]
          }
        })
      };
    } else {
      console.log('📦 Processing internal format');
      
      // Process internal format (original logic)
      const { userId, cartId, amount = 4999, currency = 'GBP', customerEmail, customerId, items, 
              countryCode, applePayMerchantName, applePayRecurring, applePayDeferred, applePayAutoReload,
              paymentType, firstPaymentReason } = value;
    
      orderData = {
      // Required fields per official documentation
      orderId: generateOrderId(),
      currencyCode: currency,
      amount: amount,
      
      // Customer ID for enabling saved payment methods (as per official docs)
      ...(customerId && { customerId: customerId }),
      
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
        // Required for Apple Pay - country where order is created
        countryCode: countryCode || "GB"
      },
      
      // Payment method configuration with Apple Pay support and recurring payment support
      paymentMethod: {
        vaultOnSuccess: Boolean(customerId), // Enable vaulting when customerId is provided
        ...(firstPaymentReason && { firstPaymentReason: firstPaymentReason }), // For recurring payments
        // Apple Pay specific options (as per Primer API docs)
        options: {
          APPLE_PAY: {
            // Merchant display name for Apple Pay
            ...(applePayMerchantName && {
              merchantDisplayName: applePayMerchantName
            }),
            // Payment capabilities based on scenario type
            ...(applePayRecurring && {
              merchantCapabilities: ["supports3DS", "supportsEMV", "supportsCredit", "supportsDebit"],
              paymentSummaryItems: [{
                label: "Recurring Payment Setup",
                amount: amount,
                type: "final"
              }]
            }),
            ...(applePayDeferred && {
              merchantCapabilities: ["supports3DS", "supportsEMV", "supportsCredit"],
              paymentSummaryItems: [{
                label: "Buy Now, Pay Later",
                amount: amount,
                type: "pending"
              }]
            }),
            ...(applePayAutoReload && {
              merchantCapabilities: ["supports3DS", "supportsEMV", "supportsCredit", "supportsDebit"],
              paymentSummaryItems: [{
                label: "Auto-reload Setup", 
                amount: amount,
                type: "final"
              }]
            })
          }
        }
      },
      
      // Payment type for recurring payments (as per Primer API v2.4+)
      ...(paymentType && { paymentType: paymentType })
    };
  }
    
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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