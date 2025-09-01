import { api } from 'encore.dev/api';
import { PaymentProviderFactory, SubscriptionParams } from './payment-providers';
import log from 'encore.dev/log';

// Get available payment providers for user's country
export const getPaymentProviders = api(
  { method: 'GET', path: '/billing/providers', auth: true },
  async (req: { country: string }): Promise<{
    providers: Array<{
      id: string;
      name: string;
      description: string;
      currencies: string[];
      recommended: boolean;
    }>;
  }> => {
    const availableProviders = PaymentProviderFactory.getAvailableProviders(req.country);
    
    const providers = availableProviders.map(providerId => {
      switch (providerId) {
        case 'stripe':
          return {
            id: 'stripe',
            name: 'Stripe',
            description: 'Credit/Debit Cards, Apple Pay, Google Pay',
            currencies: ['USD', 'EUR', 'GBP', 'BRL', 'MXN'],
            recommended: !['BR', 'AR', 'MX'].includes(req.country)
          };
        case 'mercado_pago':
          return {
            id: 'mercado_pago', 
            name: 'Mercado Pago',
            description: 'PIX, Boleto, Credit Cards, Bank Transfer',
            currencies: ['BRL', 'ARS', 'MXN', 'CLP', 'COP'],
            recommended: ['BR', 'AR', 'MX'].includes(req.country)
          };
        default:
          throw new Error(`Unknown provider: ${providerId}`);
      }
    });

    return { providers };
  }
);

// Create subscription with chosen payment provider
export const createSubscription = api(
  { method: 'POST', path: '/billing/subscribe', auth: true },
  async (req: {
    planType: 'monthly' | 'annual' | 'early_bird';
    extraDevices: number;
    paymentProvider: string;
    country: string;
    customerEmail: string;
  }): Promise<{
    subscriptionId: string;
    status: string;
    paymentUrl?: string;
    deviceLimit: number;
  }> => {
    const { auth } = req;
    
    if (!auth?.accountId) {
      throw new Error('Authentication required');
    }

    log.info('Creating subscription', {
      userId: auth.accountId,
      planType: req.planType,
      extraDevices: req.extraDevices,
      paymentProvider: req.paymentProvider,
      country: req.country
    });

    // Get the appropriate payment provider
    const provider = PaymentProviderFactory.getProvider(req.country, req.paymentProvider);
    
    // Create subscription
    const result = await provider.createSubscription({
      customerId: auth.accountId,
      planType: req.planType,
      extraDevices: req.extraDevices,
      customerEmail: req.customerEmail,
      customerCountry: req.country
    });

    // Store subscription info in your database
    await storeSubscription(auth.accountId, {
      subscriptionId: result.subscriptionId,
      provider: req.paymentProvider,
      planType: req.planType,
      deviceLimit: result.deviceLimit,
      status: result.status
    });

    return result;
  }
);

// Unified webhook handler for all providers
export const paymentWebhook = api.raw(
  { method: 'POST', path: '/billing/webhook/:provider' },
  async (req, resp, meta) => {
    const provider = meta.pathParams.provider;
    const signature = req.headers['x-signature'] || req.headers['stripe-signature'];
    
    try {
      let paymentProvider;
      
      switch (provider) {
        case 'stripe':
          paymentProvider = new StripeProvider();
          break;
        case 'mercado_pago':
          paymentProvider = new MercadoPagoProvider();
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      const result = await paymentProvider.handleWebhook(req.body, signature);
      
      if (result.success) {
        await updateUserSubscription(result.userId, result.subscriptionData);
      }

      resp.status(200).send('OK');
    } catch (error) {
      log.error('Webhook processing failed', { error, provider });
      resp.status(400).send('Webhook processing failed');
    }
  }
);

// Helper functions
async function storeSubscription(userId: string, subscriptionData: any) {
  // Store in your database
  // Implementation depends on your user service
}

async function updateUserSubscription(userId: string, subscriptionData: any) {
  // Update user's subscription status and device limits
  // Implementation depends on your user service
}