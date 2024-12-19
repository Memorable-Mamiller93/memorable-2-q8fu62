/**
 * @fileoverview Advanced storage utilities for the Memorable platform
 * Provides enhanced browser storage management with compression, encryption,
 * quota management, and cross-tab synchronization
 * @version 1.0.0
 */

// External dependencies
import axios from 'axios'; // v1.4.0
import * as LZString from 'lz-string'; // v1.5.0
import * as CryptoJS from 'crypto-js'; // v4.1.1

// Internal dependencies
import { Book } from '../types/book.types';
import { validateFile, generateUniqueFilename } from './file.utils';

// Constants
const STORAGE_PREFIX = 'memorable_';
const DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STORAGE_SIZE = 10 * 1024 * 1024; // 10MB
const COMPRESSION_THRESHOLD = 1024; // 1KB
const UPLOAD_RETRY_ATTEMPTS = 3;
const UPLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || 'default-key';

/**
 * Interface for items stored in browser storage
 */
export interface StorageItem<T = any> {
  key: string;
  value: T;
  expiry: number | null;
  compressed: boolean;
  encrypted: boolean;
  version: number;
  timestamp: number;
}

/**
 * Enhanced options for storage operations
 */
export interface StorageOptions {
  expiry?: number | null;
  persistent?: boolean;
  compress?: boolean;
  encrypt?: boolean;
  syncTabs?: boolean;
}

/**
 * Interface for tracking file upload progress
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Enhanced storage service with advanced features
 */
export class StorageService {
  private static instance: StorageService;
  private encryptionKey: string;
  private quotaWarningThreshold: number;

  private constructor() {
    this.encryptionKey = ENCRYPTION_KEY;
    this.quotaWarningThreshold = MAX_STORAGE_SIZE * 0.9;
    this.initStorageEventListener();
    this.cleanExpiredItems();
  }

  /**
   * Get singleton instance of StorageService
   */
  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Store item with optional compression and encryption
   */
  public async setItem<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    const {
      expiry = DEFAULT_EXPIRY,
      persistent = false,
      compress = true,
      encrypt = false,
      syncTabs = true
    } = options;

    try {
      await this.checkQuota();
      
      let processedValue = JSON.stringify(value);
      let isCompressed = false;
      let isEncrypted = false;

      // Compress large data
      if (compress && processedValue.length > COMPRESSION_THRESHOLD) {
        processedValue = LZString.compress(processedValue);
        isCompressed = true;
      }

      // Encrypt sensitive data
      if (encrypt) {
        processedValue = CryptoJS.AES.encrypt(
          processedValue,
          this.encryptionKey
        ).toString();
        isEncrypted = true;
      }

      const storageItem: StorageItem<string> = {
        key: `${STORAGE_PREFIX}${key}`,
        value: processedValue,
        expiry: expiry ? Date.now() + expiry : null,
        compressed: isCompressed,
        encrypted: isEncrypted,
        version: 1,
        timestamp: Date.now()
      };

      const storage = persistent ? localStorage : sessionStorage;
      storage.setItem(storageItem.key, JSON.stringify(storageItem));

      if (syncTabs && persistent) {
        this.broadcastStorageUpdate(storageItem);
      }
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        await this.handleQuotaExceeded();
        throw new Error('Storage quota exceeded. Please free up space.');
      }
      throw error;
    }
  }

  /**
   * Retrieve and process stored item
   */
  public async getItem<T>(key: string): Promise<T | null> {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const item = localStorage.getItem(prefixedKey) || sessionStorage.getItem(prefixedKey);

    if (!item) return null;

    try {
      const storageItem: StorageItem = JSON.parse(item);

      // Check expiration
      if (storageItem.expiry && storageItem.expiry < Date.now()) {
        this.removeItem(key);
        return null;
      }

      let value = storageItem.value;

      // Decrypt if encrypted
      if (storageItem.encrypted) {
        const bytes = CryptoJS.AES.decrypt(value, this.encryptionKey);
        value = bytes.toString(CryptoJS.enc.Utf8);
      }

      // Decompress if compressed
      if (storageItem.compressed) {
        value = LZString.decompress(value);
      }

      return JSON.parse(value);
    } catch (error) {
      console.error(`Error retrieving item ${key}:`, error);
      return null;
    }
  }

  /**
   * Upload file with progress tracking and retry logic
   */
  public async uploadFile(
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    const validationResult = await validateFile(file, {
      maxSize: MAX_STORAGE_SIZE,
      allowedTypes: ['image/jpeg', 'image/png', 'image/heic'],
      allowCompression: true,
      minWidth: 800,
      minHeight: 600
    });

    if (!validationResult.isValid) {
      throw new Error(validationResult.error || 'Invalid file');
    }

    const filename = generateUniqueFilename(file.name);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', filename);

    let attempt = 0;
    while (attempt < UPLOAD_RETRY_ATTEMPTS) {
      try {
        const response = await axios.post('/api/v1/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress) {
              onProgress({
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
              });
            }
          }
        });

        // Validate uploaded file accessibility
        await this.validateUploadedFile(response.data.url);
        return response.data.url;
      } catch (error) {
        attempt++;
        if (attempt === UPLOAD_RETRY_ATTEMPTS) {
          throw new Error(`File upload failed after ${UPLOAD_RETRY_ATTEMPTS} attempts`);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Upload failed');
  }

  /**
   * Remove item from storage
   */
  public removeItem(key: string): void {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
    sessionStorage.removeItem(prefixedKey);
  }

  /**
   * Clear all storage for the application
   */
  public clearStorage(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
    
    Object.keys(sessionStorage)
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .forEach(key => sessionStorage.removeItem(key));
  }

  /**
   * Initialize storage event listener for cross-tab synchronization
   */
  private initStorageEventListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith(STORAGE_PREFIX)) {
        this.handleStorageEvent(event);
      }
    });
  }

  /**
   * Handle storage events for cross-tab synchronization
   */
  private handleStorageEvent(event: StorageEvent): void {
    if (!event.newValue) return;

    try {
      const storageItem: StorageItem = JSON.parse(event.newValue);
      window.dispatchEvent(
        new CustomEvent('storageSync', {
          detail: {
            key: storageItem.key.replace(STORAGE_PREFIX, ''),
            value: storageItem.value,
            timestamp: storageItem.timestamp
          }
        })
      );
    } catch (error) {
      console.error('Error handling storage event:', error);
    }
  }

  /**
   * Broadcast storage updates to other tabs
   */
  private broadcastStorageUpdate(item: StorageItem): void {
    window.dispatchEvent(
      new CustomEvent('storageSync', {
        detail: {
          key: item.key.replace(STORAGE_PREFIX, ''),
          value: item.value,
          timestamp: item.timestamp
        }
      })
    );
  }

  /**
   * Check storage quota and cleanup if needed
   */
  private async checkQuota(): Promise<void> {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage && quota && usage > this.quotaWarningThreshold) {
        await this.cleanExpiredItems();
      }
    }
  }

  /**
   * Handle quota exceeded error
   */
  private async handleQuotaExceeded(): Promise<void> {
    await this.cleanExpiredItems();
    await this.removeOldestItems();
  }

  /**
   * Clean expired items from storage
   */
  private async cleanExpiredItems(): Promise<void> {
    const now = Date.now();
    const storages = [localStorage, sessionStorage];

    storages.forEach(storage => {
      Object.keys(storage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => {
          try {
            const item: StorageItem = JSON.parse(storage.getItem(key) || '');
            if (item.expiry && item.expiry < now) {
              storage.removeItem(key);
            }
          } catch (error) {
            console.error(`Error cleaning expired item ${key}:`, error);
          }
        });
    });
  }

  /**
   * Remove oldest items when quota is exceeded
   */
  private async removeOldestItems(): Promise<void> {
    const items: StorageItem[] = [];
    const storages = [localStorage, sessionStorage];

    storages.forEach(storage => {
      Object.keys(storage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => {
          try {
            const item: StorageItem = JSON.parse(storage.getItem(key) || '');
            items.push(item);
          } catch (error) {
            console.error(`Error reading item ${key}:`, error);
          }
        });
    });

    // Sort by timestamp and remove oldest items
    items
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, Math.ceil(items.length * 0.2)) // Remove oldest 20%
      .forEach(item => this.removeItem(item.key.replace(STORAGE_PREFIX, '')));
  }

  /**
   * Validate uploaded file accessibility
   */
  private async validateUploadedFile(url: string): Promise<void> {
    try {
      await axios.head(url);
    } catch (error) {
      throw new Error('Uploaded file is not accessible');
    }
  }
}

// Export singleton instance
export default StorageService.getInstance();