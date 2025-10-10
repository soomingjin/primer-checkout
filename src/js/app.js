// =================================================================
// PRIMER CHECKOUT MAIN APPLICATION
// =================================================================

class PrimerCheckoutApp {
    constructor() {
        this.currentSession = null;
        this.userId = this.generateUserId();
        this.paymentConfig = {
            amount: 49.99,
            currency: 'GBP',
            customerEmail: ''
        };
        this.debugConfig = {
            customClientToken: null,
            customStyle: null,
            locale: 'en-US',
            useCustomToken: false
        };
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.initializeEventListeners();
            this.checkPrimerSDK();
        });
    }

    initializeElements() {
        this.elements = {
            checkoutButton: document.getElementById('checkout-button'),
            buttonText: document.getElementById('button-text'),
            checkoutIcon: document.getElementById('checkout-icon'),
            loadingSpinner: document.getElementById('loading-spinner'),
            messageContainer: document.getElementById('message-container'),
            productDisplay: document.getElementById('product-display'),
            checkoutButtonContainer: document.getElementById('checkout-button-container'),
            primerContainer: document.getElementById('primer-container'),
            amountInput: document.getElementById('amount-input'),
            currencySelect: document.getElementById('currency-select'),
            customerEmailInput: document.getElementById('customer-email-input'),
            displayPrice: document.getElementById('display-price')
        };
    }

    initializeEventListeners() {
        // Payment controls
        this.elements.amountInput?.addEventListener('input', () => this.updatePriceDisplay());
        this.elements.amountInput?.addEventListener('change', () => this.updatePriceDisplay());
        this.elements.currencySelect?.addEventListener('change', () => this.updatePriceDisplay());
        this.elements.customerEmailInput?.addEventListener('input', () => this.updatePriceDisplay());
        this.elements.customerEmailInput?.addEventListener('change', () => this.updatePriceDisplay());
        
        // Checkout button
        this.elements.checkoutButton?.addEventListener('click', () => this.startCheckout());
        
        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.elements.checkoutButton?.disabled && 
                !this.elements.checkoutButtonContainer?.classList.contains('hidden')) {
                this.startCheckout();
            }
        });

        // Initial update
        this.updatePriceDisplay();
    }

    generateUserId() {
        return `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    formatAmount(amount, currency) {
        if (!amount) return '0.00 ' + (currency || 'GBP');
        const majorAmount = (amount / 100).toFixed(2);
        const symbols = { 'GBP': '£', 'USD': '$', 'EUR': '€', 'JPY': '¥' };
        const symbol = symbols[currency] || currency || 'GBP';
        return `${symbol}${majorAmount}`;
    }

    formatDisplayAmount(amount, currency) {
        if (!amount) return '0.00 ' + (currency || 'GBP');
        const majorAmount = parseFloat(amount).toFixed(2);
        const symbols = { 'GBP': '£', 'USD': '$', 'EUR': '€', 'JPY': '¥' };
        const symbol = symbols[currency] || currency || 'GBP';
        return `${symbol}${majorAmount}`;
    }

    updatePriceDisplay() {
        const { amountInput, currencySelect, displayPrice, customerEmailInput } = this.elements;
        
        if (amountInput && currencySelect && displayPrice) {
            const amount = parseFloat(amountInput.value) || 0;
            const currency = currencySelect.value;
            const customerEmail = customerEmailInput ? customerEmailInput.value.trim() : '';
            
            // Update global config
            this.paymentConfig.amount = amount;
            this.paymentConfig.currency = currency;
            this.paymentConfig.customerEmail = customerEmail;
            
            // Update display
            displayPrice.textContent = this.formatDisplayAmount(amount, currency);
        }
    }

    showMessage(message, type = 'info', autoDismiss = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `status-message status-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        messageDiv.innerHTML = `
            <div class="flex items-start">
                <span class="mr-2 text-lg">${icons[type] || icons.info}</span>
                <div class="flex-1">
                    <p class="font-medium">${message}</p>
                    <small class="opacity-75">${new Date().toLocaleTimeString()}</small>
                </div>
            </div>
        `;
        
        // Clear previous messages of the same type
        const existingMessages = this.elements.messageContainer.querySelectorAll(`.status-${type}`);
        existingMessages.forEach(msg => msg.remove());
        
        this.elements.messageContainer.appendChild(messageDiv);
        
        // Auto-dismiss after 5 seconds for non-error messages
        if (autoDismiss && type !== 'error') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.style.opacity = '0';
                    messageDiv.style.transform = 'translateY(-10px)';
                    setTimeout(() => messageDiv.remove(), 300);
                }
            }, 5000);
        }
    }

    toggleLoading(isLoading, loadingText = 'Processing...') {
        this.elements.checkoutButton.disabled = isLoading;
        this.elements.loadingSpinner.classList.toggle('hidden', !isLoading);
        this.elements.checkoutIcon.classList.toggle('hidden', isLoading);
        this.elements.buttonText.textContent = isLoading ? loadingText : 'Start Secure Checkout';
        
        if (isLoading) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.id = 'loading-overlay';
            overlay.innerHTML = `
                <div class="text-center">
                    <div class="spinner mb-2"></div>
                    <p class="text-gray-600">${loadingText}</p>
                </div>
            `;
            this.elements.primerContainer.appendChild(overlay);
        } else {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.remove();
        }
    }

    async getClientTokenFromBackend() {
        const amountInMinorUnits = Math.round(this.paymentConfig.amount * 100);
        
        // Generate customerId from email or use default
        const customerEmail = this.paymentConfig.customerEmail || 'demo@example.com';
        const customerId = this.paymentConfig.customerEmail ? 
            `customer-${this.paymentConfig.customerEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : 
            `customer-demo-${Date.now()}`;
        
        const requestData = {
            userId: this.userId,
            cartId: `cart-${Date.now()}`,
            amount: amountInMinorUnits,
            currency: this.paymentConfig.currency,
            customerEmail: customerEmail,
            customerId: customerId,
            items: [{
                id: 'hoodie-sku-1',
                name: 'Premium Primer Hoodie',
                amount: amountInMinorUnits,
                quantity: 1
            }]
        };

        const response = await fetch('/create-client-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || `Server error: ${response.status}`);
        }

        return data;
    }

    resetUI() {
        this.toggleLoading(false);
        this.elements.productDisplay.classList.remove('hidden');
        this.elements.checkoutButtonContainer.classList.remove('hidden');
        this.elements.primerContainer.innerHTML = '';
        this.currentSession = null;
    }

    async startCheckout() {
        console.log('🚀 Starting Primer Universal Checkout...');
        
        // Validate Primer SDK is loaded
        const PrimerSDK = window.Primer || Primer;
        if (typeof PrimerSDK === 'undefined') {
            console.error('❌ Primer SDK not loaded');
            this.showMessage("Primer SDK not loaded. Please check your internet connection and try again.", 'error');
            return;
        }

        try {
            // Show loading state
            this.toggleLoading(true, 'Creating secure session...');
            this.elements.primerContainer.innerHTML = '';
            this.showMessage("Connecting to secure payment server...", 'info');

            // Get client token from backend or use custom token
            let sessionData;
            let clientToken;
            
            if (this.debugConfig.useCustomToken && this.debugConfig.customClientToken) {
                clientToken = this.debugConfig.customClientToken;
                sessionData = { clientToken: clientToken };
                this.showMessage("Using custom client token from debug panel", 'info');
            } else {
                sessionData = await this.getClientTokenFromBackend();
                clientToken = sessionData.clientToken;
            }
            
            this.currentSession = sessionData;
            
            console.log('✅ Client session created:', {
                orderId: sessionData.orderId,
                amount: sessionData.amount,
                currency: sessionData.currency
            });
            
            this.showMessage("Secure session created successfully!", 'success');
            
            // Hide product display and prepare checkout UI
            this.elements.productDisplay.classList.add('hidden');
            this.elements.checkoutButtonContainer.classList.add('hidden');
            this.toggleLoading(true, 'Loading payment methods...');

            // Initialize Primer Universal Checkout
            const checkoutOptions = this.buildCheckoutOptions();
            
            console.log('🎯 Initializing Primer Universal Checkout...');
            console.log('Client token:', clientToken ? 'Present' : 'Missing');
            console.log('Debug config:', this.debugConfig);
            
            const universalCheckout = await PrimerSDK.showUniversalCheckout(
                clientToken, 
                checkoutOptions
            );

            console.log('✅ Universal Checkout initialized successfully');

        } catch (error) {
            console.error("❌ Checkout initialization failed:", error);
            this.showMessage(
                `Failed to start checkout: ${error.message}. Please try again or contact support if the problem persists.`, 
                'error'
            );
            this.resetUI();
        }
    }

    buildCheckoutOptions() {
        return {
            container: '#primer-container',
            debug: true,
            locale: this.debugConfig.locale,
            
            // Theme configuration - use custom style if set, otherwise default
            ...(this.debugConfig.customStyle && { style: this.debugConfig.customStyle }),
            
            // Default theme if no custom style
            ...(!this.debugConfig.customStyle && {
                theme: {
                    colorPrimary: '#1f2937',
                    colorSecondary: '#6b7280',
                    borderRadius: '0.75rem',
                    spacingUnit: '16px',
                    fontFamily: 'Inter, sans-serif',
                    colorBackground: '#ffffff'
                }
            }),

            paymentFlow: 'DEFAULT',
            
            options: {
                allowCardholderNameInput: true,
                allowSavePaymentMethod: true,
                validateZipCode: true
            },

            onCheckoutComplete: ({ payment, paymentMethod }) => {
                console.log('✅ Payment completed successfully!', { payment, paymentMethod });
                this.showMessage(`🎉 Payment successful! Transaction ID: ${payment?.id}`, 'success', false);
                this.displaySuccessScreen(payment, paymentMethod);
            },

            onCheckoutFail: (error, { payment }, handler) => {
                console.error('❌ Checkout failed:', error);
                let errorMessage = 'Payment failed. Please try again.';
                
                if (error.errorCode) {
                    const errorMessages = {
                        'CARD_DECLINED': 'Your card was declined. Please try a different payment method.',
                        'INSUFFICIENT_FUNDS': 'Insufficient funds. Please try a different payment method.',
                        'CARD_EXPIRED': 'Your card has expired. Please use a different card.',
                        'INVALID_CARD_NUMBER': 'Invalid card number. Please check your card details.',
                        'PAYMENT_FAILED': 'Payment processing failed. Please try again.',
                        'NETWORK_ERROR': 'Network error. Please check your connection and try again.'
                    };
                    errorMessage = errorMessages[error.errorCode] || `Payment failed: ${error.message}`;
                }
                
                this.showMessage(errorMessage, 'error');
                
                if (handler?.showErrorMessage) {
                    return handler.showErrorMessage(errorMessage);
                }
                
                setTimeout(() => this.resetUI(), 5000);
            },

            onDismiss: () => {
                console.log('🚪 Checkout dismissed by user');
                this.showMessage("Checkout cancelled. You can start over anytime.", 'info');
                this.resetUI();
            },

            onAvailablePaymentMethodsLoad: (availablePaymentMethods) => {
                this.toggleLoading(false);
                console.log('💳 Available payment methods loaded:', 
                    availablePaymentMethods.map(pm => pm.paymentMethodType)
                );
                this.showMessage(
                    `✨ Checkout ready! ${availablePaymentMethods.length} payment methods available.`, 
                    'success'
                );
            },

            onError: (error, data) => {
                console.error('🚨 Primer SDK error:', error);
                this.showMessage(`Checkout error: ${error.message}`, 'error');
                setTimeout(() => this.resetUI(), 3000);
            },

            onPaymentMethodSelect: (paymentMethod) => {
                console.log('💳 Payment method selected:', paymentMethod.paymentMethodType);
            },

            onValidationError: (error) => {
                console.warn('⚠️ Validation error:', error);
                this.showMessage(`Please check your payment details: ${error.message}`, 'warning');
            }
        };
    }

    displaySuccessScreen(payment, paymentMethod) {
        setTimeout(() => {
            this.elements.primerContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">🎉</div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <p class="text-sm text-green-800">
                            <strong>Payment ID:</strong> ${payment?.id || 'N/A'}<br>
                            <strong>Method:</strong> ${paymentMethod?.paymentMethodType || 'N/A'}<br>
                            <strong>Amount:</strong> ${this.formatAmount(payment?.amount || this.currentSession?.amount || 4999, payment?.currencyCode || this.currentSession?.currency || 'GBP')}<br>
                            <strong>Order ID:</strong> ${this.currentSession?.orderId || 'N/A'}
                        </p>
                    </div>
                    <p class="text-gray-600 mb-6">Thank you for your purchase! Order confirmation will be sent to your email.</p>
                    <button id="new-order-btn" class="primary-btn">Start New Order</button>
                </div>
            `;
            
            const newOrderBtn = document.getElementById('new-order-btn');
            if (newOrderBtn) {
                newOrderBtn.addEventListener('click', () => this.resetUI());
            }
        }, 1500);
    }

    checkPrimerSDK() {
        console.log('🚀 Initializing Primer Checkout Demo...');
        
        // Wait for scripts to load
        setTimeout(() => {
            if (typeof Primer !== 'undefined' || typeof window.Primer !== 'undefined') {
                const PrimerSDK = Primer || window.Primer;
                console.log('✅ Primer SDK loaded successfully');
                console.log('SDK Version:', PrimerSDK.SDK_VERSION || 'Unknown');
                this.showMessage("Welcome! Click 'Start Secure Checkout' to begin your purchase.", 'info');
            } else {
                console.error('❌ Primer SDK failed to load');
                this.showMessage("Primer SDK failed to load. Please refresh the page and try again.", 'error');
            }
        }, 1000);
    }
}

// Initialize the application
window.primerApp = new PrimerCheckoutApp();
