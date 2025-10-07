#!/usr/bin/env node

import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m'
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function checkHealth() {
  console.log(colorize('blue', '\n🔍 Primer Checkout Demo - Health Check\n'));
  
  const port = process.env.PORT || 3000;
  const baseUrl = `http://localhost:${port}`;
  
  // Check if .env exists
  console.log('📁 Configuration Files:');
  if (existsSync('.env')) {
    console.log(colorize('green', '  ✅ .env file exists'));
  } else {
    console.log(colorize('red', '  ❌ .env file missing'));
    console.log(colorize('yellow', '     Run: yarn setup or npm run setup'));
  }
  
  if (existsSync('.env.example')) {
    console.log(colorize('green', '  ✅ .env.example file exists'));
  } else {
    console.log(colorize('yellow', '  ⚠️  .env.example file missing'));
  }
  
  // Check environment variables
  console.log('\n🔧 Environment Variables:');
  const apiKey = process.env.PRIMER_API_KEY;
  if (apiKey && apiKey !== 'sk_test_your_primer_api_key_here') {
    console.log(colorize('green', '  ✅ PRIMER_API_KEY configured'));
    console.log(colorize('blue', `     Key type: ${apiKey.startsWith('sk_test_') ? 'Sandbox' : 'Production'}`));
  } else {
    console.log(colorize('red', '  ❌ PRIMER_API_KEY not configured'));
  }
  
  console.log(colorize('blue', `  📍 PORT: ${port}`));
  console.log(colorize('blue', `  🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`));
  
  // Check server health
  console.log('\n🚀 Server Health:');
  try {
    const response = await fetch(`${baseUrl}/health`, { timeout: 5000 });
    if (response.ok) {
      const data = await response.json();
      console.log(colorize('green', '  ✅ Server is running'));
      console.log(colorize('blue', `     Status: ${data.status}`));
      console.log(colorize('blue', `     Version: ${data.version}`));
      console.log(colorize('blue', `     Environment: ${data.environment}`));
    } else {
      console.log(colorize('red', `  ❌ Server responded with status: ${response.status}`));
    }
  } catch (error) {
    console.log(colorize('red', '  ❌ Server is not running or not accessible'));
    console.log(colorize('yellow', '     Start server with: yarn start or npm start'));
  }
  
  // Check Primer API connectivity
  console.log('\n🔗 Primer API Connectivity:');
  if (apiKey && apiKey !== 'sk_test_your_primer_api_key_here') {
    try {
      const testData = {
        orderId: `health-check-${Date.now()}`,
        currencyCode: 'GBP',
        amount: 1,
        customer: {
          emailAddress: 'test@example.com',
          customerId: 'health-check-user'
        },
        order: {
          lineItems: [{
            itemId: 'test-item',
            description: 'Health Check Item',
            amount: 1,
            quantity: 1
          }]
        }
      };
      
      const primerResponse = await fetch(process.env.PRIMER_API_URL || 'https://api.sandbox.primer.io/client-session', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
          'X-Api-Version': '2021-09-08'
        },
        body: JSON.stringify(testData),
        timeout: 10000
      });
      
      if (primerResponse.ok) {
        console.log(colorize('green', '  ✅ Primer API connection successful'));
      } else {
        const errorData = await primerResponse.json();
        console.log(colorize('red', `  ❌ Primer API error: ${primerResponse.status}`));
        console.log(colorize('yellow', `     Message: ${errorData.message || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', '  ❌ Cannot connect to Primer API'));
      console.log(colorize('yellow', `     Error: ${error.message}`));
    }
  } else {
    console.log(colorize('yellow', '  ⚠️  Skipping API test - API key not configured'));
  }
  
  // Check package.json
  console.log('\n📦 Dependencies:');
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = Object.keys(packageJson.dependencies || {});
    console.log(colorize('green', `  ✅ ${deps.length} dependencies listed`));
    console.log(colorize('blue', `     Main dependencies: ${deps.slice(0, 3).join(', ')}${deps.length > 3 ? '...' : ''}`));
  } catch (error) {
    console.log(colorize('red', '  ❌ Cannot read package.json'));
  }
  
  console.log('\n' + colorize('bright', '🎯 Quick Links:'));
  console.log(`   Demo: ${colorize('cyan', baseUrl)}`);
  console.log(`   Health: ${colorize('cyan', baseUrl + '/health')}`);
  console.log(`   Primer Dashboard: ${colorize('cyan', 'https://dashboard.primer.io')}`);
  console.log(`   Documentation: ${colorize('cyan', 'https://primer.io/docs')}\n`);
}

checkHealth().catch((error) => {
  console.error(colorize('red', '\n❌ Health check failed:'), error.message);
  process.exit(1);
});
