import { 
  validateApiKey, 
  config,
  errorResponse,
  successResponse,
  setCorsHeaders
} from '../_utils.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return setCorsHeaders(res).status(200).end();
  }

  if (req.method !== 'GET') {
    return errorResponse(res, 405, 'Method not allowed');
  }

  try {
    // Validate API key
    validateApiKey();
    
    // Extract payment ID from the route
    const { id: paymentId } = req.query;
    
    if (!paymentId) {
      return errorResponse(res, 400, 'Payment ID is required');
    }

    console.log(`🔍 Fetching payment status for ID: ${paymentId}`);

    // Make request to Primer API
    const response = await fetch(`https://api.sandbox.primer.io/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': config.PRIMER_API_KEY,
        'Content-Type': 'application/json',
        'X-API-Version': '2.4',
        'User-Agent': 'PrimerCheckoutDemo/2.1.0'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Primer API error:`, data);
      return errorResponse(res, response.status, data.message || 'Failed to get payment status', data);
    }

    console.log(`✅ Payment status retrieved for ID: ${paymentId}`);
    return successResponse(res, data);

  } catch (error) {
    console.error('❌ Payment status check failed:', error);
    return errorResponse(res, 500, 'Internal server error', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
