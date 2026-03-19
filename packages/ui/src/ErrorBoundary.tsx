import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Like Cake] UI Error:', error, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-white">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-sm text-gray-500 mb-4 text-center max-w-sm">
            예상치 못한 오류가 발생했습니다. 다시 시도해주세요.
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4 max-w-sm overflow-auto max-h-24">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
