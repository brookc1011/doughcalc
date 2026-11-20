import { Component, type ReactNode } from 'react';

/**
 * If a screen crashes, show a plain message with a way back instead of a blank page.
 * Bake data lives in the phone's storage, so reloading loses nothing that was saved.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="pad" role="alert">
        <h1>Something went wrong</h1>
        <p>This screen hit a problem. Your saved bakes are safe on this phone.</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload the app
        </button>
      </div>
    );
  }
}
