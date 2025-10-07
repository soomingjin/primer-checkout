# Primer Universal Checkout Integration (Node.js/Express)

This repository demonstrates the secure, two-part integration flow for **Primer's Universal Checkout** using a Node.js/Express backend and a vanilla HTML/JavaScript frontend.

## 🚀 Getting Started (Using Yarn)

1.  **Clone the Repository** (assuming you are setting up locally).
2.  **Install Dependencies**:
    ```bash
    yarn install
    ```
3.  **Set Your API Key**: Create a file named `.env` in the root directory and add your Primer Sandbox Private API Key:
    ```
    # .env
    PRIMER_API_KEY="sk_test_..." 
    ```
    *Replace `sk_test_...` with your actual key from the Primer Dashboard.*
4.  **Start the Server**:
    ```bash
    yarn start
    ```
    The server will start on `http://localhost:3000`.
5.  **Access the Frontend**: Open `http://localhost:3000` in your web browser.

## ⚙️ Project Architecture

| File | Type | Purpose | Security |
| :--- | :--- | :--- | :--- |
| `package.json` | Config | Defines Node dependencies (`express`) and scripts. | Public |
| **`server.js`** | **Backend** | **Securely** handles the Primer API call (`POST /client-session`) using the private API key and returns the client token. | **Private API Key is protected here.** |
| `public/index.html` | Frontend | Displays the product and fetches the `clientToken` from the local Node server (`/create-client-session` route) before initializing the Primer SDK. | Public |

## Integration Flow

1.  **User Action**: The customer clicks the "Start Checkout" button on the `public/index.html` page.
2.  **Frontend Request**: The browser sends a `fetch` request to the local Node backend route (`/create-client-session`).
3.  **Secure Backend Call**: `server.js` uses the environment variable `PRIMER_API_KEY` to securely call the Primer API and generate the **`clientToken`**.
4.  **Token Delivery**: The Node server sends the `clientToken` back to the browser.
5.  **Universal Checkout Display**: The Primer Web SDK is initialized with the token, and the payment UI is rendered.
6.  **Payment Fulfillment**: After `onCheckoutComplete` fires on the client, your server must wait for a secure **Webhook** from Primer to confirm payment success and fulfill the order.
