import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorScreen from './ErrorScreen';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    const msg = error?.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError'
    ) {
      const now = Date.now();
      const lastReload = sessionStorage.getItem('chunk_error_reload_time');
      // Limit automatic reload to once every 15 seconds to prevent inf loops if they are offline
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('chunk_error_reload_time', now.toString());
        console.warn('Chunk load error intercepted. Auto-reloading to fetch fresh deployed assets...');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen 
          error={this.state.error || undefined} 
          resetErrorBoundary={() => {
            // Under any crash, a full reload is the safest and most reliable recovery action
            window.location.reload();
          }} 
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
