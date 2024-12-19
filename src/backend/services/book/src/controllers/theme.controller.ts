// External dependencies
import { Request, Response } from 'express'; // ^4.18.2
import HttpStatus from 'http-status'; // ^1.6.2
import { MetricsCollector } from '@memorable/metrics'; // ^1.0.0

// Internal dependencies
import { Theme } from '../models/theme.model';
import { validateThemeSelection } from '../middleware/validation.middleware';

// Initialize metrics collector
const metricsCollector = new MetricsCollector('theme_controller');

// Error messages constants
const ERROR_MESSAGES = {
    THEME_NOT_FOUND: 'Theme not found or inactive',
    INVALID_THEME: 'Invalid theme configuration or assets',
    UPDATE_FAILED: 'Failed to update theme settings',
    CDN_VALIDATION_FAILED: 'Theme assets validation failed',
    RATE_LIMIT_EXCEEDED: 'Too many theme requests'
} as const;

/**
 * ThemeController class handling theme-related operations with enhanced security and CDN integration
 */
export class ThemeController {
    /**
     * Retrieves all active themes with CDN asset validation and caching
     * @param req Express Request object
     * @param res Express Response object
     */
    public static async getActiveThemes(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();
        try {
            // Fetch active themes with caching
            const themes = await Theme.findActiveThemes();

            // Validate CDN assets for each theme
            const validatedThemes = await Promise.all(
                themes.map(async (theme) => {
                    const cdnValidation = await Theme.validateCdnAssets(theme.cdnAssets);
                    return {
                        ...theme.toJSON(),
                        cdnStatus: cdnValidation.status,
                        assetUrls: cdnValidation.validUrls
                    };
                })
            );

            // Record metrics
            metricsCollector.recordTiming('get_active_themes_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('active_themes_retrieved');

            res.status(HttpStatus.OK).json({
                success: true,
                data: validatedThemes,
                metadata: {
                    count: validatedThemes.length,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            metricsCollector.incrementCounter('theme_errors');
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Failed to retrieve active themes',
                details: error.message
            });
        }
    }

    /**
     * Retrieves a specific theme by ID with enhanced validation and CDN checks
     * @param req Express Request object
     * @param res Express Response object
     */
    public static async getThemeById(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();
        const { themeId } = req.params;

        try {
            // Validate UUID format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(themeId)) {
                res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    error: 'Invalid theme ID format'
                });
                return;
            }

            // Fetch theme with caching
            const theme = await Theme.findThemeById(themeId);

            if (!theme) {
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: ERROR_MESSAGES.THEME_NOT_FOUND
                });
                return;
            }

            // Validate CDN assets
            const cdnValidation = await Theme.validateCdnAssets(theme.cdnAssets);
            if (!cdnValidation.status) {
                res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
                    success: false,
                    error: ERROR_MESSAGES.CDN_VALIDATION_FAILED,
                    details: cdnValidation.errors
                });
                return;
            }

            // Record metrics
            metricsCollector.recordTiming('get_theme_by_id_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('theme_retrieved');

            res.status(HttpStatus.OK).json({
                success: true,
                data: {
                    ...theme.toJSON(),
                    cdnStatus: cdnValidation.status,
                    assetUrls: cdnValidation.validUrls
                }
            });
        } catch (error) {
            metricsCollector.incrementCounter('theme_errors');
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Failed to retrieve theme',
                details: error.message
            });
        }
    }

    /**
     * Updates theme settings with enhanced validation and CDN integration
     * @param req Express Request object
     * @param res Express Response object
     */
    @validateThemeSelection
    public static async updateTheme(req: Request, res: Response): Promise<void> {
        const startTime = Date.now();
        const { themeId } = req.params;
        const { settings } = req.body;

        try {
            // Validate settings structure
            if (!settings || typeof settings !== 'object') {
                res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    error: 'Invalid settings format'
                });
                return;
            }

            // Update theme with validation
            const updatedTheme = await Theme.updateThemeSettings(themeId, settings);

            // Validate updated CDN assets
            const cdnValidation = await Theme.validateCdnAssets(updatedTheme.cdnAssets);
            if (!cdnValidation.status) {
                res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
                    success: false,
                    error: ERROR_MESSAGES.CDN_VALIDATION_FAILED,
                    details: cdnValidation.errors
                });
                return;
            }

            // Record metrics
            metricsCollector.recordTiming('update_theme_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('theme_updated');

            res.status(HttpStatus.OK).json({
                success: true,
                data: {
                    ...updatedTheme.toJSON(),
                    cdnStatus: cdnValidation.status,
                    assetUrls: cdnValidation.validUrls
                },
                metadata: {
                    updatedAt: new Date().toISOString(),
                    version: updatedTheme.version
                }
            });
        } catch (error) {
            metricsCollector.incrementCounter('theme_update_errors');
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: ERROR_MESSAGES.UPDATE_FAILED,
                details: error.message
            });
        }
    }
}

export default ThemeController;