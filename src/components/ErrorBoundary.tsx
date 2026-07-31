import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk');
    return { hasError: true, error, isChunkError };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">
            {this.state.isChunkError ? 'تحديث متاح' : 'حدث خطأ غير متوقع'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {this.state.isChunkError
              ? 'يوجد تحديث جديد للتطبيق. يرجى إعادة تحميل الصفحة.'
              : 'حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" /> إعادة تحميل
            </Button>
            {!this.state.isChunkError && (
              <Button variant="outline" onClick={this.handleRetry}>
                إعادة المحاولة
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
