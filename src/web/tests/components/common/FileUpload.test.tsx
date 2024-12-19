import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FileUpload, FileUploadProps } from '../../../src/components/common/FileUpload';
import { validateFile } from '../../../src/utils/file.utils';
import { useTheme } from '../../../src/hooks/useTheme';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('../../../src/utils/file.utils');
vi.mock('../../../src/hooks/useTheme');
vi.mock('heic2any');

// Mock file validation utility
const mockValidateFile = validateFile as jest.Mock;

// Test constants
const TEST_FILE_CONTENT = 'test file content';
const DEFAULT_PROPS: FileUploadProps = {
  onFileSelect: vi.fn(),
  onUploadComplete: vi.fn(),
  onUploadError: vi.fn(),
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/heic'],
  autoCompress: true,
  compressionOptions: {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    quality: 0.8
  }
};

// Helper function to create mock files
const createMockFile = ({
  name = 'test.jpg',
  type = 'image/jpeg',
  size = 1024,
  lastModified = Date.now()
} = {}): File => {
  const blob = new Blob([TEST_FILE_CONTENT], { type });
  return new File([blob], name, { type, lastModified });
};

describe('FileUpload Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockValidateFile.mockResolvedValue({ isValid: true, error: null });

    // Mock window.matchMedia for theme testing
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<FileUpload {...DEFAULT_PROPS} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes', () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('aria-label');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
    });

    it('should be keyboard navigable', async () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      
      dropZone.focus();
      expect(document.activeElement).toBe(dropZone);
      
      await user.keyboard('{Enter}');
      expect(DEFAULT_PROPS.onFileSelect).toHaveBeenCalled();
    });
  });

  describe('Drag and Drop', () => {
    it('should handle file drop correctly', async () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      const file = createMockFile();
      
      fireEvent.dragEnter(dropZone, {
        dataTransfer: { files: [file] }
      });
      expect(dropZone).toHaveClass('drag-active');

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] }
      });
      
      await waitFor(() => {
        expect(DEFAULT_PROPS.onFileSelect).toHaveBeenCalledWith([file]);
      });
    });

    it('should handle multiple file drops', async () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      const files = [
        createMockFile({ name: 'test1.jpg' }),
        createMockFile({ name: 'test2.jpg' })
      ];

      fireEvent.drop(dropZone, {
        dataTransfer: { files }
      });

      await waitFor(() => {
        expect(DEFAULT_PROPS.onFileSelect).toHaveBeenCalledWith(files);
      });
    });

    it('should prevent default drag behaviors', () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      const dragOverEvent = fireEvent.dragOver(dropZone);
      expect(dragOverEvent.defaultPrevented).toBe(true);
    });
  });

  describe('File Validation', () => {
    it('should validate file size', async () => {
      mockValidateFile.mockResolvedValueOnce({
        isValid: false,
        error: 'File size exceeds limit'
      });

      render(<FileUpload {...DEFAULT_PROPS} />);
      const file = createMockFile({ size: 10 * 1024 * 1024 }); // 10MB
      
      const input = screen.getByRole('button').querySelector('input');
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(DEFAULT_PROPS.onUploadError).toHaveBeenCalled();
      });
    });

    it('should validate file type', async () => {
      mockValidateFile.mockResolvedValueOnce({
        isValid: false,
        error: 'Invalid file type'
      });

      render(<FileUpload {...DEFAULT_PROPS} />);
      const file = createMockFile({ type: 'text/plain' });
      
      const input = screen.getByRole('button').querySelector('input');
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(DEFAULT_PROPS.onUploadError).toHaveBeenCalled();
      });
    });

    it('should handle HEIC conversion', async () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const heicFile = createMockFile({
        name: 'test.heic',
        type: 'image/heic'
      });

      const input = screen.getByRole('button').querySelector('input');
      fireEvent.change(input!, { target: { files: [heicFile] } });

      await waitFor(() => {
        expect(DEFAULT_PROPS.onFileSelect).toHaveBeenCalled();
      });
    });
  });

  describe('Upload Progress', () => {
    it('should show upload progress', async () => {
      const { rerender } = render(<FileUpload {...DEFAULT_PROPS} />);
      
      // Simulate upload progress
      rerender(
        <FileUpload
          {...DEFAULT_PROPS}
          progress={{ loaded: 50, total: 100, percentage: 50 }}
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('50% uploaded')).toBeInTheDocument();
    });

    it('should handle upload cancellation', async () => {
      const onCancel = vi.fn();
      render(
        <FileUpload
          {...DEFAULT_PROPS}
          onCancel={onCancel}
          progress={{ loaded: 50, total: 100, percentage: 50 }}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to mobile viewport', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveStyle({ width: '100%' });
    });

    it('should handle touch events', async () => {
      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');

      fireEvent.touchStart(dropZone);
      fireEvent.touchEnd(dropZone);

      const input = dropZone.querySelector('input');
      expect(input).toHaveAttribute('type', 'file');
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme styles', () => {
      (useTheme as jest.Mock).mockReturnValue({
        currentTheme: {
          settings: {
            colors: {
              primary: { base: '#6200EE' },
              surface: { base: '#FFFFFF' }
            }
          }
        }
      });

      render(<FileUpload {...DEFAULT_PROPS} />);
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveStyle({
        backgroundColor: 'var(--color-surface)'
      });
    });
  });
});