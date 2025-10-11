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
      const { userId, cartId, amount = 4999, currency = 'GBP', customerEmail, customerId, items } = value;
      
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
          // Required for Apple Pay - country where order is created
          countryCode: value.countryCode || "GB",
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
          }]
        },
      
        // Payment method configuration with Apple Pay support
        paymentMethod: {
          vaultOnSuccess: Boolean(customerId), // Enable vaulting when customerId is provided
          // Apple Pay specific options (as per Primer API docs)
          options: {
            APPLE_PAY: {
              // Merchant display name for Apple Pay
              ...(value.applePayMerchantName && {
                merchantDisplayName: value.applePayMerchantName
              }),
              // Payment capabilities based on scenario type
              ...(value.applePayRecurring && {
                merchantCapabilities: ["supports3DS", "supportsEMV", "supportsCredit", "supportsDebit"],
                paymentSummaryItems: [{
                  label: "Recurring Payment Setup",
                  amount: amount,
                  type: "final"
                }]
              }),
              ...(value.applePayDeferred && {
                merchantCapabilities: ["supports3DS", "supportsEMV", "supportsCredit"],
                paymentSummaryItems: [{
                  label: "Buy Now, Pay Later",
                  amount: amount,
                  type: "pending"
                }]
              }),
              ...(value.applePayAutoReload && {
                merchantCapabilities: ["supports3DS", "supportsEMV", "supportsCredit", "supportsDebit"],
                paymentSummaryItems: [{
                  label: "Auto-reload Setup", 
                  amount: amount,
                  type: "final"
                }]
              })
            }
          }
        }
      };
    }
    
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
