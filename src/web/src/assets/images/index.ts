// @version: 1.0.0
// Central index file for all image assets used in the Memorable platform
// Implements Material Design 3.0 principles for consistent visual hierarchy

// Base path for all image assets
export const IMAGE_BASE_PATH = '/assets/images/';

// Type definitions for various image asset categories
export interface ImageAsset {
  default: string;
  light: string;
  dark: string;
  icon: string;
}

export interface ThemeAsset {
  preview: string;
  background: string;
  icons: string[];
  decorations: string[];
}

export interface ResponsiveImage {
  mobile: string;
  tablet: string;
  desktop: string;
  alt: string;
}

export interface FeatureImage {
  icon: string;
  illustration: string;
  alt: string;
}

export interface StepImage {
  illustration: string;
  icon: string;
  alt: string;
}

export interface TestimonialImage {
  avatar: string;
  background: string;
  alt: string;
}

export interface BookPreview {
  cover: string;
  thumbnail: string;
  pages: string[];
}

export interface PagePreview {
  image: string;
  thumbnail: string;
  overlay: string;
}

export interface OverlayImage {
  watermark: string;
  preview: string;
  loading: string;
}

// Company logo variants
export const logo: ImageAsset = {
  default: `${IMAGE_BASE_PATH}logo/memorable-logo.svg`,
  light: `${IMAGE_BASE_PATH}logo/memorable-logo-light.svg`,
  dark: `${IMAGE_BASE_PATH}logo/memorable-logo-dark.svg`,
  icon: `${IMAGE_BASE_PATH}logo/memorable-icon.svg`,
};

// Theme assets for book creation
export const themes: Record<string, ThemeAsset> = {
  magical: {
    preview: `${IMAGE_BASE_PATH}themes/magical/preview.jpg`,
    background: `${IMAGE_BASE_PATH}themes/magical/background.jpg`,
    icons: [
      `${IMAGE_BASE_PATH}themes/magical/icons/wand.svg`,
      `${IMAGE_BASE_PATH}themes/magical/icons/potion.svg`,
      `${IMAGE_BASE_PATH}themes/magical/icons/crystal.svg`,
    ],
    decorations: [
      `${IMAGE_BASE_PATH}themes/magical/decorations/sparkles.svg`,
      `${IMAGE_BASE_PATH}themes/magical/decorations/stars.svg`,
      `${IMAGE_BASE_PATH}themes/magical/decorations/moon.svg`,
    ],
  },
  adventure: {
    preview: `${IMAGE_BASE_PATH}themes/adventure/preview.jpg`,
    background: `${IMAGE_BASE_PATH}themes/adventure/background.jpg`,
    icons: [
      `${IMAGE_BASE_PATH}themes/adventure/icons/compass.svg`,
      `${IMAGE_BASE_PATH}themes/adventure/icons/map.svg`,
      `${IMAGE_BASE_PATH}themes/adventure/icons/backpack.svg`,
    ],
    decorations: [
      `${IMAGE_BASE_PATH}themes/adventure/decorations/mountains.svg`,
      `${IMAGE_BASE_PATH}themes/adventure/decorations/trees.svg`,
      `${IMAGE_BASE_PATH}themes/adventure/decorations/clouds.svg`,
    ],
  },
  educational: {
    preview: `${IMAGE_BASE_PATH}themes/educational/preview.jpg`,
    background: `${IMAGE_BASE_PATH}themes/educational/background.jpg`,
    icons: [
      `${IMAGE_BASE_PATH}themes/educational/icons/book.svg`,
      `${IMAGE_BASE_PATH}themes/educational/icons/pencil.svg`,
      `${IMAGE_BASE_PATH}themes/educational/icons/globe.svg`,
    ],
    decorations: [
      `${IMAGE_BASE_PATH}themes/educational/decorations/numbers.svg`,
      `${IMAGE_BASE_PATH}themes/educational/decorations/letters.svg`,
      `${IMAGE_BASE_PATH}themes/educational/decorations/shapes.svg`,
    ],
  },
};

// Marketing and landing page images
export const marketing = {
  hero: {
    mobile: `${IMAGE_BASE_PATH}marketing/hero-mobile.jpg`,
    tablet: `${IMAGE_BASE_PATH}marketing/hero-tablet.jpg`,
    desktop: `${IMAGE_BASE_PATH}marketing/hero-desktop.jpg`,
    alt: 'Create magical personalized stories for your children',
  },
  features: [
    {
      icon: `${IMAGE_BASE_PATH}marketing/features/ai-icon.svg`,
      illustration: `${IMAGE_BASE_PATH}marketing/features/ai-illustration.svg`,
      alt: 'AI-powered story generation',
    },
    {
      icon: `${IMAGE_BASE_PATH}marketing/features/customize-icon.svg`,
      illustration: `${IMAGE_BASE_PATH}marketing/features/customize-illustration.svg`,
      alt: 'Fully customizable stories',
    },
    {
      icon: `${IMAGE_BASE_PATH}marketing/features/print-icon.svg`,
      illustration: `${IMAGE_BASE_PATH}marketing/features/print-illustration.svg`,
      alt: 'Professional quality printing',
    },
  ],
  howItWorks: [
    {
      illustration: `${IMAGE_BASE_PATH}marketing/steps/upload-illustration.svg`,
      icon: `${IMAGE_BASE_PATH}marketing/steps/upload-icon.svg`,
      alt: 'Upload your photos',
    },
    {
      illustration: `${IMAGE_BASE_PATH}marketing/steps/customize-illustration.svg`,
      icon: `${IMAGE_BASE_PATH}marketing/steps/customize-icon.svg`,
      alt: 'Customize your story',
    },
    {
      illustration: `${IMAGE_BASE_PATH}marketing/steps/preview-illustration.svg`,
      icon: `${IMAGE_BASE_PATH}marketing/steps/preview-icon.svg`,
      alt: 'Preview and order',
    },
  ],
  testimonials: [
    {
      avatar: `${IMAGE_BASE_PATH}marketing/testimonials/avatar-1.jpg`,
      background: `${IMAGE_BASE_PATH}marketing/testimonials/bg-1.jpg`,
      alt: 'Happy parent testimonial',
    },
    {
      avatar: `${IMAGE_BASE_PATH}marketing/testimonials/avatar-2.jpg`,
      background: `${IMAGE_BASE_PATH}marketing/testimonials/bg-2.jpg`,
      alt: 'Satisfied grandparent testimonial',
    },
  ],
};

// Placeholder images
export const placeholders = {
  bookCover: `${IMAGE_BASE_PATH}placeholders/book-cover.svg`,
  illustration: `${IMAGE_BASE_PATH}placeholders/illustration.svg`,
  avatar: `${IMAGE_BASE_PATH}placeholders/avatar.svg`,
  photoUpload: `${IMAGE_BASE_PATH}placeholders/photo-upload.svg`,
  loading: `${IMAGE_BASE_PATH}placeholders/loading.svg`,
};

// Demo mode assets
export const demo = {
  sampleBooks: [
    {
      cover: `${IMAGE_BASE_PATH}demo/books/magical-adventure-cover.jpg`,
      thumbnail: `${IMAGE_BASE_PATH}demo/books/magical-adventure-thumb.jpg`,
      pages: [
        `${IMAGE_BASE_PATH}demo/books/magical-adventure-p1.jpg`,
        `${IMAGE_BASE_PATH}demo/books/magical-adventure-p2.jpg`,
        `${IMAGE_BASE_PATH}demo/books/magical-adventure-p3.jpg`,
      ],
    },
    {
      cover: `${IMAGE_BASE_PATH}demo/books/space-explorer-cover.jpg`,
      thumbnail: `${IMAGE_BASE_PATH}demo/books/space-explorer-thumb.jpg`,
      pages: [
        `${IMAGE_BASE_PATH}demo/books/space-explorer-p1.jpg`,
        `${IMAGE_BASE_PATH}demo/books/space-explorer-p2.jpg`,
        `${IMAGE_BASE_PATH}demo/books/space-explorer-p3.jpg`,
      ],
    },
  ],
  samplePages: [
    {
      image: `${IMAGE_BASE_PATH}demo/pages/sample-page-1.jpg`,
      thumbnail: `${IMAGE_BASE_PATH}demo/pages/sample-page-1-thumb.jpg`,
      overlay: `${IMAGE_BASE_PATH}demo/pages/sample-page-1-overlay.png`,
    },
    {
      image: `${IMAGE_BASE_PATH}demo/pages/sample-page-2.jpg`,
      thumbnail: `${IMAGE_BASE_PATH}demo/pages/sample-page-2-thumb.jpg`,
      overlay: `${IMAGE_BASE_PATH}demo/pages/sample-page-2-overlay.png`,
    },
  ],
  previewOverlays: [
    {
      watermark: `${IMAGE_BASE_PATH}demo/overlays/watermark.png`,
      preview: `${IMAGE_BASE_PATH}demo/overlays/preview-frame.png`,
      loading: `${IMAGE_BASE_PATH}demo/overlays/loading-animation.gif`,
    },
  ],
};