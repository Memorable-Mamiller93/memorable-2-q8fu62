/**
 * @fileoverview Authentication layout component implementing Material Design 3.0 principles
 * Provides consistent layout for login, registration, and password reset pages
 * with enhanced accessibility and responsive design
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Container, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal components
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useAuth } from '../hooks/useAuth';

/**
 * Props interface for the AuthLayout component
 */
interface AuthLayoutProps {
  /** Child components to render in the auth layout */
  children: React.ReactNode;
  /** Optional maximum width for the content container */
  maxWidth?: string;
  /** Optional flag to show/hide header */
  showHeader?: boolean;
  /** Optional flag to show/hide footer */
  showFooter?: boolean;
}

/**
 * Styled components for enhanced layout control
 */
const AuthContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  padding: theme.spacing(3),
  transition: 'padding 0.3s ease',

  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const MainContent = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  margin: 'auto',
  padding: theme.spacing(4, 0),
  position: 'relative',

  '& > *': {
    width: '100%',
    maxWidth: '480px',
    marginBottom: theme.spacing(3),
  },
}));

/**
 * Authentication layout component providing consistent structure for auth pages
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  maxWidth = '480px',
  showHeader = true,
  showFooter = true,
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Handle auth state changes
  useEffect(() => {
    // Update document title based on current auth page
    const pageName = location.pathname.split('/').pop();
    document.title = `${pageName?.charAt(0).toUpperCase()}${pageName?.slice(1)} | Memorable`;
  }, [location]);

  // Handle authenticated user redirection
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        role="status"
        aria-label="Loading authentication state"
      >
        <CircularProgress size={40} thickness={4} />
      </Box>
    );
  }

  return (
    <>
      {showHeader && <Header />}
      
      <AuthContainer
        component="main"
        role="main"
        aria-label="Authentication content"
      >
        <MainContent
          sx={{
            '& > *': {
              maxWidth,
            },
          }}
        >
          {children}
        </MainContent>
      </AuthContainer>

      {showFooter && (
        <Footer
          variant="minimal"
          showSocial={false}
          className="auth-footer"
        />
      )}
    </>
  );
};

export type { AuthLayoutProps };
export default AuthLayout;