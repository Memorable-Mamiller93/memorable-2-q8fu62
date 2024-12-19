// @package jest ^29.0.0 - Testing framework
import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
// @package supertest ^6.3.0 - HTTP assertions
import request from 'supertest';
// @package @faker-js/faker ^8.0.0 - Test data generation
import { faker } from '@faker-js/faker';

import { OrderService } from '../src/services/order.service';
import { PrintService } from '../../print/src/services/print.service';
import { PaymentService } from '../src/services/payment.service';
import { Order } from '../src/models/order.model';
import { Payment } from '../src/models/payment.model';
import { sequelize } from '../src/config/database.config';

// Mock external services
jest.mock('../src/services/payment.service');
jest.mock('../../print/src/services/print.service');

// Test timeout configuration
jest.setTimeout(30000);

describe('OrderService Integration Tests', () => {
  let orderService: OrderService;
  let paymentService: PaymentService;
  let printService: PrintService;
  let mockMetrics: any;
  let mockCache: any;

  beforeAll(async () => {
    // Initialize test database connection
    await sequelize.authenticate();
    await sequelize.sync({ force: true });

    // Initialize mock services
    mockMetrics = {
      recordOrderProcessing: jest.fn(),
      incrementOrderCount: jest.fn()
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    paymentService = new PaymentService(jest.fn() as any, jest.fn() as any);
    printService = new PrintService();
    orderService = new OrderService(paymentService, printService, mockMetrics, mockCache);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await Order.destroy({ where: {}, force: true });
    await Payment.destroy({ where: {}, force: true });
    
    // Reset mock counters
    jest.clearAllMocks();
  });

  describe('Order Creation', () => {
    it('should create a new order with valid input', async () => {
      const orderRequest = {
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey: faker.string.uuid(),
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      };

      const response = await orderService.createOrder(orderRequest);

      expect(response).toBeDefined();
      expect(response.orderId).toBeDefined();
      expect(response.status).toBe('PROCESSING');
      expect(response.amount).toBe(orderRequest.amount);
      expect(response.performanceMetrics).toBeDefined();
      expect(response.performanceMetrics.processingTime).toBeLessThan(3000); // 3s SLA
    });

    it('should handle idempotent order creation', async () => {
      const idempotencyKey = faker.string.uuid();
      const orderRequest = {
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey,
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      };

      const firstResponse = await orderService.createOrder(orderRequest);
      const secondResponse = await orderService.createOrder(orderRequest);

      expect(firstResponse.orderId).toBe(secondResponse.orderId);
      expect(paymentService.processPayment).toHaveBeenCalledTimes(1);
    });
  });

  describe('Payment Processing', () => {
    it('should process payment successfully', async () => {
      const orderRequest = {
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey: faker.string.uuid(),
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      };

      const response = await orderService.createOrder(orderRequest);
      expect(response.paymentStatus).toBe('CAPTURED');
      expect(paymentService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: orderRequest.amount,
          currency: orderRequest.currency,
          paymentMethodId: orderRequest.paymentMethodId
        })
      );
    });

    it('should handle payment failures gracefully', async () => {
      jest.spyOn(paymentService, 'processPayment').mockRejectedValueOnce(new Error('Payment failed'));

      const orderRequest = {
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey: faker.string.uuid(),
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      };

      await expect(orderService.createOrder(orderRequest)).rejects.toThrow('Payment failed');
    });
  });

  describe('Print Coordination', () => {
    it('should create print job after successful payment', async () => {
      const orderRequest = {
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey: faker.string.uuid(),
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      };

      const response = await orderService.createOrder(orderRequest);
      expect(printService.createPrintJob).toHaveBeenCalledWith(
        response.orderId,
        orderRequest.bookId,
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should handle printer assignment failures', async () => {
      jest.spyOn(printService, 'assignPrinter').mockRejectedValueOnce(new Error('No printers available'));

      const orderRequest = {
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey: faker.string.uuid(),
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      };

      const response = await orderService.createOrder(orderRequest);
      expect(response.printStatus).toBe('QUEUED');
    });
  });

  describe('Performance Requirements', () => {
    it('should handle concurrent order creation', async () => {
      const orderRequests = Array(10).fill(null).map(() => ({
        userId: faker.string.uuid(),
        bookId: faker.string.uuid(),
        amount: faker.number.int({ min: 1000, max: 10000 }),
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD',
        paymentMethodId: faker.string.alphanumeric(20),
        shippingAddress: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          postalCode: faker.location.zipCode(),
          phone: faker.phone.number()
        },
        shippingMethod: 'STANDARD',
        metadata: {},
        idempotencyKey: faker.string.uuid(),
        securityContext: {
          userId: faker.string.uuid(),
          sessionId: faker.string.uuid(),
          ipAddress: faker.internet.ip(),
          userAgent: faker.internet.userAgent()
        }
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        orderRequests.map(request => orderService.createOrder(request))
      );
      const endTime = Date.now();

      expect(responses).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(30000); // 30s for 10 concurrent orders
      responses.forEach(response => {
        expect(response.performanceMetrics.processingTime).toBeLessThan(3000);
      });
    });

    it('should maintain performance under load', async () => {
      const iterations = 5;
      const processingTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const orderRequest = {
          userId: faker.string.uuid(),
          bookId: faker.string.uuid(),
          amount: faker.number.int({ min: 1000, max: 10000 }),
          currency: 'USD',
          paymentMethod: 'CREDIT_CARD',
          paymentMethodId: faker.string.alphanumeric(20),
          shippingAddress: {
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state(),
            country: faker.location.country(),
            postalCode: faker.location.zipCode(),
            phone: faker.phone.number()
          },
          shippingMethod: 'STANDARD',
          metadata: {},
          idempotencyKey: faker.string.uuid(),
          securityContext: {
            userId: faker.string.uuid(),
            sessionId: faker.string.uuid(),
            ipAddress: faker.internet.ip(),
            userAgent: faker.internet.userAgent()
          }
        };

        const startTime = Date.now();
        await orderService.createOrder(orderRequest);
        processingTimes.push(Date.now() - startTime);
      }

      const averageProcessingTime = processingTimes.reduce((a, b) => a + b) / iterations;
      expect(averageProcessingTime).toBeLessThan(3000); // 3s SLA
    });
  });
});