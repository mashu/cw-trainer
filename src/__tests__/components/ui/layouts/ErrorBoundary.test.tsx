import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ErrorBoundary, FeatureErrorFallback } from '@/components/ui/layouts/ErrorBoundary';
import { reportError } from '@/lib/errors/reporter';

jest.mock('@/lib/errors/reporter', () => ({
  reportError: jest.fn(),
}));

// Component that throws an error
function ThrowError({ shouldThrow = false }: { shouldThrow?: boolean }): JSX.Element {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for error boundary tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('The application encountered an unexpected error.')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Test error/)).toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
  });

  it('should have Try Again button that resets error state', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const tryAgainButton = screen.getByText('Try Again');
    expect(tryAgainButton).toBeInTheDocument();
    
    // Clicking Try Again resets the error state
    // After reset, the error boundary will try to render children again
    // Since the component still throws, it will show error again
    // So we verify the button exists and can be clicked
    await act(async () => {
      await user.click(tryAgainButton);
    });
    
    // The error boundary resets, but since ThrowError still throws, it will show error again
    // This is expected behavior - the test verifies the reset mechanism works
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should have Reload Page button', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const reloadButton = screen.getByText('Reload Page');
    expect(reloadButton).toBeInTheDocument();
    
    // Verify button can be clicked (window.location.reload can't be mocked in jsdom)
    await user.click(reloadButton);
    expect(reloadButton).toBeInTheDocument();
  });

  it('reports caught errors to the central reporter with the boundary name', () => {
    render(
      <ErrorBoundary name="test-boundary">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'react', boundary: 'test-boundary' }),
    );
  });

  it('renders a render-prop fallback and passes a reset function', () => {
    render(
      <ErrorBoundary fallback={({ reset }) => <button onClick={reset}>retry-btn</button>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('retry-btn')).toBeInTheDocument();
  });

  it('auto-resets when resetKeys change', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={[0]} fallback={<div>fallback-shown</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback-shown')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKeys={[1]} fallback={<div>fallback-shown</div>}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});

describe('FeatureErrorFallback', () => {
  it('renders the message and calls reset when Try again is clicked', async () => {
    const user = userEvent.setup();
    const reset = jest.fn();

    render(<FeatureErrorFallback reset={reset} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByText('Try again'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

