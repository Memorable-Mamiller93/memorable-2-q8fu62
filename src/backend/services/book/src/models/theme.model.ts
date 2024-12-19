import { Model, DataTypes, HasMany } from 'sequelize'; // v6.32.1
import { IsUUID, IsString, IsBoolean, IsObject, IsDate, validateOrReject } from 'class-validator'; // v0.14.0
import { pool } from '../config/database.config';
import { RedisCache } from '@memorable/cache'; // Internal caching utility
import { Logger } from '@memorable/logger'; // Internal logging utility
import { MetricsCollector } from '@memorable/metrics'; // Internal metrics utility

// Initialize metrics collector for theme operations
const metricsCollector = new MetricsCollector('theme_model');

// Initialize Redis cache for themes
const themeCache = new RedisCache('themes', {
    ttl: 3600, // 1 hour cache TTL
    maxSize: 1000 // Maximum number of cached themes
});

/**
 * Interface for CDN asset references
 */
interface ThemeCdnAssets {
    backgroundImages: string[];
    iconSet: string;
    fontFamily: string;
    colorPalette: string;
    templateAssets: {
        [key: string]: string;
    };
}

/**
 * Interface for theme visual and narrative settings
 */
interface ThemeSettings {
    visualStyle: {
        primaryColor: string;
        secondaryColor: string;
        fontScale: number;
        spacing: number;
        borderRadius: number;
    };
    narrativeTemplate: {
        storyStructure: string;
        characterRoles: string[];
        plotPoints: string[];
        emotionalTone: string;
    };
    printSpecifications: {
        dpi: number;
        colorSpace: 'CMYK' | 'RGB';
        bleed: number;
        paperWeight: number;
    };
}

/**
 * Interface defining the structure of theme attributes
 */
export interface ThemeAttributes {
    id: string;
    name: string;
    settings: ThemeSettings;
    cdnAssets: ThemeCdnAssets;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Enhanced Theme model class with validation and CDN asset management
 */
@Table({
    tableName: 'themes',
    indexes: [
        { fields: ['active'] },
        { fields: ['name'], unique: true }
    ]
})
export class Theme extends Model<ThemeAttributes> {
    @IsUUID(4)
    @Column({
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    id!: string;

    @IsString()
    @Column({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [2, 100]
        }
    })
    name!: string;

    @IsObject()
    @Column({
        type: DataTypes.JSONB,
        allowNull: false
    })
    settings!: ThemeSettings;

    @IsObject()
    @Column({
        type: DataTypes.JSONB,
        allowNull: false
    })
    cdnAssets!: ThemeCdnAssets;

    @IsBoolean()
    @Column({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    })
    active!: boolean;

    @IsDate()
    @Column({
        type: DataTypes.DATE,
        allowNull: false
    })
    createdAt!: Date;

    @IsDate()
    @Column({
        type: DataTypes.DATE,
        allowNull: false
    })
    updatedAt!: Date;

    @HasMany(() => Book)
    books!: Book[];

    /**
     * Validates theme settings and CDN assets
     * @throws ValidationError if validation fails
     */
    private async validateTheme(): Promise<void> {
        try {
            await validateOrReject(this);
            
            // Validate CDN asset URLs
            const cdnUrlPattern = /^https:\/\/cdn\.memorable\.com\/themes\/.+/;
            const assetValidation = Object.values(this.cdnAssets.templateAssets)
                .every(url => cdnUrlPattern.test(url));
            
            if (!assetValidation) {
                throw new Error('Invalid CDN asset URLs detected');
            }

            // Validate print specifications
            const { printSpecifications } = this.settings;
            if (printSpecifications.dpi < 300) {
                throw new Error('Print DPI must be at least 300');
            }

            metricsCollector.incrementCounter('theme_validations_success');
        } catch (error) {
            metricsCollector.incrementCounter('theme_validations_failed');
            Logger.error('Theme validation failed', { error, themeId: this.id });
            throw error;
        }
    }

    /**
     * Retrieves all active themes with caching
     * @returns Promise<Theme[]> List of active themes
     */
    static async findActiveThemes(): Promise<Theme[]> {
        const cacheKey = 'active_themes';
        try {
            // Check cache first
            const cachedThemes = await themeCache.get(cacheKey);
            if (cachedThemes) {
                metricsCollector.incrementCounter('theme_cache_hits');
                return cachedThemes;
            }

            // Query database if cache miss
            const themes = await Theme.findAll({
                where: { active: true },
                order: [['name', 'ASC']]
            });

            // Update cache
            await themeCache.set(cacheKey, themes);
            metricsCollector.incrementCounter('theme_cache_misses');

            return themes;
        } catch (error) {
            Logger.error('Error fetching active themes', { error });
            metricsCollector.incrementCounter('theme_fetch_errors');
            throw error;
        }
    }

    /**
     * Retrieves a specific theme by ID with validation
     * @param themeId - UUID of the theme to retrieve
     * @returns Promise<Theme | null> Theme instance if found
     */
    static async findThemeById(themeId: string): Promise<Theme | null> {
        const cacheKey = `theme:${themeId}`;
        try {
            // Check cache first
            const cachedTheme = await themeCache.get(cacheKey);
            if (cachedTheme) {
                metricsCollector.incrementCounter('theme_cache_hits');
                return cachedTheme;
            }

            // Query database if cache miss
            const theme = await Theme.findByPk(themeId);
            if (theme) {
                await theme.validateTheme();
                await themeCache.set(cacheKey, theme);
            }

            metricsCollector.incrementCounter('theme_cache_misses');
            return theme;
        } catch (error) {
            Logger.error('Error fetching theme by ID', { error, themeId });
            metricsCollector.incrementCounter('theme_fetch_errors');
            throw error;
        }
    }

    /**
     * Updates theme settings with comprehensive validation
     * @param themeId - UUID of the theme to update
     * @param settings - New theme settings
     * @returns Promise<Theme> Updated theme instance
     */
    static async updateThemeSettings(
        themeId: string,
        settings: ThemeSettings
    ): Promise<Theme> {
        const transaction = await pool.getConnection();
        try {
            const theme = await Theme.findByPk(themeId, { transaction });
            if (!theme) {
                throw new Error('Theme not found');
            }

            theme.settings = settings;
            await theme.validateTheme();
            await theme.save({ transaction });

            // Invalidate cache
            await themeCache.delete(`theme:${themeId}`);
            await themeCache.delete('active_themes');

            await transaction.commit();
            metricsCollector.incrementCounter('theme_updates_success');

            return theme;
        } catch (error) {
            await transaction.rollback();
            Logger.error('Error updating theme settings', { error, themeId });
            metricsCollector.incrementCounter('theme_updates_failed');
            throw error;
        }
    }
}

// Initialize hooks for cache management
Theme.afterCreate(async (theme: Theme) => {
    await themeCache.delete('active_themes');
    metricsCollector.incrementCounter('theme_creates');
});

Theme.afterUpdate(async (theme: Theme) => {
    await themeCache.delete(`theme:${theme.id}`);
    await themeCache.delete('active_themes');
    metricsCollector.incrementCounter('theme_updates');
});

Theme.afterDestroy(async (theme: Theme) => {
    await themeCache.delete(`theme:${theme.id}`);
    await themeCache.delete('active_themes');
    metricsCollector.incrementCounter('theme_deletes');
});

export default Theme;