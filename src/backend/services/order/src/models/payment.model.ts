import { Model, DataTypes, Sequelize, Association } from 'sequelize'; // v6.32.0
import { sequelize } from '../config/database.config';
import * as crypto from 'crypto';

/**
 * Interface defining payment record attributes with enhanced security fields
 * Implements PCI DSS compliance requirements for payment data handling
 */
export interface PaymentAttributes {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'AUTHORIZING' | 'AUTHORIZED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'DISPUTED';
  paymentMethod: string;
  encryptedPaymentData: string;
  paymentIntentId: string;
  paymentMethodId: string;
  transactionId: string;
  errorMessage: string | null;
  refundReason: string | null;
  lastValidatedAt: Date;
  securityChecksum: string;
  metadata: Record<string, any>;
  auditLog: Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Enhanced Sequelize model class for payment records with PCI compliance
 * Implements security best practices and audit logging
 */
export class Payment extends Model<PaymentAttributes> implements PaymentAttributes {
  public id!: string;
  public orderId!: string;
  public amount!: number;
  public currency!: string;
  public status!: 'PENDING' | 'AUTHORIZING' | 'AUTHORIZED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'DISPUTED';
  public paymentMethod!: string;
  public encryptedPaymentData!: string;
  public paymentIntentId!: string;
  public paymentMethodId!: string;
  public transactionId!: string;
  public errorMessage!: string | null;
  public refundReason!: string | null;
  public lastValidatedAt!: Date;
  public securityChecksum!: string;
  public metadata!: Record<string, any>;
  public auditLog!: Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
  }>;
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt!: Date;

  /**
   * Static method to initialize the Payment model with enhanced security features
   * @param sequelizeInstance - Sequelize instance for model initialization
   */
  public static initializeModel(sequelizeInstance: Sequelize): typeof Payment {
    Payment.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        orderId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'orders',
            key: 'id',
          },
        },
        amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0.01,
          },
        },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          validate: {
            isIn: [['USD', 'EUR', 'GBP']], // Supported currencies
          },
        },
        status: {
          type: DataTypes.ENUM(
            'PENDING',
            'AUTHORIZING',
            'AUTHORIZED',
            'PROCESSING',
            'COMPLETED',
            'FAILED',
            'REFUNDED',
            'DISPUTED'
          ),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        paymentMethod: {
          type: DataTypes.STRING(50),
          allowNull: false,
          validate: {
            isIn: [['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER']],
          },
        },
        encryptedPaymentData: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        paymentIntentId: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        paymentMethodId: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        transactionId: {
          type: DataTypes.STRING(100),
          allowNull: true,
          unique: true,
        },
        errorMessage: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        refundReason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        lastValidatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        securityChecksum: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        auditLog: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize: sequelizeInstance,
        tableName: 'payments',
        paranoid: true, // Soft deletes
        indexes: [
          {
            unique: true,
            fields: ['transactionId'],
          },
          {
            fields: ['orderId'],
          },
          {
            fields: ['status'],
          },
          {
            fields: ['createdAt'],
          },
        ],
        hooks: {
          beforeSave: async (payment: Payment) => {
            // Generate security checksum for data integrity
            const checksumData = `${payment.id}:${payment.orderId}:${payment.amount}:${payment.currency}:${payment.status}`;
            payment.securityChecksum = crypto
              .createHash('sha256')
              .update(checksumData)
              .digest('hex');

            // Add audit log entry
            const auditEntry = {
              timestamp: new Date(),
              action: payment.isNewRecord ? 'CREATE' : 'UPDATE',
              actor: 'SYSTEM',
              details: {
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
              },
            };
            payment.auditLog = [...(payment.auditLog || []), auditEntry];

            // Update lastValidatedAt
            payment.lastValidatedAt = new Date();
          },
          beforeDestroy: async (payment: Payment) => {
            // Add audit log entry for deletion
            const auditEntry = {
              timestamp: new Date(),
              action: 'DELETE',
              actor: 'SYSTEM',
              details: {
                reason: 'Soft delete initiated',
              },
            };
            payment.auditLog = [...(payment.auditLog || []), auditEntry];
            await payment.save();
          },
        },
      }
    );

    return Payment;
  }

  /**
   * Static method to define model associations with security considerations
   * @param models - Record of all models for association setup
   */
  public static associate(models: Record<string, any>): void {
    Payment.belongsTo(models.Order, {
      foreignKey: {
        name: 'orderId',
        allowNull: false,
      },
      onDelete: 'RESTRICT', // Prevent deletion of orders with payments
    });
  }
}

// Initialize the model with the sequelize instance
Payment.initializeModel(sequelize);

export default Payment;