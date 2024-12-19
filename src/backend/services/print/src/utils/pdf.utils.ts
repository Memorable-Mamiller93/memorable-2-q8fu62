// @package pdfkit ^3.0.0 - ISO-compliant PDF document creation and manipulation
import PDFDocument from 'pdfkit';
// @package sharp ^0.32.1 - High-performance image processing for print-ready PDF generation
import sharp from 'sharp';
// @package icc ^2.0.0 - ICC profile management for ISO 12647-2 compliance
import icc from 'icc';

import { PrintQuality } from '../models/print.model';
import { printerQualityConfig } from '../config/printer.config';

/**
 * Configuration interface for ISO-compliant PDF generation
 */
interface PDFOptions {
  size: string;              // ISO 216 standard page sizes (A4, A5, etc.)
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    bleed: number;          // ISO 19593-1 compliant bleed area
  };
  colorSpace: string;       // ISO 12647-2 color space specification
  resolution: number;       // ISO 15930-1 compliant DPI resolution
}

/**
 * Creates a print-ready PDF with ISO-compliant color management and printer marks
 * @param pages Array of page image buffers
 * @param quality Print quality specifications
 * @returns Promise<Buffer> ISO-compliant print-ready PDF buffer
 */
export async function createPrintablePDF(
  pages: Buffer[],
  quality: PrintQuality
): Promise<Buffer> {
  // Validate quality specifications against ISO standards
  await validatePrintQuality(pages[0], quality);

  // Initialize PDF document with ISO-compliant settings
  const pdfOptions: PDFOptions = {
    size: 'A4',
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      bleed: quality.bleed || printerQualityConfig.bleed
    },
    colorSpace: quality.colorSpace || printerQualityConfig.colorSpace,
    resolution: quality.resolution || printerQualityConfig.resolution
  };

  const doc = new PDFDocument({
    size: pdfOptions.size,
    margin: 0,
    autoFirstPage: false,
    pdfVersion: '1.7',
    lang: 'en-US',
    displayTitle: true,
    info: {
      Title: 'Print-Ready Book',
      Producer: 'Memorable Print Service',
      Creator: 'PDF Utils v1.0',
      CreationDate: new Date()
    }
  });

  // Create PDF buffer promise
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  const pdfBuffer = new Promise<Buffer>((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
  });

  // Process each page with ISO-compliant color management
  for (const pageBuffer of pages) {
    const processedPage = await applyColorProfile(pageBuffer, pdfOptions.colorSpace);
    
    doc.addPage();
    
    // Add ISO 19593-1 compliant bleed marks
    await addBleedMarks(doc, pdfOptions.margins.bleed);
    
    // Add processed page image
    doc.image(processedPage, {
      fit: [
        doc.page.width + (pdfOptions.margins.bleed * 2),
        doc.page.height + (pdfOptions.margins.bleed * 2)
      ],
      align: 'center',
      valign: 'center'
    });
  }

  doc.end();
  return pdfBuffer;
}

/**
 * Applies ISO 12647-2 compliant color profiles to images
 * @param imageBuffer Input image buffer
 * @param colorSpace Target color space
 * @returns Promise<Buffer> Color-managed image buffer
 */
async function applyColorProfile(
  imageBuffer: Buffer,
  colorSpace: string
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Load appropriate ICC profile based on color space
  const iccProfile = await icc.loadProfile(
    colorSpace === 'CMYK' ? 
    'ISO_Coated_v2_300_eci.icc' : 
    'sRGB_v4_ICC_preference.icc'
  );

  // Apply color transformation
  return image
    .withMetadata({
      icc: iccProfile.buffer
    })
    .toColorspace(colorSpace === 'CMYK' ? 'cmyk' : 'srgb')
    .toBuffer();
}

/**
 * Adds ISO 19593-1 compliant printer marks
 * @param doc PDF document
 * @param bleed Bleed size in mm
 */
function addBleedMarks(doc: PDFDocument, bleed: number): void {
  const bleedPt = mmToPt(bleed);
  const markLength = mmToPt(5);
  const markOffset = mmToPt(3);

  // Draw crop marks
  doc.save();
  doc.lineWidth(0.5);
  doc.strokeColor('black');

  // Top-left corner
  doc.moveTo(-markOffset, bleedPt).lineTo(markLength, bleedPt).stroke();
  doc.moveTo(bleedPt, -markOffset).lineTo(bleedPt, markLength).stroke();

  // Top-right corner
  doc.moveTo(doc.page.width + markOffset, bleedPt)
     .lineTo(doc.page.width - markLength, bleedPt).stroke();
  doc.moveTo(doc.page.width - bleedPt, -markOffset)
     .lineTo(doc.page.width - bleedPt, markLength).stroke();

  // Bottom-left corner
  doc.moveTo(-markOffset, doc.page.height - bleedPt)
     .lineTo(markLength, doc.page.height - bleedPt).stroke();
  doc.moveTo(bleedPt, doc.page.height + markOffset)
     .lineTo(bleedPt, doc.page.height - markLength).stroke();

  // Bottom-right corner
  doc.moveTo(doc.page.width + markOffset, doc.page.height - bleedPt)
     .lineTo(doc.page.width - markLength, doc.page.height - bleedPt).stroke();
  doc.moveTo(doc.page.width - bleedPt, doc.page.height + markOffset)
     .lineTo(doc.page.width - bleedPt, doc.page.height - markLength).stroke();

  doc.restore();
}

/**
 * Validates image quality against ISO print standards
 * @param imageBuffer Image buffer to validate
 * @param quality Print quality specifications
 * @returns Promise<boolean> Compliance with quality standards
 */
export async function validatePrintQuality(
  imageBuffer: Buffer,
  quality: PrintQuality
): Promise<boolean> {
  const metadata = await sharp(imageBuffer).metadata();

  // Validate resolution (ISO 15930-1)
  if ((metadata.density || 0) < quality.resolution) {
    throw new Error(`Image resolution below ISO 15930-1 requirement: ${quality.resolution} DPI`);
  }

  // Validate color space (ISO 12647-2)
  if (metadata.space !== quality.colorSpace.toLowerCase()) {
    throw new Error(`Invalid color space: ${metadata.space}. Expected: ${quality.colorSpace}`);
  }

  // Validate dimensions including bleed
  const minWidth = mmToPt(quality.trimBox.width + (quality.bleed * 2));
  const minHeight = mmToPt(quality.trimBox.height + (quality.bleed * 2));

  if ((metadata.width || 0) < minWidth || (metadata.height || 0) < minHeight) {
    throw new Error('Image dimensions insufficient for required bleed area');
  }

  return true;
}

/**
 * Converts millimeters to points for PDF generation
 * @param mm Millimeter value
 * @returns number Points value
 */
function mmToPt(mm: number): number {
  return mm * 2.83465; // 1mm = 2.83465pt
}