import Joi from 'joi';
import crypto from 'crypto';

// Environment configuration
export const config = {
  PRIMER_API_URL: process.env.PRIMER_API_URL || 'https://api.sandbox.primer.io/client-session',
  PRIMER_API_KEY: process.env.PRIMER_API_KEY,
  WEBHOOK_SECRET: process.env.PRIMER_WEBHOOK_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'production'
};

// Validation schemas
export const createSessionSchema = Joi.object({
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

// Utility functions
export function validateApiKey() {
  if (!config.PRIMER_API_KEY || config.PRIMER_API_KEY === 'sk_test_...') {
    throw new Error('Primer API Key not configured. Please check your environment variables.');
  }
}

export function generateOrderId() {
  return `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function verifyWebhookSignature(payload, signature) {
  if (!config.WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured - skipping signature verification');
    return true;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', config.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
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

// CORS headers for Vercel
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

// Error response helper
export function errorResponse(res, statusCode, message, details = null) {
  setCorsHeaders(res);
  return res.status(statusCode).json({
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString()
  });
}

// Success response helper
export function successResponse(res, data, statusCode = 200) {
  setCorsHeaders(res);
  return res.status(statusCode).json(data);
}
