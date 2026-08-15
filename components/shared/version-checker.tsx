'use client';

import { useEffect, useRef } from 'react';
import { useUIStore } from '../../lib/stores/uiStore';

export function VersionChecker() {
  const addToast = useUIStore((s) => s.addToast);
  const versionRef = useRef('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/version');
        const data = await res.json();
        const v = data.version || '';
        if (versionRef.current && versionRef.current !== v) {
          addToast('New version detected — reloading...', 'info');
          setTimeout(() => window.location.reload(), 3000);
        }
        versionRef.current = v;
      } catch {}
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [addToast]);

  return null;
}