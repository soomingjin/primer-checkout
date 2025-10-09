import { 
  verifyWebhookSignature,
  config,
  errorResponse,
  successResponse,
  setCorsHeaders
} from './_utils.js';

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
    const signature = req.headers['x-primer-signature'];
    const payload = JSON.stringify(req.body);
    
    console.log('📥 Received webhook request');
    
    // Verify webhook signature (recommended for production)
    if (process.env.VERIFY_WEBHOOKS !== 'false' && !verifyWebhookSignature(payload, signature)) {
      console.warn('⚠️ Invalid webhook signature');
      return errorResponse(res, 401, 'Invalid signature');
    }
    
    const event = req.body;
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
    const responseData = { 
      received: true,
      eventType: eventType,
      paymentId: payment?.id,
      timestamp: new Date().toISOString()
    };

    return successResponse(res, responseData);
    
  } catch (error) {
    console.error('🚨 Webhook processing error:', error.message);
    // Return 400 for client errors, 500 for server errors
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    return errorResponse(res, statusCode, 'Webhook processing failed', error.message);
  }
}
