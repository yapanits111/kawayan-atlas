"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback; defaults to a small "something went wrong" panel. */
  fallback?: ReactNode;
  label?: string;
}
interface State {
  hasError: boolean;
}

/** Catches render errors in a subtree (e.g. the react-three-fiber canvas) so one bad
 *  frame shows a recoverable message instead of blanking the whole page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ErrorBoundary caught:", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-bamboo-600">
        <div>
          <div className="font-medium text-clay-700">
            {this.props.label ?? "Something went wrong here."}
          </div>
          <button
            onClick={this.reset}
            className="mt-2 rounded-md border border-bamboo-300 bg-white px-3 py-1.5 text-xs font-medium text-bamboo-800 hover:bg-bamboo-100"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
