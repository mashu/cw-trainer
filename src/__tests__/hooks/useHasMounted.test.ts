import { renderHook, waitFor } from '@testing-library/react';

import { useHasMounted } from '@/hooks/useHasMounted';

describe('useHasMounted', () => {
  it('becomes true after the client mount effect', async () => {
    const { result } = renderHook(() => useHasMounted());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
