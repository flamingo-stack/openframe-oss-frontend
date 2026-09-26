'use client';

import { useEffect, useRef } from 'react';

/**
 * True while the component is mounted. react-relay never cancels a mutation when its page unmounts,
 * so a late callback reads this before it navigates or reports into a page the user has left.
 */
export function useMountedRef() {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}
