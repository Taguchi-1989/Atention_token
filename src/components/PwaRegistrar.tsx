'use client';

import { useEffect } from 'react';

export default function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {
      // HTTPSでないLANアクセスなど、登録できない環境では通常のWeb版として継続する。
    });
  }, []);

  return null;
}
