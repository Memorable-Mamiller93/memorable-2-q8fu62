/**
 * @fileoverview AI Service API client implementation
 * Handles story generation and illustration creation with enhanced error handling,
 * validation, performance monitoring, and safety checks
 * @version 1.0.0
 */

import axios from 'axios'; // v1.4.0
import { ApiResponse, ApiError } from '../types/api.types';
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS, API_ERROR_CODES } from '../constants/api.constants';

// Constants for timeouts and retry configuration
const AI_TIMEOUTS = {
  STORY_GENERATION: 30000, // 30 seconds as per requirements
  ILLUSTRATION_GENERATION: 45000 // 45 seconds as per requirements
} as const;

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BACKOFF_FACTOR: 1.5,
  RETRY_STATUS_CODES: [408, 429, 500, 502, 503, 504]
} as const;

/**
 * Story complexity levels for content generation
 */
export enum StoryComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex'
}

/**
 * Illustration styles supported by the AI service
 */
export enum IllustrationStyle {
  CARTOON = 'cartoon',
  WATERCOLOR = 'watercolor',
  REALISTIC = 'realistic',
  PIXEL_ART = 'pixel_art'
}

/**
 * Image format options for generated illustrations
 */
export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  WEBP = 'webp'
}

/**
 * Safety settings for content generation
 */
export interface SafetySettings {
  contentFilter: boolean;
  ageAppropriate: boolean;
  violenceLevel: 'none' | 'mild' | 'moderate';
  languageControl: boolean;
}

/**
 * Enhanced interface for story generation request parameters
 */
export interface StoryRequest {
  characterName: string;
  characterAge: number;
  interests: string[];
  theme: string;
  tone: string;
  complexity: StoryComplexity;
  safetySettings: SafetySettings;
}

/**
 * Enhanced interface for illustration generation request parameters
 */
export interface IllustrationRequest {
  prompt: string;
  style: IllustrationStyle;
  width: number;
  height: number;
  format: ImageFormat;
  safetySettings: SafetySettings;
}

/**
 * Validates story generation request parameters
 * @param request - Story generation request
 * @throws {Error} If validation fails
 */
const validateStoryRequest = (request: StoryRequest): void => {
  if (!request.characterName || request.characterName.length < 2) {
    throw new Error('Invalid character name');
  }
  if (request.characterAge < 1 || request.characterAge > 12) {
    throw new Error('Character age must be between 1 and 12');
  }
  if (!request.interests || request.interests.length === 0) {
    throw new Error('At least one interest must be specified');
  }
  if (!request.theme || !request.tone) {
    throw new Error('Theme and tone are required');
  }
};

/**
 * Validates illustration generation request parameters
 * @param request - Illustration generation request
 * @throws {Error} If validation fails
 */
const validateIllustrationRequest = (request: IllustrationRequest): void => {
  if (!request.prompt || request.prompt.length < 10) {
    throw new Error('Prompt must be at least 10 characters');
  }
  if (request.width < 256 || request.width > 1024 || request.height < 256 || request.height > 1024) {
    throw new Error('Dimensions must be between 256 and 1024 pixels');
  }
  if (!Object.values(IllustrationStyle).includes(request.style)) {
    throw new Error('Invalid illustration style');
  }
};

/**
 * Generates a personalized story using OpenAI with enhanced validation and monitoring
 * @param request - Story generation request parameters
 * @returns Promise resolving to generated story content
 */
export const generateStory = async (request: StoryRequest): Promise<ApiResponse<string>> => {
  try {
    // Validate request parameters
    validateStoryRequest(request);

    // Add performance monitoring metadata
    const startTime = Date.now();

    const response = await apiClient.post<ApiResponse<string>>(
      API_ENDPOINTS.AI.GENERATE_STORY,
      request,
      {
        timeout: AI_TIMEOUTS.STORY_GENERATION,
        headers: {
          'X-Safety-Filter': request.safetySettings.contentFilter ? 'enabled' : 'disabled',
          'X-Age-Range': `${request.characterAge}`
        }
      }
    );

    // Log performance metrics
    const duration = Date.now() - startTime;
    if (duration > AI_TIMEOUTS.STORY_GENERATION * 0.8) {
      console.warn(`Story generation approaching timeout: ${duration}ms`);
    }

    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw {
        error: 'Story generation failed',
        code: API_ERROR_CODES.CONTENT_GENERATION_ERROR,
        details: error.response?.data || error.message
      } as ApiError;
    }
    throw error;
  }
};

/**
 * Creates book illustrations using Stable Diffusion with safety checks
 * @param request - Illustration generation request parameters
 * @returns Promise resolving to generated illustration URL
 */
export const generateIllustration = async (request: IllustrationRequest): Promise<ApiResponse<string>> => {
  try {
    // Validate request parameters
    validateIllustrationRequest(request);

    // Add performance monitoring metadata
    const startTime = Date.now();

    const response = await apiClient.post<ApiResponse<string>>(
      API_ENDPOINTS.AI.GENERATE_ILLUSTRATION,
      request,
      {
        timeout: AI_TIMEOUTS.ILLUSTRATION_GENERATION,
        headers: {
          'X-Safety-Filter': request.safetySettings.contentFilter ? 'enabled' : 'disabled',
          'X-Image-Format': request.format,
          'X-Style-Preset': request.style
        }
      }
    );

    // Log performance metrics
    const duration = Date.now() - startTime;
    if (duration > AI_TIMEOUTS.ILLUSTRATION_GENERATION * 0.8) {
      console.warn(`Illustration generation approaching timeout: ${duration}ms`);
    }

    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw {
        error: 'Illustration generation failed',
        code: API_ERROR_CODES.CONTENT_GENERATION_ERROR,
        details: error.response?.data || error.message
      } as ApiError;
    }
    throw error;
  }
};

/**
 * Validates generated content for safety and appropriateness
 * @param content - Content to validate
 * @param safetySettings - Safety settings to apply
 * @returns Promise resolving to validation result
 */
export const validateGeneratedContent = async (
  content: string,
  safetySettings: SafetySettings
): Promise<ApiResponse<boolean>> => {
  try {
    const response = await apiClient.post<ApiResponse<boolean>>(
      API_ENDPOINTS.AI.VALIDATE_CONTENT,
      {
        content,
        safetySettings
      }
    );
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw {
        error: 'Content validation failed',
        code: API_ERROR_CODES.CONTENT_GENERATION_ERROR,
        details: error.response?.data || error.message
      } as ApiError;
    }
    throw error;
  }
};