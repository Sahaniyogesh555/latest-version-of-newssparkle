import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Route-level error boundary.
 *
 * Without one, a single render error (e.g. an undefined component reference)
 * unmounts the entire React tree and the reader gets a blank white page — which
 * is exactly what happened on every article URL before this was added.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this in the console so hosting-provider log capture still sees it.
    console.error("[NewsSparkle] Render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full card-base p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="p-3 bg-primary/10 rounded-full">
              <AlertTriangle className="size-7 text-primary" />
            </div>
          </div>
          <div className="kicker text-primary mb-3">Something went wrong</div>
          <h1 className="headline-lg mb-3">This story hit a snag</h1>
          <p className="text-foreground/70 leading-relaxed mb-6">
            We could not load this page. It has been logged and the newsroom has been notified —
            please try again, or head back to the front page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => {
                this.reset();
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
            <Link
              to="/"
              onClick={this.reset}
              className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
            >
              Back to homepage
            </Link>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-6 text-left text-xs bg-muted/60 rounded-lg p-3 overflow-auto max-h-48">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
