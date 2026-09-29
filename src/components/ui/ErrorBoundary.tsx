import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryState {
  failed: boolean
}

/**
 * Last line of defence: a render error anywhere used to unmount the whole
 * tree and leave the customer on a blank dark page with no way forward.
 * This shows a sentence and a reload button instead.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4 text-text">
        <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
          <h1 className="font-display text-[22px] font-bold">Something went wrong</h1>
          <p className="text-[14px] leading-[1.6] text-muted">
            This page hit an unexpected error. Reloading usually fixes it — nothing
            you entered on your exchange was affected.
          </p>
          <button
            type="button"
            className="rounded-btn bg-accent px-5 py-2.5 text-[14px] font-bold text-bg"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      </div>
    )
  }
}
