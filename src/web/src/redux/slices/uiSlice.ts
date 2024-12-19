// @reduxjs/toolkit v1.9.5
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

// Types
export type Theme = 'light' | 'dark' | 'system';

export interface NotificationPayload {
  id?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  priority?: number;
  duration?: number;
  autoClose?: boolean;
  onClose?: () => void;
}

export interface ModalOptions {
  closeOnEsc: boolean;
  closeOnOverlayClick: boolean;
  preventScroll: boolean;
  trapFocus: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export interface ModalPayload {
  visible: boolean;
  content: React.ReactNode | null;
  options: ModalOptions;
  stack: string[];
}

interface UIState {
  loading: boolean;
  theme: Theme;
  notifications: NotificationPayload[];
  modal: ModalPayload;
  lastLoadingUpdate?: number;
}

// Initial state
const initialState: UIState = {
  loading: false,
  theme: 'system',
  notifications: [],
  modal: {
    visible: false,
    content: null,
    options: {
      closeOnEsc: true,
      closeOnOverlayClick: true,
      preventScroll: true,
      trapFocus: true,
    },
    stack: [],
  },
};

// Performance constants
const LOADING_DEBOUNCE_MS = 300;
const MAX_NOTIFICATIONS = 5;
const DEFAULT_NOTIFICATION_DURATION = 5000;

// Helper functions
const generateNotificationId = (): string => 
  `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const validateContrast = (theme: Theme): boolean => {
  // Implement WCAG contrast validation
  const contrastRatios = {
    light: { text: 4.5, largeText: 3 },
    dark: { text: 4.5, largeText: 3 },
  };
  return theme === 'system' || contrastRatios[theme]?.text >= 4.5;
};

// Slice definition
export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      const now = Date.now();
      if (!state.lastLoadingUpdate || 
          now - state.lastLoadingUpdate >= LOADING_DEBOUNCE_MS) {
        state.loading = action.payload;
        state.lastLoadingUpdate = now;
      }
    },

    showNotification: (state, action: PayloadAction<NotificationPayload>) => {
      const notification = {
        ...action.payload,
        id: action.payload.id || generateNotificationId(),
        priority: action.payload.priority || 0,
        duration: action.payload.duration || DEFAULT_NOTIFICATION_DURATION,
        autoClose: action.payload.autoClose ?? true,
      };

      // Manage notification queue
      state.notifications = [
        ...state.notifications
          .slice(0, MAX_NOTIFICATIONS - 1)
          .sort((a, b) => (b.priority || 0) - (a.priority || 0)),
        notification,
      ];
    },

    dismissNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },

    toggleTheme: (state) => {
      const themes: Theme[] = ['light', 'dark', 'system'];
      const currentIndex = themes.indexOf(state.theme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      
      if (validateContrast(nextTheme)) {
        state.theme = nextTheme;
        // Theme change is handled by a middleware that updates DOM
      }
    },

    setModal: (state, action: PayloadAction<ModalPayload>) => {
      const { visible, content, options, stack } = action.payload;
      
      if (visible && content) {
        // Add to modal stack
        state.modal = {
          visible: true,
          content,
          options: { ...state.modal.options, ...options },
          stack: [...state.modal.stack, generateNotificationId()],
        };
      } else {
        // Remove from modal stack
        state.modal = {
          ...state.modal,
          visible: false,
          content: null,
          stack: state.modal.stack.slice(0, -1),
        };
      }
    },
  },
});

// Action creators
export const { 
  setLoading, 
  showNotification, 
  dismissNotification, 
  toggleTheme, 
  setModal 
} = uiSlice.actions;

// Selectors
export const selectUI = (state: RootState): UIState => state.ui;
export const selectTheme = (state: RootState): Theme => state.ui.theme;
export const selectLoading = (state: RootState): boolean => state.ui.loading;
export const selectNotifications = (state: RootState): NotificationPayload[] => 
  state.ui.notifications;
export const selectModal = (state: RootState): ModalPayload => state.ui.modal;

// Default export
export default uiSlice.reducer;