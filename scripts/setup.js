#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printBanner() {
  console.log('\n' + colorize('cyan', '╔══════════════════════════════════════════════════════════════╗'));
  console.log(colorize('cyan', '║') + colorize('bright', '           🚀 Primer Checkout Demo Setup Wizard           ') + colorize('cyan', '║'));
  console.log(colorize('cyan', '╚══════════════════════════════════════════════════════════════╝') + '\n');
}

function printStep(step, total, message) {
  console.log(colorize('blue', `[${step}/${total}]`) + ' ' + colorize('bright', message));
}

function printSuccess(message) {
  console.log(colorize('green', '✅ ' + message));
}

function printWarning(message) {
  console.log(colorize('yellow', '⚠️  ' + message));
}

function printError(message) {
  console.log(colorize('red', '❌ ' + message));
}

function createEnvExample() {
  const envExample = `# Primer Universal Checkout Demo - Environment Configuration
# Copy this file to .env and fill in your actual values

# === REQUIRED CONFIGURATION ===

# Your Primer API Key (get this from https://dashboard.primer.io)
# For testing, use a sandbox key that starts with 'sk_test_'
# For production, use a live key that starts with 'sk_live_'
PRIMER_API_KEY=sk_test_your_primer_api_key_here

# === OPTIONAL CONFIGURATION ===

# Custom Primer API URL (defaults to sandbox)
# Sandbox: https://api.sandbox.primer.io/client-session
# Production: https://api.primer.io/client-session
PRIMER_API_URL=https://api.sandbox.primer.io/client-session

# Webhook secret for verifying Primer webhook signatures
# Get this from your Primer dashboard webhook configuration
PRIMER_WEBHOOK_SECRET=your_webhook_secret_here

# Server configuration
PORT=3000
NODE_ENV=development

# CORS configuration for production (comma-separated URLs)
# Example: https://yourdomain.com,https://www.yourdomain.com
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# === DEVELOPMENT CONFIGURATION ===

# Set to 'true' to enable detailed logging
DEBUG=false

# Set to 'true' to enable webhook signature verification in development
VERIFY_WEBHOOKS=false`;

  const envExamplePath = path.join(rootDir, '.env.example');
  try {
    writeFileSync(envExamplePath, envExample);
    return true;
  } catch (error) {
    console.error('Failed to create .env.example:', error.message);
    return false;
  }
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupEnvironment() {
  printBanner();
  
  console.log(colorize('bright', 'This wizard will help you set up your Primer checkout demo.\n'));
  
  // Step 1: Check if .env already exists
  printStep(1, 5, 'Checking existing configuration...');
  
  const envPath = path.join(rootDir, '.env');
  const envExists = existsSync(envPath);
  
  if (envExists) {
    printWarning('.env file already exists');
    const overwrite = await askQuestion(colorize('yellow', 'Do you want to overwrite it? (y/N): '));
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log(colorize('blue', '\nSetup cancelled. Your existing .env file is unchanged.'));
      rl.close();
      return;
    }
  }
  
  // Step 2: Create .env.example
  printStep(2, 5, 'Creating .env.example template...');
  if (createEnvExample()) {
    printSuccess('.env.example created successfully');
  } else {
    printError('Failed to create .env.example');
  }
  
  // Step 3: Get Primer API Key
  printStep(3, 5, 'Configuring Primer API Key...');
  console.log('\nTo get your Primer API key:');
  console.log('1. Visit ' + colorize('cyan', 'https://dashboard.primer.io'));
  console.log('2. Sign up or log in to your account');
  console.log('3. Navigate to Settings > API Keys');
  console.log('4. Copy your sandbox API key (starts with sk_test_)\n');
  
  const apiKey = await askQuestion(colorize('bright', 'Enter your Primer API key: '));
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'sk_test_your_primer_api_key_here') {
    printWarning('No valid API key provided. You can add it later to your .env file.');
  }
  
  // Step 4: Optional configurations
  printStep(4, 5, 'Optional configurations...');
  
  const port = await askQuestion(colorize('bright', 'Server port (default: 3000): ')) || '3000';
  const webhookSecret = await askQuestion(colorize('bright', 'Webhook secret (optional, press Enter to skip): '));
  
  // Step 5: Create .env file
  printStep(5, 5, 'Creating .env file...');
  
  const envContent = `# Primer Universal Checkout Demo Configuration
# Generated by setup wizard on ${new Date().toISOString()}

PRIMER_API_KEY=${apiKey || 'sk_test_your_primer_api_key_here'}
PRIMER_API_URL=https://api.sandbox.primer.io/client-session
PORT=${port}
NODE_ENV=development

${webhookSecret ? `PRIMER_WEBHOOK_SECRET=${webhookSecret}` : '# PRIMER_WEBHOOK_SECRET=your_webhook_secret_here'}

# CORS configuration for production
ALLOWED_ORIGINS=http://localhost:${port},http://127.0.0.1:${port}

# Development settings
DEBUG=false
VERIFY_WEBHOOKS=false`;

  try {
    writeFileSync(envPath, envContent);
    printSuccess('.env file created successfully!');
  } catch (error) {
    printError('Failed to create .env file: ' + error.message);
    rl.close();
    return;
  }
  
  // Final instructions
  console.log('\n' + colorize('green', '🎉 Setup completed successfully!') + '\n');
  console.log(colorize('bright', 'Next steps:'));
  console.log('1. Install dependencies: ' + colorize('cyan', 'yarn install') + ' or ' + colorize('cyan', 'npm install'));
  console.log('2. Start the server: ' + colorize('cyan', 'yarn start') + ' or ' + colorize('cyan', 'npm start'));
  console.log('3. Open your browser to: ' + colorize('cyan', `http://localhost:${port}`));
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'sk_test_your_primer_api_key_here') {
    console.log('\n' + colorize('yellow', '⚠️  Remember to add your actual Primer API key to the .env file!'));
  }
  
  console.log('\n' + colorize('blue', 'For help, check the README.md file or visit https://primer.io/docs'));
  
  rl.close();
}

// Handle errors gracefully
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled by user.');
  rl.close();
  process.exit(0);
});

// Run the setup
setupEnvironment().catch((error) => {
  printError('Setup failed: ' + error.message);
  process.exit(1);
});
