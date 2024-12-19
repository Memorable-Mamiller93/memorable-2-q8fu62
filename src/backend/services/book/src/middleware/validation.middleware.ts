// External dependencies
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import Joi from 'joi'; // ^17.9.2
import sanitizeHtml from 'sanitize-html'; // ^2.11.0
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.4.1
import { Logger } from '@memorable/logger';
import { MetricsCollector } from '@memorable/metrics';

// Internal dependencies
import { BookAttributes } from '../models/book.model';
import { PageAttributes } from '../models/page.model';

// Initialize metrics collector
const metricsCollector = new MetricsCollector('validation_middleware');

// Initialize rate limiter for validation endpoints
const rateLimiter = new RateLimiter({
    points: 100, // Number of requests
    duration: 60, // Per minute
    blockDuration: 60 * 2 // Block for 2 minutes if exceeded
});

// Constants for validation rules
const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 5000;
const ALLOWED_CONTENT_TYPES = ['text', 'html', 'markdown'];
const CDN_URL_PATTERN = /^https:\/\/cdn\.memorable\.com\/(books|themes)\/.+/;

// Enhanced book schema validation
const bookSchema = Joi.object({
    title: Joi.string()
        .required()
        .min(1)
        .max(MAX_TITLE_LENGTH)
        .pattern(/^[\w\s-]+$/)
        .messages({
            'string.pattern.base': 'Title can only contain letters, numbers, spaces, and hyphens',
            'string.max': `Title cannot exceed ${MAX_TITLE_LENGTH} characters`
        }),
    
    themeId: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'Invalid theme ID format'
        }),
    
    metadata: Joi.object({
        characterInfo: Joi.object({
            name: Joi.string().required(),
            age: Joi.number().min(0).max(100),
            interests: Joi.array().items(Joi.string())
        }).required(),
        
        cdnAssets: Joi.object({
            photos: Joi.array().items(
                Joi.object({
                    original: Joi.string().pattern(CDN_URL_PATTERN),
                    processed: Joi.string().pattern(CDN_URL_PATTERN)
                })
            ),
            illustrations: Joi.object().pattern(
                Joi.string(),
                Joi.object({
                    url: Joi.string().pattern(CDN_URL_PATTERN),
                    version: Joi.number()
                })
            )
        }).required(),
        
        customization: Joi.object({
            colorScheme: Joi.string(),
            fontFamily: Joi.string(),
            printOptions: Joi.object({
                format: Joi.string().valid('softcover', 'hardcover'),
                paperWeight: Joi.number(),
                binding: Joi.string()
            })
        })
    }).required(),
    
    status: Joi.string()
        .valid('draft', 'complete')
        .default('draft')
});

// Enhanced page schema validation
const pageSchema = Joi.object({
    content: Joi.string()
        .required()
        .max(MAX_CONTENT_LENGTH)
        .messages({
            'string.max': `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`
        }),
    
    pageNumber: Joi.number()
        .integer()
        .min(1)
        .required(),
    
    illustrations: Joi.object({
        primary: Joi.object({
            url: Joi.string().pattern(CDN_URL_PATTERN).required(),
            width: Joi.number().min(1).required(),
            height: Joi.number().min(1).required(),
            format: Joi.string().valid('jpg', 'png', 'webp').required(),
            size: Joi.number().max(10 * 1024 * 1024) // 10MB max
        }).required(),
        thumbnails: Joi.object({
            small: Joi.object({
                url: Joi.string().pattern(CDN_URL_PATTERN).required(),
                width: Joi.number().max(300),
                height: Joi.number().max(300)
            }),
            medium: Joi.object({
                url: Joi.string().pattern(CDN_URL_PATTERN).required(),
                width: Joi.number().max(600),
                height: Joi.number().max(600)
            })
        })
    }).required(),
    
    contentType: Joi.string()
        .valid(...ALLOWED_CONTENT_TYPES)
        .default('text')
});

// HTML sanitization options
const sanitizationOptions = {
    allowedTags: ['p', 'b', 'i', 'em', 'strong'],
    allowedAttributes: {},
    allowedSchemes: ['https']
};

/**
 * Validates book creation requests with enhanced security and monitoring
 */
export const validateBookCreation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const startTime = Date.now();
    
    try {
        // Rate limiting check
        await rateLimiter.consume(req.ip);
        
        // Size validation
        const requestSize = Buffer.byteLength(JSON.stringify(req.body));
        if (requestSize > 1024 * 1024) { // 1MB limit
            throw new Error('Request payload too large');
        }

        // Schema validation
        const { error, value } = bookSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            metricsCollector.incrementCounter('book_validation_failures');
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(detail => ({
                    message: detail.message,
                    path: detail.path
                }))
            });
        }

        // Sanitize text content
        value.title = sanitizeHtml(value.title, sanitizationOptions);
        if (value.metadata.characterInfo.name) {
            value.metadata.characterInfo.name = sanitizeHtml(
                value.metadata.characterInfo.name,
                sanitizationOptions
            );
        }

        // Validate CDN assets
        const validateCdnUrls = (urls: string[]): boolean => {
            return urls.every(url => CDN_URL_PATTERN.test(url));
        };

        const photoUrls = value.metadata.cdnAssets.photos.flatMap(
            photo => [photo.original, photo.processed]
        );

        if (!validateCdnUrls(photoUrls)) {
            throw new Error('Invalid CDN asset URLs detected');
        }

        // Attach validated data to request
        req.body = value;

        // Record metrics
        metricsCollector.recordTiming('book_validation_duration', Date.now() - startTime);
        metricsCollector.incrementCounter('book_validation_success');

        next();
    } catch (error) {
        Logger.error('Book validation error', { error, ip: req.ip });
        metricsCollector.incrementCounter('book_validation_errors');
        
        if (error.message === 'Request payload too large') {
            return res.status(413).json({ error: error.message });
        }
        
        return res.status(400).json({ error: error.message });
    }
};

/**
 * Validates page update requests with content type support and security checks
 */
export const validatePageUpdate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const startTime = Date.now();
    
    try {
        // Rate limiting check
        await rateLimiter.consume(req.ip);

        // Schema validation
        const { error, value } = pageSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            metricsCollector.incrementCounter('page_validation_failures');
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(detail => ({
                    message: detail.message,
                    path: detail.path
                }))
            });
        }

        // Content type specific validation and sanitization
        switch (value.contentType) {
            case 'html':
                value.content = sanitizeHtml(value.content, sanitizationOptions);
                break;
            case 'markdown':
                // Basic markdown sanitization
                value.content = value.content.replace(/[<>]/g, '');
                break;
            default:
                // Plain text sanitization
                value.content = sanitizeHtml(value.content, {
                    allowedTags: [],
                    allowedAttributes: {}
                });
        }

        // Validate illustration URLs
        const validateIllustrationUrls = (illustrations: any): boolean => {
            const urls = [illustrations.primary.url];
            if (illustrations.thumbnails) {
                urls.push(
                    illustrations.thumbnails.small?.url,
                    illustrations.thumbnails.medium?.url
                );
            }
            return urls.filter(Boolean).every(url => CDN_URL_PATTERN.test(url));
        };

        if (!validateIllustrationUrls(value.illustrations)) {
            throw new Error('Invalid illustration URLs detected');
        }

        // Attach validated data to request
        req.body = value;

        // Record metrics
        metricsCollector.recordTiming('page_validation_duration', Date.now() - startTime);
        metricsCollector.incrementCounter('page_validation_success');

        next();
    } catch (error) {
        Logger.error('Page validation error', { error, ip: req.ip });
        metricsCollector.incrementCounter('page_validation_errors');
        return res.status(400).json({ error: error.message });
    }
};