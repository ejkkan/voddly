import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { client } from '../lib/encore-client';

interface PaymentProvider {
  id: string;
  name: string;
  description: string;
  currencies: string[];
  recommended: boolean;
}

interface Props {
  country: string;
  onProviderSelect: (providerId: string) => void;
  selectedProvider?: string;
}

export const PaymentProviderSelector: React.FC<Props> = ({
  country,
  onProviderSelect,
  selectedProvider
}) => {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentProviders();
  }, [country]);

  const loadPaymentProviders = async () => {
    try {
      const response = await client.billing.getPaymentProviders({ country });
      setProviders(response.providers);
    } catch (error) {
      console.error('Failed to load payment providers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Text>Loading payment options...</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Payment Method</Text>
      
      {providers.map((provider) => (
        <TouchableOpacity
          key={provider.id}
          style={[
            styles.providerCard,
            selectedProvider === provider.id && styles.selectedCard,
            provider.recommended && styles.recommendedCard
          ]}
          onPress={() => onProviderSelect(provider.id)}
        >
          <View style={styles.providerHeader}>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{provider.name}</Text>
              {provider.recommended && (
                <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
              )}
            </View>
            <View style={styles.providerIcon}>
              {provider.id === 'stripe' && <Text style={styles.iconText}>💳</Text>}
              {provider.id === 'mercado_pago' && <Text style={styles.iconText}>🇧🇷</Text>}
            </View>
          </View>
          
          <Text style={styles.providerDescription}>{provider.description}</Text>
          
          <View style={styles.currencyContainer}>
            <Text style={styles.currencyLabel}>Currencies:</Text>
            <Text style={styles.currencyList}>
              {provider.currencies.join(', ')}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      
      <Text style={styles.securityNote}>
        🔒 All payments are secure and encrypted
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  providerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  selectedCard: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  recommendedCard: {
    borderColor: '#28a745',
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recommendedBadge: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: 'bold',
  },
  providerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  providerDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  currencyList: {
    fontSize: 12,
    color: '#666',
  },
  securityNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 16,
  },
});