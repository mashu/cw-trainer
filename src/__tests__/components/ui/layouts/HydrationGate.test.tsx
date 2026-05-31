import { render, screen } from '@testing-library/react';
import React from 'react';

import { HydrationGate } from '@/components/ui/layouts/HydrationGate';
import { useHasMounted } from '@/hooks/useHasMounted';

jest.mock('@/hooks/useHasMounted', () => ({
  useHasMounted: jest.fn(),
}));

const mockUseHasMounted = useHasMounted as jest.Mock;

describe('HydrationGate', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders the fallback before mount', () => {
    mockUseHasMounted.mockReturnValue(false);

    render(
      <HydrationGate fallback={<div>skeleton</div>}>
        <div>app-content</div>
      </HydrationGate>,
    );

    expect(screen.getByText('skeleton')).toBeInTheDocument();
    expect(screen.queryByText('app-content')).not.toBeInTheDocument();
  });

  it('renders children after mount', () => {
    mockUseHasMounted.mockReturnValue(true);

    render(
      <HydrationGate fallback={<div>skeleton</div>}>
        <div>app-content</div>
      </HydrationGate>,
    );

    expect(screen.getByText('app-content')).toBeInTheDocument();
    expect(screen.queryByText('skeleton')).not.toBeInTheDocument();
  });
});
