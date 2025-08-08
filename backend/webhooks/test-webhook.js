/**
 * Test script for verifying Stripe webhook handling
 * 
 * Usage: node test-webhook.js
 * 
 * This script simulates what the Stripe CLI does when forwarding webhooks
 */

const crypto = require('crypto');

// Test configuration
const WEBHOOK_SECRET = 'whsec_test_secret'; // Replace with your actual test secret
const ENDPOINT_URL = 'http://localhost:4000/webhooks/stripe';

// Sample webhook payload
const testEvent = {
  id: 'evt_test_webhook',
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'sub_test_123',
      object: 'subscription',
      customer: 'cus_test_123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      items: {
        data: [{
          price: {
            id: 'price_PLACEHOLDER_BASIC'
          }
        }]
      }
    }
  },
  type: 'customer.subscription.created',
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: null,
    idempotency_key: null
  }
};

// Generate Stripe signature
function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

// Send test webhook
async function testWebhook() {
  const payload = JSON.stringify(testEvent);
  const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

  console.log('Sending test webhook to:', ENDPOINT_URL);
  console.log('Event type:', testEvent.type);
  console.log('Customer ID:', testEvent.data.object.customer);

  try {
    const response = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature
      },
      body: payload
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (response.status === 200) {
      console.log('✅ Webhook handled successfully!');
    } else {
      console.log('❌ Webhook failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Failed to send webhook:', error.message);
    console.log('\nMake sure:');
    console.log('1. The Encore backend is running (npm run dev)');
    console.log('2. The webhook secret matches your configuration');
  }
}

// Run the test
testWebhook();