import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

function checkIsChunkError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  const name = error.name || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('dynamically imported module') ||
    name === 'ChunkLoadError'
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      isChunkError: checkIsChunkError(error)
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
    
    // Auto-heal stale bundle references when new code is published
    if (checkIsChunkError(error)) {
      const lastReload = sessionStorage.getItem('smileclinic_eb_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('smileclinic_eb_chunk_reload', String(now));
        console.warn('[ErrorBoundary] Auto-reloading to synchronize latest app version...');
        window.location.reload();
      }
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, isChunkError: false });
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunk = this.state.isChunkError;

      return (
        <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm border ${
            isChunk
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
          }`}>
            <span className="material-symbols-outlined text-[32px]">
              {isChunk ? 'sync' : 'error_outline'}
            </span>
          </div>

          <h2 className="text-xl font-bold text-on-surface mb-2">
            {isChunk ? 'New Version Available' : (this.props.fallbackTitle || 'Unable to load clinical view')}
          </h2>

          <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
            {isChunk
              ? 'A newer version of the clinical portal was deployed. Your active session remains authenticated. Tap below to reload the latest security rules and clinical screens.'
              : 'A temporary client exception occurred while rendering this module. Your safety session remains authenticated.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null, isChunkError: false });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>{isChunk ? 'Update & Reload App' : 'Reload Screen'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null, isChunkError: false });
                window.location.href = '/dashboard';
              }}
              className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>

          {this.state.error && !isChunk && (
            <pre className="mt-6 p-3 rounded-lg bg-surface-container-lowest border border-surface-container-high text-[11px] text-rose-600 font-mono text-left max-w-lg overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
