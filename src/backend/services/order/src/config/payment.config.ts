// Payment Configuration v1.0.0
// Implements PCI-compliant payment gateway integration with comprehensive security measures
// External dependencies:
// - dotenv: ^16.0.0 - Secure environment variable management

import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Constants for payment configuration
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_LOCALE = 'en-US';
export const PAYMENT_TIMEOUT = 30000; // 30 seconds
export const MAX_RETRIES = 3;
export const MIN_WEBHOOK_TOLERANCE = 300; // 300 seconds
export const MAX_CONCURRENT_REQUESTS = 100;
export const SUPPORTED_PAYMENT_METHODS = [
    'card',
    'sepa_debit',
    'ideal',
    'apple_pay',
    'google_pay'
] as const;
export const PCI_COMPLIANCE_LEVELS = [
    'SAQ_A',
    'SAQ_A_EP',
    'SAQ_D'
] as const;

// Interface definitions for type safety
export interface StripeConfig {
    apiKey: string;
    webhookSecret: string;
    apiVersion: string;
    maxRetries: number;
    timeout: number;
    rateLimits: {
        requestsPerSecond: number;
        maxConcurrent: number;
    };
    webhookTolerance: number;
}

export interface SecurityConfig {
    tokenizationEnabled: boolean;
    encryptionKey: string;
    allowedIPs: string[];
    webhookTolerance: number;
    auditLogging: boolean;
    pciMode: string;
    rateLimiting: boolean;
    fraudDetection: {
        enabled: boolean;
        threshold: number;
    };
}

export interface PaymentMethodConfig {
    type: string;
    enabled: boolean;
    currencies: string[];
    minAmount: number;
    maxAmount: number;
    supportedCountries: string[];
    processingFees: {
        percentage: number;
        fixed: number;
    };
    subscriptionSupport: boolean;
    testMode: boolean;
}

// Configuration validation function
export function validateConfig(): void {
    if (!process.env.STRIPE_API_KEY) {
        throw new Error('Missing required STRIPE_API_KEY configuration');
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('Missing required STRIPE_WEBHOOK_SECRET configuration');
    }
    if (!process.env.PAYMENT_ENCRYPTION_KEY) {
        throw new Error('Missing required PAYMENT_ENCRYPTION_KEY configuration');
    }
    
    // Validate API key format
    if (!process.env.STRIPE_API_KEY.startsWith('sk_')) {
        throw new Error('Invalid Stripe API key format');
    }

    // Validate webhook tolerance
    const webhookTolerance = parseInt(process.env.WEBHOOK_TOLERANCE || '300', 10);
    if (webhookTolerance < MIN_WEBHOOK_TOLERANCE) {
        throw new Error(`Webhook tolerance must be at least ${MIN_WEBHOOK_TOLERANCE} seconds`);
    }

    // Validate IP allowlist format
    const allowedIPs = process.env.ALLOWED_IPS?.split(',') || [];
    for (const ip of allowedIPs) {
        if (!ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) && !ip.includes(':')) {
            throw new Error(`Invalid IP address format: ${ip}`);
        }
    }

    // Validate PCI compliance mode
    if (process.env.PCI_MODE && !PCI_COMPLIANCE_LEVELS.includes(process.env.PCI_MODE as any)) {
        throw new Error('Invalid PCI compliance mode specified');
    }
}

// Main payment configuration object
export const paymentConfig = {
    stripe: {
        apiKey: process.env.STRIPE_API_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
        apiVersion: '2023-10-16', // Latest stable Stripe API version
        maxRetries: MAX_RETRIES,
        timeout: PAYMENT_TIMEOUT,
        rateLimits: {
            requestsPerSecond: parseInt(process.env.STRIPE_REQUESTS_PER_SECOND || '100', 10),
            maxConcurrent: MAX_CONCURRENT_REQUESTS
        },
        webhookTolerance: parseInt(process.env.WEBHOOK_TOLERANCE || '300', 10)
    } as StripeConfig,

    security: {
        tokenizationEnabled: true,
        encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY!,
        allowedIPs: process.env.ALLOWED_IPS?.split(',') || [],
        webhookTolerance: parseInt(process.env.WEBHOOK_TOLERANCE || '300', 10),
        auditLogging: process.env.AUDIT_LOGGING !== 'false',
        pciMode: process.env.PCI_MODE || 'SAQ_A_EP',
        rateLimiting: true,
        fraudDetection: {
            enabled: process.env.FRAUD_DETECTION !== 'false',
            threshold: parseFloat(process.env.FRAUD_THRESHOLD || '0.8')
        }
    } as SecurityConfig,

    paymentMethods: [
        {
            type: 'card',
            enabled: true,
            currencies: ['USD', 'EUR', 'GBP'],
            minAmount: 50, // $0.50
            maxAmount: 999999, // $9,999.99
            supportedCountries: ['US', 'CA', 'GB', 'DE', 'FR'],
            processingFees: {
                percentage: 2.9,
                fixed: 30 // $0.30
            },
            subscriptionSupport: true,
            testMode: process.env.NODE_ENV !== 'production'
        },
        {
            type: 'sepa_debit',
            enabled: process.env.SEPA_ENABLED === 'true',
            currencies: ['EUR'],
            minAmount: 100, // €1.00
            maxAmount: 999999, // €9,999.99
            supportedCountries: ['DE', 'FR', 'ES', 'IT', 'NL'],
            processingFees: {
                percentage: 1.4,
                fixed: 20 // €0.20
            },
            subscriptionSupport: true,
            testMode: process.env.NODE_ENV !== 'production'
        },
        {
            type: 'apple_pay',
            enabled: process.env.APPLE_PAY_ENABLED === 'true',
            currencies: ['USD', 'EUR', 'GBP'],
            minAmount: 50,
            maxAmount: 999999,
            supportedCountries: ['US', 'CA', 'GB', 'FR', 'DE'],
            processingFees: {
                percentage: 2.9,
                fixed: 30
            },
            subscriptionSupport: false,
            testMode: process.env.NODE_ENV !== 'production'
        }
    ] as PaymentMethodConfig[]
};

// Validate configuration on initialization
validateConfig();

// Export the validated configuration
export default paymentConfig;