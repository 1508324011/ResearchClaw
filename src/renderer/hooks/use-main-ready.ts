import { useEffect, useState } from 'react';
import { getResearchClawHost } from '../host/electron-host';

/**
 * Hook to check if the main process is ready to handle IPC calls.
 * Returns true once the main process sends 'main:ready' event.
 */
export function useMainReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const host = getResearchClawHost();
    if (host.kind !== 'electron') {
      setIsReady(true);
      return;
    }

    let isDisposed = false;

    const unsubscribe = host.on('main:ready', () => {
      if (!isDisposed) {
        setIsReady(true);
      }
    });

    void host.isMainReady().then((ready) => {
      if (!isDisposed && ready) {
        setIsReady(true);
      }
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, []);

  return isReady;
}
