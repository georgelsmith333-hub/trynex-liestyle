import { Component, type ReactNode, type ErrorInfo } from "react";
import { nukeAndReload } from "@/lib/cache-recovery";

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null; recovering: boolean }

const CHUNK_ERROR_RX = /loading chunk|dynamically imported module|importing a module script/i;

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, recovering: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info.componentStack);

    // Auto-recover from chunk-load errors: the most common cause is a stale
    // index.html (cached by an old SW) referencing chunks that no longer
    // exist on the server.
    if (CHUNK_ERROR_RX.test(error?.message || "")) {
      this.setState({ recovering: true });
      void nukeAndReload(`AppErrorBoundary: ${error.message.slice(0, 120)}`);
    }
  }

  private handleRefresh = () => {
    this.setState({ recovering: true });
    void nukeAndReload("user clicked refresh");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
        style={{ background: "linear-gradient(135deg, #FFF8F3 0%, #FFF4EE 100%)" }}>
        <div className="w-20 h-20 rounded-3xl bg-white border border-orange-100 flex items-center justify-center mb-6 shadow-md">
          <span className="text-3xl" role="img" aria-label="warning">⚠️</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          {this.state.recovering
            ? "Refreshing to get the latest version…"
            : "We hit an unexpected error. This usually means your browser cached an old version of the app. Tap Refresh to load the latest one."}
        </p>
        <button
          onClick={this.handleRefresh}
          disabled={this.state.recovering}
          className="px-6 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #E85D04, #FB8500)",
            boxShadow: "0 6px 24px rgba(232,93,4,0.3)",
          }}
        >
          {this.state.recovering ? "Refreshing…" : "Refresh app"}
        </button>
        <p className="text-xs text-gray-400 mt-6 max-w-xs">
          If this keeps happening, please contact support at <a className="font-bold text-orange-600 hover:underline" href="https://wa.me/8801XXXXXXXXX">WhatsApp</a>.
        </p>
      </div>
    );
  }
}
