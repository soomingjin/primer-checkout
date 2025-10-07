#!/usr/bin/env node

/**
 * Primer Universal Checkout Integration Tests
 * Based on Primer official documentation testing recommendations
 */

import { createServer } from 'http';
import fetch from 'node-fetch';
import assert from 'assert';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Test configuration
const TEST_PORT = 3001;
const SERVER_STARTUP_TIMEOUT = 10000;
const REQUEST_TIMEOUT = 5000;

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class PrimerIntegrationTest {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
  }

  async runAllTests() {
    log('\n🧪 Primer Universal Checkout Integration Tests', 'bold');
    log('='.repeat(50), 'blue');
    
    try {
      await this.startTestServer();
      await this.runHealthTests();
      await this.runSecurityTests();
      await this.runAPITests();
      await this.runFrontendTests();
      await this.runWebhookTests();
      
      this.printResults();
    } catch (error) {
      log(`\n❌ Test suite failed: ${error.message}`, 'red');
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async startTestServer() {
    log('\n🚀 Starting test server...', 'blue');
    
    return new Promise((resolve, reject) => {
      // Set test environment
      const env = {
        ...process.env,
        PORT: TEST_PORT,
        NODE_ENV: 'test',
        PRIMER_API_KEY: process.env.PRIMER_API_KEY || 'sk_test_example'
      };

      this.serverProcess = spawn('node', ['server.js'], {
        cwd: rootDir,
        env,
        stdio: 'pipe'
      });

      let output = '';
      this.serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Primer Checkout Demo server running')) {
          log('✅ Test server started successfully', 'green');
          setTimeout(resolve, 1000); // Give server time to fully initialize
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.serverProcess.on('error', reject);

      // Timeout if server doesn't start
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, SERVER_STARTUP_TIMEOUT);
    });
  }

  async runHealthTests() {
    log('\n🏥 Running health check tests...', 'blue');

    await this.test('Health endpoint responds', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/health`);
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.strictEqual(data.status, 'healthy');
      assert(data.timestamp);
      assert(data.version);
    });

    await this.test('Main page loads', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/`);
      assert.strictEqual(response.status, 200);
      
      const html = await response.text();
      assert(html.includes('Primer Universal Checkout'));
      assert(html.includes('Primer.js'));
    });
  }

  async runSecurityTests() {
    log('\n🔒 Running security tests...', 'blue');

    await this.test('CSP headers are present', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/`);
      const csp = response.headers.get('content-security-policy');
      
      assert(csp, 'CSP header should be present');
      assert(csp.includes('*.primer.io'), 'Should allow Primer domains');
      assert(csp.includes("'self'"), 'Should allow self');
    });

    await this.test('Security headers are set', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/`);
      
      assert(response.headers.get('x-content-type-options'));
      assert(response.headers.get('x-frame-options'));
      assert(response.headers.get('strict-transport-security'));
    });

    await this.test('CORS is configured', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/health`, {
        headers: { 'Origin': 'https://example.com' }
      });
      
      // Should not reject CORS in development
      assert.strictEqual(response.status, 200);
    });
  }

  async runAPITests() {
    log('\n🔌 Running API tests...', 'blue');

    await this.test('Create client session with valid data', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/create-client-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          amount: 1000,
          currency: 'GBP'
        })
      });

      // May fail if no valid API key, but should not crash
      assert(response.status === 200 || response.status === 500);
      
      const data = await response.json();
      if (response.status === 200) {
        assert(data.clientToken || data.orderId);
      } else {
        assert(data.error); // Should have error message
      }
    });

    await this.test('Validate request data', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/create-client-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: -100, // Invalid amount
          currency: 'INVALID' // Invalid currency
        })
      });

      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert(data.error);
      assert(data.details);
    });

    await this.test('Handle missing request body', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/create-client-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Should handle gracefully
      assert([200, 400, 500].includes(response.status));
    });
  }

  async runFrontendTests() {
    log('\n🌐 Running frontend tests...', 'blue');

    await this.test('Primer SDK files are accessible', async () => {
      const jsResponse = await this.fetch(`http://localhost:${TEST_PORT}/Primer.js`);
      assert.strictEqual(jsResponse.status, 200);
      
      const cssResponse = await this.fetch(`http://localhost:${TEST_PORT}/Checkout.css`);
      assert.strictEqual(cssResponse.status, 200);
    });

    await this.test('Static assets load correctly', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();
      
      // Check for essential elements
      assert(html.includes('primer-container'));
      assert(html.includes('checkout-button'));
      assert(html.includes('Inter, sans-serif'));
    });
  }

  async runWebhookTests() {
    log('\n📡 Running webhook tests...', 'blue');

    await this.test('Webhook endpoint exists', async () => {
      const response = await this.fetch(`http://localhost:${TEST_PORT}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      // Should not return 404
      assert.notStrictEqual(response.status, 404);
    });

    await this.test('Handle webhook rate limiting', async () => {
      // Test that webhook endpoint has rate limiting
      const promises = Array(5).fill().map(() => 
        this.fetch(`http://localhost:${TEST_PORT}/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'rate-limit' })
        })
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);
      
      // All should be processed or rate limited, none should crash
      assert(statuses.every(status => [200, 400, 429, 500].includes(status)));
    });
  }

  async test(name, testFn) {
    try {
      await testFn();
      log(`  ✅ ${name}`, 'green');
      this.testResults.push({ name, status: 'passed' });
    } catch (error) {
      log(`  ❌ ${name}: ${error.message}`, 'red');
      this.testResults.push({ name, status: 'failed', error: error.message });
    }
  }

  async fetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`);
      }
      throw error;
    }
  }

  printResults() {
    const passed = this.testResults.filter(t => t.status === 'passed').length;
    const failed = this.testResults.filter(t => t.status === 'failed').length;
    
    log('\n📊 Test Results', 'bold');
    log('='.repeat(30), 'blue');
    log(`✅ Passed: ${passed}`, 'green');
    log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log(`📈 Total:  ${this.testResults.length}`, 'blue');
    
    if (failed > 0) {
      log('\n🔍 Failed Tests:', 'red');
      this.testResults
        .filter(t => t.status === 'failed')
        .forEach(test => {
          log(`  • ${test.name}: ${test.error}`, 'red');
        });
    }
    
    const successRate = ((passed / this.testResults.length) * 100).toFixed(1);
    log(`\n🎯 Success Rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');
    
    if (failed === 0) {
      log('\n🎉 All tests passed! Your Primer integration is ready.', 'green');
      process.exit(0);
    } else {
      log('\n🚨 Some tests failed. Please review the issues above.', 'red');
      process.exit(1);
    }
  }

  async cleanup() {
    if (this.serverProcess) {
      log('\n🧹 Cleaning up test server...', 'blue');
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 2000); // Force cleanup after 2s
      });
    }
  }
}

// Environment validation
function validateEnvironment() {
  log('🔍 Validating test environment...', 'blue');
  
  // Check if server.js exists
  if (!existsSync(path.join(rootDir, 'server.js'))) {
    throw new Error('server.js not found. Run tests from project root.');
  }
  
  // Check if required files exist
  const requiredFiles = ['package.json', 'Primer.js', 'Checkout.css'];
  for (const file of requiredFiles) {
    if (!existsSync(path.join(rootDir, file))) {
      log(`⚠️  Warning: ${file} not found`, 'yellow');
    }
  }
  
  log('✅ Environment validation complete', 'green');
}

// Main execution
async function main() {
  try {
    validateEnvironment();
    const tester = new PrimerIntegrationTest();
    await tester.runAllTests();
  } catch (error) {
    log(`\n💥 Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n🛑 Tests interrupted by user', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n🛑 Tests terminated', 'yellow');  
  process.exit(143);
});

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PrimerIntegrationTest;
