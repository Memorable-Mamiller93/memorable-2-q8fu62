import { Model, DataTypes, Sequelize, Association } from 'sequelize'; // v6.32.0
import { sequelize, transaction } from '../config/database.config';
import { Payment } from './payment.model';
import * as crypto from 'crypto';

/**
 * Comprehensive interface defining order attributes with validation rules
 */
export interface OrderAttributes {
  id: string;
  userId: string;
  bookId: string;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'PRINTING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  amount: number;
  currency: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone: string;
  };
  shippingMethod: 'STANDARD' | 'EXPRESS' | 'PRIORITY';
  trackingNumber: string | null;
  printerId: string | null;
  metadata: Record<string, any>;
  securityChecksum: string;
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
 * Enhanced Sequelize model class for managing book orders with comprehensive
 * validation and security features
 */
export class Order extends Model<OrderAttributes> implements OrderAttributes {
  public id!: string;
  public userId!: string;
  public bookId!: string;
  public status!: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'PRINTING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  public amount!: number;
  public currency!: string;
  public shippingAddress!: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone: string;
  };
  public shippingMethod!: 'STANDARD' | 'EXPRESS' | 'PRIORITY';
  public trackingNumber!: string | null;
  public printerId!: string | null;
  public metadata!: Record<string, any>;
  public securityChecksum!: string;
  public auditLog!: Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, any>;
  }>;
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt!: Date;

  // Define associations
  public readonly payment?: Payment;
  public static associations: {
    payment: Association<Order, Payment>;
  };

  /**
   * Static method to initialize the Order model with enhanced validation and hooks
   * @param sequelizeInstance - Sequelize instance for model initialization
   */
  public static initializeModel(sequelizeInstance: Sequelize): typeof Order {
    Order.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        bookId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'books',
            key: 'id',
          },
        },
        status: {
          type: DataTypes.ENUM(
            'PENDING',
            'PROCESSING',
            'CONFIRMED',
            'PRINTING',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED'
          ),
          allowNull: false,
          defaultValue: 'PENDING',
          validate: {
            isValidTransition(value: string) {
              const validTransitions: Record<string, string[]> = {
                PENDING: ['PROCESSING', 'CANCELLED'],
                PROCESSING: ['CONFIRMED', 'CANCELLED'],
                CONFIRMED: ['PRINTING', 'CANCELLED'],
                PRINTING: ['SHIPPED', 'CANCELLED'],
                SHIPPED: ['DELIVERED', 'CANCELLED'],
                DELIVERED: [],
                CANCELLED: [],
              };
              
              if (this.changed('status') && this.previous('status')) {
                const previousStatus = this.previous('status');
                if (!validTransitions[previousStatus].includes(value)) {
                  throw new Error(`Invalid status transition from ${previousStatus} to ${value}`);
                }
              }
            },
          },
        },
        amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0.01,
            max: 10000.00, // Maximum order amount
          },
        },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          validate: {
            isIn: [['USD', 'EUR', 'GBP']], // Supported currencies
          },
        },
        shippingAddress: {
          type: DataTypes.JSONB,
          allowNull: false,
          validate: {
            isValidAddress(value: any) {
              const required = ['street', 'city', 'state', 'country', 'postalCode', 'phone'];
              for (const field of required) {
                if (!value[field]) {
                  throw new Error(`Missing required shipping address field: ${field}`);
                }
              }
              // Validate phone format
              if (!/^\+?[\d\s-]{10,}$/.test(value.phone)) {
                throw new Error('Invalid phone number format');
              }
              // Validate postal code format
              if (!/^[\w\s-]{3,10}$/.test(value.postalCode)) {
                throw new Error('Invalid postal code format');
              }
            },
          },
        },
        shippingMethod: {
          type: DataTypes.ENUM('STANDARD', 'EXPRESS', 'PRIORITY'),
          allowNull: false,
          defaultValue: 'STANDARD',
        },
        trackingNumber: {
          type: DataTypes.STRING(100),
          allowNull: true,
          validate: {
            isValidTrackingNumber(value: string | null) {
              if (value && !/^[A-Z0-9]{8,}$/.test(value)) {
                throw new Error('Invalid tracking number format');
              }
            },
          },
        },
        printerId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'printers',
            key: 'id',
          },
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        securityChecksum: {
          type: DataTypes.STRING(64),
          allowNull: false,
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
        tableName: 'orders',
        paranoid: true, // Enable soft deletes
        indexes: [
          {
            fields: ['userId'],
          },
          {
            fields: ['bookId'],
          },
          {
            fields: ['status'],
          },
          {
            fields: ['printerId'],
          },
          {
            fields: ['createdAt'],
          },
        ],
        hooks: {
          beforeValidate: async (order: Order) => {
            // Generate security checksum for data integrity
            const checksumData = `${order.id}:${order.userId}:${order.bookId}:${order.amount}:${order.status}`;
            order.securityChecksum = crypto
              .createHash('sha256')
              .update(checksumData)
              .digest('hex');
          },
          beforeSave: async (order: Order) => {
            // Add audit log entry
            const auditEntry = {
              timestamp: new Date(),
              action: order.isNewRecord ? 'CREATE' : 'UPDATE',
              actor: 'SYSTEM',
              details: {
                status: order.status,
                amount: order.amount,
                changes: order.changed(),
              },
            };
            order.auditLog = [...(order.auditLog || []), auditEntry];
          },
          afterCreate: async (order: Order) => {
            // Emit event for order creation
            sequelize.emit('orderCreated', order);
          },
          afterUpdate: async (order: Order) => {
            // Emit event for status changes
            if (order.changed('status')) {
              sequelize.emit('orderStatusChanged', {
                orderId: order.id,
                previousStatus: order.previous('status'),
                newStatus: order.status,
              });
            }
          },
        },
      }
    );

    return Order;
  }

  /**
   * Static method to define model associations with enhanced constraints
   * @param models - Record of all models for association setup
   */
  public static associate(models: Record<string, any>): void {
    Order.hasOne(models.Payment, {
      foreignKey: {
        name: 'orderId',
        allowNull: false,
      },
      as: 'payment',
      onDelete: 'RESTRICT', // Prevent deletion of orders with payments
    });
  }

  /**
   * Updates order status with validation and transaction management
   * @param newStatus - New status to set
   * @param metadata - Optional metadata to update
   */
  public async updateStatus(
    newStatus: OrderAttributes['status'],
    metadata?: Record<string, any>
  ): Promise<void> {
    const t = await transaction();
    try {
      const previousStatus = this.status;
      this.status = newStatus;
      if (metadata) {
        this.metadata = { ...this.metadata, ...metadata };
      }
      await this.save({ transaction: t });
      await t.commit();

      // Emit status change event
      sequelize.emit('orderStatusChanged', {
        orderId: this.id,
        previousStatus,
        newStatus,
        metadata: this.metadata,
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

// Initialize the model with the sequelize instance
Order.initializeModel(sequelize);

export default Order;