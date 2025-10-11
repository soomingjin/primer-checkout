# 🔄 **Recurring Payments Implementation Guide**

## 📋 **Overview**

This document outlines the implementation of recurring payments functionality in the Primer Checkout Demo, following [Primer's official recurring payments guidelines](https://primer.io/docs/get-started/recurring-payments).

## 🎯 **Features Implemented**

### **1. Payment Method Token Charging**
- **Direct Payment API**: Charge saved payment method tokens using Primer's Payments API
- **Recurring Support**: Full support for subscription and recurring payment scenarios
- **Payment Types**: FIRST_PAYMENT, ECOMMERCE, SUBSCRIPTION, UNSCHEDULED
- **First Payment Reasons**: CardOnFile, Recurring, Unscheduled

### **2. Enhanced Client Session Creation**
- **Payment Type Configuration**: Proper setup for initial payments in recurring series
- **First Payment Reason**: Compliance with processor requirements
- **Test Scenarios**: Updated scenarios with proper recurring payment attributes

### **3. Developer Debug Panel**
- **Token Charging UI**: Interactive interface for testing payment method tokens
- **Parameter Configuration**: Full control over payment types and reasons
- **Real-time Feedback**: Live response display and error handling

## 🏗️ **Architecture**

### **API Endpoints**

#### **1. `/charge-payment-method` (NEW)**
**Purpose**: Charge payment method tokens directly via Primer's Payments API

**Request Format**:
```json
{
  "paymentMethodToken": "pm_...",
  "amount": 1999,
  "currencyCode": "GBP",
  "paymentType": "SUBSCRIPTION",
  "firstPaymentReason": "Recurring",
  "customerId": "customer-123",
  "description": "Monthly subscription charge"
}
```

**Response Format**:
```json
{
  "success": true,
  "payment": {
    "id": "pay_abc123",
    "status": "AUTHORIZED",
    "amount": 1999,
    "currencyCode": "GBP"
  },
  "message": "Payment authorized successfully"
}
```

#### **2. `/create-client-session` (ENHANCED)**
**New Parameters Added**:
- `paymentType`: Payment flow type for Primer's optimization
- `firstPaymentReason`: Why the payment method is being stored

## 🔧 **Implementation Details**

### **1. Payment Types (Primer API v2.4+)**

According to [Primer's documentation](https://primer.io/docs/get-started/recurring-payments), these payment types optimize processor routing:

| Payment Type | Description | Use Case |
|--------------|-------------|----------|
| `FIRST_PAYMENT` | Customer-initiated setup | Initial subscription signup |
| `ECOMMERCE` | Customer present | Card-on-file with customer |
| `SUBSCRIPTION` | Merchant-initiated recurring | Monthly/yearly charges |
| `UNSCHEDULED` | Variable merchant-initiated | Usage-based billing |

### **2. First Payment Reasons**

These align with processor requirements for card storage:

| Reason | Description | Correlates With |
|--------|-------------|-----------------|
| `CardOnFile` | General card storage | ECOMMERCE paymentType |
| `Recurring` | Subscription setup | SUBSCRIPTION paymentType |
| `Unscheduled` | Variable payments | UNSCHEDULED paymentType |

### **3. Test Scenarios Updated**

```javascript
const scenarios = {
  success: { 
    paymentType: 'FIRST_PAYMENT',
    firstPaymentReason: 'CardOnFile'
  },
  vault: { 
    paymentType: 'FIRST_PAYMENT',
    firstPaymentReason: 'CardOnFile'
  },
  subscription: { 
    paymentType: 'FIRST_PAYMENT',
    firstPaymentReason: 'Recurring'
  }
};
```

## 💻 **Code Changes Summary**

### **Backend Changes**

#### **1. New API Endpoint** (`api/charge-payment-method.js`)
- **Validation**: Joi schema for payment method token charging
- **Primer Integration**: Direct calls to Primer Payments API v2.4
- **Error Handling**: Comprehensive error mapping and retry logic
- **Idempotency**: Automatic idempotency key generation

#### **2. Server Updates** (`server.js`)
- **New Route**: `/charge-payment-method` endpoint for development
- **Schema Enhancement**: Added `paymentType` and `firstPaymentReason` to validation
- **Client Session**: Enhanced to include recurring payment parameters

#### **3. Vercel Configuration** (`vercel.json`)
- **URL Rewrite**: Added routing for new charge endpoint

### **Frontend Changes**

#### **1. Debug Panel UI** (`public/index.html`)
- **New Section**: Payment Method Token Charging interface
- **Form Controls**: Payment type, first payment reason selectors
- **Response Display**: Formatted payment results with expandable details

#### **2. JavaScript Enhancement**
- **New Methods**: `chargePaymentMethod()`, `clearPaymentCharge()`
- **Event Listeners**: Button handlers for charging functionality
- **Request Building**: Proper payload construction with recurring parameters
- **Error Handling**: User-friendly error messages and logging

#### **3. Test Scenarios**
- **Enhanced Scenarios**: Added `paymentType` and `firstPaymentReason` to all scenarios
- **Parameter Passing**: Automatic inclusion in client session requests

## 🎯 **Usage Examples**

### **1. Subscription Setup (First Payment)**
```javascript
// Frontend: Apply subscription scenario
await this.applyTestScenario('subscription');
// This sets:
// - paymentType: 'FIRST_PAYMENT'
// - firstPaymentReason: 'Recurring'
// - amount: £19.99
// - customerEmail: 'subscription@test.com'
```

### **2. Recurring Charge (Subsequent Payment)**
```javascript
// Use the debug panel to charge saved token:
const chargeRequest = {
  paymentMethodToken: 'pm_abc123', // From previous payment
  amount: 1999,
  currencyCode: 'GBP',
  paymentType: 'SUBSCRIPTION',
  customerId: 'customer-subscription-test-com'
};
```

### **3. Card-on-File Setup**
```javascript
// Apply success scenario for general card storage:
await this.applyTestScenario('success');
// This sets:
// - paymentType: 'FIRST_PAYMENT'
// - firstPaymentReason: 'CardOnFile'
```

## 🔍 **Testing Workflow**

### **1. Initial Setup (Vaulting)**
1. Use "Subscription" or "Vault Customer" test scenario
2. Enter customer email for identification
3. Complete checkout to save payment method
4. Note the payment method token from response

### **2. Recurring Charges**
1. Open "Charge Payment Method Token" section in debug panel
2. Enter the saved payment method token
3. Set appropriate payment type (SUBSCRIPTION/UNSCHEDULED)
4. Configure customer ID and description
5. Execute charge and verify response

### **3. Error Scenarios**
1. Test invalid tokens
2. Test insufficient funds scenarios
3. Test network failures
4. Verify error handling and user feedback

## 🚀 **Primer API Compliance**

### **API Version**: v2.4+
**Required Headers**:
```
X-Api-Version: 2.4
X-Api-Key: sk_test_...
X-Idempotency-Key: unique_key_per_request
```

### **Required API Scopes**:
- `client_tokens:write` - For client session creation
- `transactions:authorize` - For payment processing

### **Network Transaction ID Optimization**
Primer automatically handles processor-specific requirements:
- **Processor routing optimization** based on payment type
- **Automatic field calculation** for different processors
- **Network Transaction ID linking** for payment series

## 📊 **Benefits**

### **1. Developer Experience**
- **Visual Testing**: Interactive UI for token charging
- **Real-time Feedback**: Immediate response display
- **Error Debugging**: Detailed error messages and logs
- **Scenario Testing**: Pre-configured recurring payment scenarios

### **2. Compliance**
- **Primer Guidelines**: Full adherence to official documentation
- **Processor Optimization**: Proper payment type configuration
- **Industry Standards**: Correct recurring payment setup

### **3. Production Ready**
- **Error Handling**: Comprehensive error scenarios
- **Validation**: Input validation and sanitization
- **Security**: API key protection and secure token handling
- **Monitoring**: Request/response logging for debugging

## 🔮 **Future Enhancements**

### **Planned Features**
- **Subscription Management**: Create, pause, cancel subscriptions
- **Payment Method Management**: Update, delete stored methods
- **Dunning Logic**: Handle failed recurring payments
- **Webhook Processing**: React to payment status changes
- **Analytics Dashboard**: Recurring payment insights

### **Integration Opportunities**
- **CRM Integration**: Customer lifecycle management
- **Billing Systems**: Invoice generation and tracking
- **Notification Services**: Payment confirmation emails
- **Reporting Tools**: Revenue and churn analytics

## 📚 **Resources**

- [Primer Recurring Payments Guide](https://primer.io/docs/get-started/recurring-payments)
- [Primer Payments API Reference](https://primer.io/docs/api-reference/v2.4/api-reference/payments-api)
- [Payment Types Documentation](https://primer.io/docs/get-started/recurring-payments#payment-types)
- [First Payment Reason Guide](https://primer.io/docs/get-started/recurring-payments#additional-parameters)

---

**✅ Implementation Status**: Complete and fully tested
**🎯 Compliance**: Full adherence to Primer's recurring payments guidelines
**🚀 Production Ready**: Suitable for live recurring payment processing
