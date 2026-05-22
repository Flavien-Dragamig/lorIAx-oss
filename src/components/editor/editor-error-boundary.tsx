"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import logger from "@/lib/logger";

interface Props {
  children: ReactNode;
  blockType?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ARCH-04 — Error boundary pour les blocs TipTap.
 * Capture les erreurs dans un bloc sans crasher tout l'éditeur.
 */
export class EditorBlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      {
        err: error,
        blockType: this.props.blockType,
        componentStack: errorInfo.componentStack,
      },
      `[EditorBlock] Erreur dans le bloc ${this.props.blockType || "inconnu"}`
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-3 p-4 my-2 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-destructive">
              Erreur dans le bloc {this.props.blockType || ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {this.state.error?.message || "Une erreur inattendue s'est produite"}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background border border-border hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
