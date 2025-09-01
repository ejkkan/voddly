// Payment provider abstraction layer
export interface PaymentProvider {
  name: string;
  createSubscription(params: SubscriptionParams): Promise<SubscriptionResult>;
  updateSubscription(subscriptionId: string, params: UpdateParams): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  handleWebhook(payload: any, signature: string): Promise<WebhookResult>;
}

export interface SubscriptionParams {
  customerId: string;
  planType: 'monthly' | 'annual' | 'early_bird';
  extraDevices: number;
  customerEmail: string;
  customerCountry: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: 'active' | 'pending' | 'failed';
  paymentUrl?: string;
  deviceLimit: number;
}

// Stripe Provider Implementation
export class StripeProvider implements PaymentProvider {
  name = 'stripe';

  async createSubscription(params: SubscriptionParams): Promise<SubscriptionResult> {
    const priceId = this.getPriceId(params.planType);
    const items = [{ price: priceId, quantity: 1 }];

    if (params.extraDevices > 0) {
      const devicePriceId = this.getDevicePriceId(params.planType);
      items.push({ price: devicePriceId, quantity: params.extraDevices });
    }

    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items,
      metadata: {
        plan_type: params.planType,
        extra_devices: params.extraDevices.toString()
      }
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status === 'active' ? 'active' : 'pending',
      deviceLimit: this.calculateDeviceLimit(params.planType, params.extraDevices)
    };
  }

  private getPriceId(planType: string): string {
    const priceIds = {
      monthly: 'price_monthly_3devices',
      annual: 'price_annual_5devices', 
      early_bird: 'price_earlybird_5devices'
    };
    return priceIds[planType];
  }

  private calculateDeviceLimit(planType: string, extraDevices: number): number {
    const baseLimits = { monthly: 3, annual: 5, early_bird: 5 };
    return baseLimits[planType] + extraDevices;
  }

  // ... other methods
}

// Mercado Pago Provider Implementation  
export class MercadoPagoProvider implements PaymentProvider {
  name = 'mercado_pago';

  async createSubscription(params: SubscriptionParams): Promise<SubscriptionResult> {
    // Mercado Pago subscription creation
    const planId = this.getPlanId(params.planType);
    
    const subscription = await mercadoPago.preapproval.create({
      reason: `Voddly ${params.planType} subscription`,
      external_reference: params.customerId,
      payer_email: params.customerEmail,
      card_token_id: params.cardToken, // From frontend
      auto_recurring: {
        frequency: params.planType === 'monthly' ? 1 : 12,
        frequency_type: 'months',
        transaction_amount: this.calculateAmount(params),
        currency_id: this.getCurrency(params.customerCountry)
      }
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status === 'authorized' ? 'active' : 'pending',
      paymentUrl: subscription.init_point,
      deviceLimit: this.calculateDeviceLimit(params.planType, params.extraDevices)
    };
  }

  private calculateAmount(params: SubscriptionParams): number {
    const basePrices = { 
      monthly: 3, 
      annual: 25, 
      early_bird: 15 
    };
    const devicePrices = {
      monthly: 1,
      annual: 10, 
      early_bird: 1
    };
    
    return basePrices[params.planType] + (params.extraDevices * devicePrices[params.planType]);
  }

  private getCurrency(country: string): string {
    const currencies = {
      'BR': 'BRL',
      'AR': 'ARS', 
      'MX': 'MXN',
      'CL': 'CLP',
      'CO': 'COP'
    };
    return currencies[country] || 'USD';
  }

  // ... other methods
}

// Payment Provider Factory
export class PaymentProviderFactory {
  static getProvider(country: string, userPreference?: string): PaymentProvider {
    const southAmericanCountries = ['BR', 'AR', 'MX', 'CL', 'CO', 'PE', 'UY'];
    
    if (userPreference === 'mercado_pago' && southAmericanCountries.includes(country)) {
      return new MercadoPagoProvider();
    }
    
    if (userPreference === 'stripe') {
      return new StripeProvider();
    }

    // Default based on region
    if (southAmericanCountries.includes(country)) {
      return new MercadoPagoProvider(); // Default for South America
    }
    
    return new StripeProvider(); // Default for rest of world
  }

  static getAvailableProviders(country: string): string[] {
    const southAmericanCountries = ['BR', 'AR', 'MX', 'CL', 'CO', 'PE', 'UY'];
    
    if (southAmericanCountries.includes(country)) {
      return ['mercado_pago', 'stripe'];
    }
    
    return ['stripe'];
  }
}