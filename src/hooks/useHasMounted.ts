
import { useEffect, useState } from 'react';

/**
 * Returns true only after the component has mounted on the client.
 * Use this to avoid hydration mismatch when rendering locale-dependent content
 * (e.g. dates): render a stable format (e.g. ISO) until mounted, then use the
 * user's locale (toLocaleString(), toLocaleDateString() with no locale argument).
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
