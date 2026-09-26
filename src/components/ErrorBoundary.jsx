import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch() {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({
      error: new Error('Caught error'),
      errorInfo: { componentStack: 'Error boundary caught an error' }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-4">
              <AlertTriangle className="w-7 h-7 text-destructive" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">خطای برنامه</h1>
            <p className="text-muted-foreground mb-6">
              یک خطای غیرمنتظره رخ داد. لطفاً صفحه را مجدداً بارگذاری کنید.
            </p>
            <pre className="bg-muted p-4 rounded-lg text-left text-sm text-red-500 overflow-auto max-h-60 mb-6">
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              بارگذاری مجدد
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;