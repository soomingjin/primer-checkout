// =================================================================
// DEBUG PANEL MODULE
// =================================================================

class DebugPanel {
    constructor(app) {
        this.app = app;
        this.isVisible = false;
        this.themePresets = this.getThemePresets();
        this.testScenarios = this.getTestScenarios();
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.initializeEventListeners();
        });
    }

    initializeElements() {
        this.elements = {
            debugToggle: document.getElementById('debug-toggle'),
            debugContent: document.getElementById('debug-content'),
            debugToggleText: document.getElementById('debug-toggle-text'),
            debugToggleIcon: document.getElementById('debug-toggle-icon'),
            clientTokenInput: document.getElementById('client-token-input'),
            useCustomTokenBtn: document.getElementById('use-custom-token'),
            clearCustomTokenBtn: document.getElementById('clear-custom-token'),
            tokenStatus: document.getElementById('token-status'),
            styleEditor: document.getElementById('style-editor'),
            themePreset: document.getElementById('theme-preset'),
            localeSelect: document.getElementById('locale-select'),
            applyStyleBtn: document.getElementById('apply-style'),
            resetStyleBtn: document.getElementById('reset-style'),
            copyStyleBtn: document.getElementById('copy-style'),
            scenarioBtns: document.querySelectorAll('.scenario-btn'),
            amountBtns: document.querySelectorAll('.amount-btn')
        };
    }

    initializeEventListeners() {
        // Debug panel toggle
        this.elements.debugToggle?.addEventListener('click', () => this.togglePanel());
        
        // Token management
        this.elements.useCustomTokenBtn?.addEventListener('click', () => this.useCustomClientToken());
        this.elements.clearCustomTokenBtn?.addEventListener('click', () => this.clearCustomClientToken());
        
        // Style management
        this.elements.applyStyleBtn?.addEventListener('click', () => this.applyCustomStyle());
        this.elements.resetStyleBtn?.addEventListener('click', () => this.resetStyle());
        this.elements.copyStyleBtn?.addEventListener('click', () => this.copyStyleToClipboard());
        this.elements.themePreset?.addEventListener('change', () => this.applyThemePreset());
        this.elements.localeSelect?.addEventListener('change', () => this.updateLocale());
        
        // Test scenarios
        this.elements.scenarioBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                const scenario = btn.getAttribute('data-scenario');
                this.applyTestScenario(scenario);
            });
        });
        
        // Quick amounts
        this.elements.amountBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseFloat(btn.getAttribute('data-amount'));
                this.setAmount(amount);
            });
        });
    }

    togglePanel() {
        this.isVisible = !this.isVisible;
        
        this.elements.debugContent.classList.toggle('hidden', !this.isVisible);
        this.elements.debugToggleText.textContent = this.isVisible ? 
            '🛠️ Hide Developer Debug Panel' : 
            '🛠️ Show Developer Debug Panel';
        
        const icon = this.elements.debugToggleIcon;
        if (this.isVisible) {
            icon.style.transform = 'rotate(180deg)';
        } else {
            icon.style.transform = 'rotate(0deg)';
        }
    }

    useCustomClientToken() {
        const token = this.elements.clientTokenInput.value.trim();
        if (!token) {
            this.app.showMessage("Please enter a client token first", 'warning');
            return;
        }

        try {
            // Basic validation - check if it looks like a JWT
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }

            this.app.debugConfig.customClientToken = token;
            this.app.debugConfig.useCustomToken = true;
            
            this.elements.tokenStatus.innerHTML = `
                <div class="text-green-600">✅ Using custom token</div>
                <div class="text-xs mt-1 truncate">${token.substring(0, 30)}...</div>
            `;
            
            this.app.showMessage("Custom client token activated! Next checkout will use your token.", 'success');
            
        } catch (error) {
            this.app.showMessage("Invalid token format. Please check your client token.", 'error');
        }
    }

    clearCustomClientToken() {
        this.app.debugConfig.customClientToken = null;
        this.app.debugConfig.useCustomToken = false;
        this.elements.clientTokenInput.value = '';
        
        this.elements.tokenStatus.innerHTML = `
            <div class="text-gray-600">Auto-generated from session</div>
        `;
        
        this.app.showMessage("Cleared custom token. Will auto-generate on next checkout.", 'info');
    }

    applyTestScenario(scenario) {
        const scenarios = this.testScenarios[scenario];
        if (!scenarios) return;

        // Apply scenario settings
        if (scenarios.amount) {
            this.setAmount(scenarios.amount);
        }
        
        if (scenarios.customerEmail) {
            const emailInput = this.app.elements.customerEmailInput;
            if (emailInput) {
                emailInput.value = scenarios.customerEmail;
                this.app.updatePriceDisplay();
            }
        }

        this.app.showMessage(`Applied ${scenarios.name} test scenario`, 'info');
    }

    setAmount(amount) {
        const amountInput = this.app.elements.amountInput;
        if (amountInput) {
            amountInput.value = amount.toFixed(2);
            this.app.updatePriceDisplay();
        }
    }

    applyThemePreset() {
        const preset = this.elements.themePreset.value;
        const theme = this.themePresets[preset];
        
        if (theme) {
            this.elements.styleEditor.value = JSON.stringify(theme, null, 2);
            
            if (preset !== 'custom') {
                this.app.showMessage(`Applied ${preset} theme preset`, 'success');
            }
        }
    }

    updateLocale() {
        this.app.debugConfig.locale = this.elements.localeSelect.value;
        this.app.showMessage(`Locale updated to ${this.app.debugConfig.locale}`, 'info');
    }

    applyCustomStyle() {
        try {
            const styleText = this.elements.styleEditor.value.trim();
            
            if (styleText) {
                const customStyle = JSON.parse(styleText);
                this.app.debugConfig.customStyle = customStyle;
                this.app.showMessage("Custom style applied! Restart checkout to see changes.", 'success');
            } else {
                this.app.debugConfig.customStyle = null;
                this.app.showMessage("Cleared custom style. Using default theme.", 'info');
            }
        } catch (error) {
            this.app.showMessage("Invalid JSON format. Please check your style configuration.", 'error');
            console.error('Style JSON parse error:', error);
        }
    }

    resetStyle() {
        this.app.debugConfig.customStyle = null;
        this.elements.styleEditor.value = '';
        this.elements.themePreset.value = 'default';
        
        this.app.showMessage("Reset to default style. Restart checkout to see changes.", 'info');
    }

    async copyStyleToClipboard() {
        const styleText = this.elements.styleEditor.value.trim();
        
        if (!styleText) {
            this.app.showMessage("No style to copy. Create a custom style first.", 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(styleText);
            this.app.showMessage("Style JSON copied to clipboard!", 'success');
        } catch (error) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = styleText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            this.app.showMessage("Style JSON copied to clipboard!", 'success');
        }
    }

    getThemePresets() {
        return {
            default: {
                theme: {
                    colorPrimary: '#1f2937',
                    colorSecondary: '#6b7280',
                    borderRadius: '0.75rem',
                    spacingUnit: '16px',
                    fontFamily: 'Inter, sans-serif',
                    colorBackground: '#ffffff'
                }
            },
            dark: {
                theme: {
                    colorPrimary: '#3b82f6',
                    colorSecondary: '#94a3b8',
                    colorBackground: '#1f2937',
                    colorText: '#f8fafc',
                    colorError: '#ef4444',
                    colorSuccess: '#10b981',
                    borderRadius: '0.5rem',
                    spacingUnit: '12px',
                    fontFamily: '"SF Pro Display", -apple-system, sans-serif'
                }
            },
            minimal: {
                theme: {
                    colorPrimary: '#000000',
                    colorSecondary: '#666666',
                    borderRadius: '0rem',
                    spacingUnit: '8px',
                    fontFamily: '"Helvetica Neue", Arial, sans-serif',
                    colorBackground: '#ffffff',
                    borderWidth: '1px',
                    borderColor: '#e5e5e5'
                }
            },
            colorful: {
                theme: {
                    colorPrimary: '#8b5cf6',
                    colorSecondary: '#06b6d4',
                    colorBackground: '#fef3c7',
                    colorSuccess: '#10b981',
                    colorError: '#f59e0b',
                    borderRadius: '1rem',
                    spacingUnit: '20px',
                    fontFamily: '"Comic Sans MS", cursive'
                }
            }
        };
    }

    getTestScenarios() {
        return {
            success: {
                name: 'Success Case',
                amount: 1.00,
                customerEmail: 'success@test.com'
            },
            declined: {
                name: 'Card Declined',
                amount: 2.00,
                customerEmail: 'declined@test.com'
            },
            vault: {
                name: 'Vault Customer',
                amount: 49.99,
                customerEmail: 'vault@customer.com'
            },
            guest: {
                name: 'Guest Checkout',
                amount: 9.99,
                customerEmail: ''
            },
            subscription: {
                name: 'Subscription',
                amount: 19.99,
                customerEmail: 'subscription@test.com'
            },
            '3ds': {
                name: '3DS Required',
                amount: 100.00,
                customerEmail: '3ds@test.com'
            }
        };
    }
}

// Export for use in main app
window.DebugPanel = DebugPanel;
