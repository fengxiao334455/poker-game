import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1a1a2e',
          color: '#ecf0f1',
          padding: 20,
          textAlign: 'center',
        }}>
          <h2 style={{ color: '#e74c3c', marginBottom: 16 }}>Something went wrong</h2>
          <p style={{ color: '#bdc3c7', marginBottom: 12, maxWidth: 500 }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#ffd700',
              color: '#000',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
