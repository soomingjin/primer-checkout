import { 
  validateApiKey, 
  generateOrderId, 
  createSessionSchema, 
  retryWithBackoff,
  config,
  errorResponse,
  successResponse,
  setCorsHeaders
} from './_utils.js';

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
    
    // Validate request body
    const { error, value } = createSessionSchema.validate(req.body);
    if (error) {
      return errorResponse(res, 400, 'Invalid request data', error.details.map(d => d.message));
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
      const apiResponse = await fetch(config.PRIMER_API_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': config.PRIMER_API_KEY,
          'Content-Type': 'application/json',
          'X-API-Version': '2.4',
          'User-Agent': 'PrimerCheckoutDemo/2.1.0'
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
    const responseData = {
      clientToken: response.clientToken,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currencyCode,
      expiresAt: response.expiresAt
    };

    return successResponse(res, responseData);

  } catch (error) {
    console.error('❌ Failed to create client session:', error.message);
    
    // Enhanced error response
    const statusCode = error.status || 500;
    const errorMessage = error.message || 'Failed to create client session';
    
    return errorResponse(res, statusCode, errorMessage, 
      config.NODE_ENV === 'development' ? error.data : undefined
    );
  }
}
