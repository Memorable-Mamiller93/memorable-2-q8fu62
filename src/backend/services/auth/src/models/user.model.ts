// External imports with versions
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsIn,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'; // @version ^0.14.0
import { Exclude, Transform } from 'class-transformer'; // @version ^0.5.1

// Internal imports
import { pool } from '../config/database.config';
import { hashPassword, comparePasswords } from '../utils/password.utils';

/**
 * Interface defining comprehensive user properties with security and compliance features
 */
export interface IUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'business';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
  isVerified: boolean;
  verificationToken: string | null;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  previousPasswords: string[];
  mfaEnabled: boolean;
  mfaSecret: string | null;
  consentStatus: 'granted' | 'denied' | 'pending';
  consentDate: Date | null;
  loginAttempts: number;
  lockoutUntil: Date | null;
  lastIpAddress: string | null;
  preferences: Record<string, any>;
  activityLog: Array<{
    action: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }>;
  dataRetentionConsent: boolean;
}

/**
 * Enhanced User model class with security, compliance, and audit features
 */
export class User implements IUser {
  @Transform(({ value }) => value || uuidv4())
  id: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @MinLength(12)
  @Exclude({ toPlainObject: true })
  password: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsIn(['user', 'admin', 'business'])
  role: 'user' | 'admin' | 'business';

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsOptional()
  @IsDate()
  lastLoginAt: Date | null;

  @IsBoolean()
  isActive: boolean;

  @IsBoolean()
  isVerified: boolean;

  @Exclude({ toPlainObject: true })
  verificationToken: string | null;

  @Exclude({ toPlainObject: true })
  resetPasswordToken: string | null;

  @IsOptional()
  @IsDate()
  resetPasswordExpires: Date | null;

  @Exclude({ toPlainObject: true })
  previousPasswords: string[];

  @IsBoolean()
  mfaEnabled: boolean;

  @Exclude({ toPlainObject: true })
  mfaSecret: string | null;

  @IsIn(['granted', 'denied', 'pending'])
  consentStatus: 'granted' | 'denied' | 'pending';

  @IsOptional()
  @IsDate()
  consentDate: Date | null;

  @IsNumber()
  loginAttempts: number;

  @IsOptional()
  @IsDate()
  lockoutUntil: Date | null;

  @IsOptional()
  @IsString()
  lastIpAddress: string | null;

  @ValidateNested()
  preferences: Record<string, any>;

  @ValidateNested()
  activityLog: Array<{
    action: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }>;

  @IsBoolean()
  dataRetentionConsent: boolean;

  /**
   * Creates a new User instance with enhanced security features
   * @param userData Partial user data for initialization
   */
  constructor(userData: Partial<IUser>) {
    this.id = userData.id || uuidv4();
    this.email = userData.email || '';
    this.password = userData.password || '';
    this.firstName = userData.firstName || '';
    this.lastName = userData.lastName || '';
    this.role = userData.role || 'user';
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = userData.updatedAt || new Date();
    this.lastLoginAt = userData.lastLoginAt || null;
    this.isActive = userData.isActive ?? true;
    this.isVerified = userData.isVerified ?? false;
    this.verificationToken = userData.verificationToken || null;
    this.resetPasswordToken = userData.resetPasswordToken || null;
    this.resetPasswordExpires = userData.resetPasswordExpires || null;
    this.previousPasswords = userData.previousPasswords || [];
    this.mfaEnabled = userData.mfaEnabled ?? false;
    this.mfaSecret = userData.mfaSecret || null;
    this.consentStatus = userData.consentStatus || 'pending';
    this.consentDate = userData.consentDate || null;
    this.loginAttempts = userData.loginAttempts || 0;
    this.lockoutUntil = userData.lockoutUntil || null;
    this.lastIpAddress = userData.lastIpAddress || null;
    this.preferences = userData.preferences || {};
    this.activityLog = userData.activityLog || [];
    this.dataRetentionConsent = userData.dataRetentionConsent ?? false;
  }

  /**
   * Creates a new user with enhanced security and logging
   * @param userData User data for creation
   * @returns Promise<User> Created user instance
   */
  static async create(userData: Partial<IUser>): Promise<User> {
    const user = new User(userData);
    
    // Hash password before storage
    user.password = await hashPassword(user.password);

    const query = `
      INSERT INTO users (
        id, email, password, first_name, last_name, role, created_at, updated_at,
        is_active, is_verified, verification_token, mfa_enabled, consent_status,
        login_attempts, preferences, activity_log, data_retention_consent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      user.id, user.email, user.password, user.firstName, user.lastName,
      user.role, user.createdAt, user.updatedAt, user.isActive, user.isVerified,
      user.verificationToken, user.mfaEnabled, user.consentStatus,
      user.loginAttempts, JSON.stringify(user.preferences),
      JSON.stringify(user.activityLog), user.dataRetentionConsent
    ];

    try {
      const result = await pool.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error('Failed to create user');
    }
  }

  /**
   * Updates user with encryption and audit logging
   * @param userData Updated user data
   * @returns Promise<User> Updated user instance
   */
  async update(userData: Partial<IUser>): Promise<User> {
    this.updatedAt = new Date();

    // Handle password updates securely
    if (userData.password) {
      this.previousPasswords.push(this.password);
      this.password = await hashPassword(userData.password);
      // Keep only the last 5 passwords
      this.previousPasswords = this.previousPasswords.slice(-5);
    }

    const query = `
      UPDATE users SET
        email = $1, password = $2, first_name = $3, last_name = $4,
        updated_at = $5, is_active = $6, is_verified = $7,
        mfa_enabled = $8, consent_status = $9, preferences = $10,
        activity_log = $11, data_retention_consent = $12
      WHERE id = $13
      RETURNING *
    `;

    const values = [
      this.email, this.password, this.firstName, this.lastName,
      this.updatedAt, this.isActive, this.isVerified, this.mfaEnabled,
      this.consentStatus, JSON.stringify(this.preferences),
      JSON.stringify(this.activityLog), this.dataRetentionConsent, this.id
    ];

    try {
      const result = await pool.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error('Failed to update user');
    }
  }
}