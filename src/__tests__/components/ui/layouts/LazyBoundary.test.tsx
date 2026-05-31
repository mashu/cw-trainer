import { render, screen } from '@testing-library/react';
import React from 'react';

import { LazyBoundary } from '@/components/ui/layouts/LazyBoundary';

jest.mock('@/lib/errors/reporter', () => ({
  reportError: jest.fn(),
}));

describe('LazyBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders eager children directly', () => {
    render(
      <LazyBoundary>
        <div>eager-child</div>
      </LazyBoundary>,
    );
    expect(screen.getByText('eager-child')).toBeInTheDocument();
  });

  it('shows the loading fallback, then the resolved lazy content', async () => {
    const Resolved = React.lazy(() =>
      Promise.resolve({ default: (): JSX.Element => <div>lazy-loaded</div> }),
    );

    render(
      <LazyBoundary fallback={<div>loading-now</div>}>
        <Resolved />
      </LazyBoundary>,
    );

    expect(screen.getByText('loading-now')).toBeInTheDocument();
    expect(await screen.findByText('lazy-loaded')).toBeInTheDocument();
  });

  it('shows the error fallback (retry + reload) when the chunk fails to load', async () => {
    const Rejected = React.lazy(() =>
      Promise.reject<{ default: React.ComponentType }>(new Error('chunk fail')),
    );

    render(
      <LazyBoundary name="lazy:test">
        <Rejected />
      </LazyBoundary>,
    );

    expect(await screen.findByText('This section failed to load')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByText('Reload')).toBeInTheDocument();
  });
});
