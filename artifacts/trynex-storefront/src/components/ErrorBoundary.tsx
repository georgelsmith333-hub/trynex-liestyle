import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? ` in ${this.props.section}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4 border border-orange-100">
          <span className="text-2xl" role="img" aria-label="warning">⚠️</span>
        </div>
        <p className="font-bold text-gray-800 mb-1">Something went wrong</p>
        <p className="text-sm text-gray-400 mb-4">
          {this.props.section ? `The ${this.props.section} section` : "This section"} couldn't load.
        </p>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          className="text-sm font-bold text-orange-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
        >
          Try again
        </button>
      </div>
    );
  }
}
