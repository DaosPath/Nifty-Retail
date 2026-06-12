import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary card-glass">
          <h3>{this.props.title || "Error en la pantalla"}</h3>
          <p>No se pudo cargar esta sección. Detalle técnico:</p>
          <code>{this.state.error.message}</code>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => this.setState({ error: null })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}