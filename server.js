import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;

// Helper for ES Modules to get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primer Sandbox API URL
const PRIMER_API_URL = '[https://api.sandbox.primer.io/client-session](https://api.sandbox.primer.io/client-session)';
const PRIMER_API_KEY = process.env.PRIMER_API_KEY;

// Middleware to serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // To parse JSON bodies

// Secure route to create the Client Session (Backend Logic)
app.post('/create-client-session', async (req, res) => {
    // ⚠️ Security Check: Ensure the API Key is set
    if (!PRIMER_API_KEY || PRIMER_API_KEY === 'sk_test_...') {
        console.error("Primer API Key not set. Check your .env file.");
        return res.status(500).json({ error: "Server misconfigured: Primer API Key is missing." });
    }

    // This order data is typically received from a checkout cart on the frontend
    const orderData = {
        orderId: `ORD-${Date.now()}`,
        currencyCode: 'GBP',
        amount: 4999, // £49.99
        customer: {
            emailAddress: "test_customer@example.com",
            // In a real app, this should be fetched from an authenticated user session
            customerId: `user-${Math.random().toString(36).substring(2)}` 
        },
        order: {
            lineItems: [{
                itemId: "hoodie-sku-1",
                description: "Premium Primer Hoodie",
                amount: 4999,
                quantity: 1
            }]
        }
    };
    
    // --- Secure Primer API Call with Exponential Backoff ---
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(PRIMER_API_URL, {
                method: 'POST',
                headers: {
                    // ⚠️ PRIVATE API KEY IS SECURELY USED ON THE SERVER ⚠️
                    'X-Api-Key': PRIMER_API_KEY, 
                    'Content-Type': 'application/json',
                    'X-Api-Version': '2021-09-08',
                },
                body: JSON.stringify(orderData),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(`Primer API Error: ${response.status}`, data);
                // Throw an error to trigger the retry or final catch block
                throw new Error(data.message || 'Primer API failed to create client session.');
            }

            // Success: Return the clientToken to the frontend
            return res.json({ clientToken: data.clientToken });

        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed to create client session:`, error.message);
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff (1s, 2s)
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // All retries failed
                return res.status(500).json({ error: 'Failed to connect to Primer service after multiple retries.' });
            }
        }
    }
});

// Serve the main HTML file from the 'public' directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Primer Checkout Demo server running securely on http://localhost:${PORT}`);
});
