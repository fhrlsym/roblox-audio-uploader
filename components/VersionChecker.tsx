'use client';

import { useEffect, useRef } from 'react';
import { useToast } from './Toast';

export default function VersionChecker() {
  const { toast } = useToast();
  const currentVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const serverVersion = data.version;

        if (currentVersionRef.current === null) {
          currentVersionRef.current = serverVersion;
        } else if (currentVersionRef.current !== serverVersion) {
          toast('Pembaruan sistem baru tersedia! Memperbarui halaman dalam 3 detik...', 'info');
          currentVersionRef.current = serverVersion;
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch {
        // ignore
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 30000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
