import { validateApiKey, generateOrderId, retryWithBackoff, errorResponse, successResponse, setCorsHeaders, config } from './_utils.js';
import Joi from 'joi';

// Import fetch for Vercel environment
let fetch;
try {
  fetch = (await import('node-fetch')).default;
} catch (e) {
  // Use global fetch if available (newer Node.js versions)
  fetch = global.fetch;
}

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return setCorsHeaders(res).status(200).end();
  }

  if (req.method !== 'POST') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    // Validate API key
    validateApiKey();

    // Validation schema - accepts firstPaymentReason as input parameter
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
      return errorResponse(res, 400, 'Invalid request data', error.details.map(d => d.message));
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

    // Add paymentMethod object with firstPaymentReason if provided (per Primer API docs)
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
          'X-Api-Key': config.PRIMER_API_KEY,
          'X-Api-Version': '2.4',
          'X-Idempotency-Key': `charge-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        },
        body: JSON.stringify(paymentRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Primer Payments API error:', errorData);
        throw new Error(`Primer Payments API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    }, 3);

    console.log('✅ Payment processed successfully:', {
      paymentId: paymentResponse.id,
      status: paymentResponse.status,
      amount: paymentResponse.amount
    });

    return successResponse(res, {
      success: true,
      payment: paymentResponse,
      message: `Payment ${paymentResponse.status.toLowerCase()} successfully`
    });

  } catch (error) {
    console.error('❌ Failed to charge payment method token:', error.message);
    return errorResponse(res, 500, 'Failed to charge payment method token', error.message);
  }
}