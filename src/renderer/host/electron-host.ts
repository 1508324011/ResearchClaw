import type { ElectronBridgeApi, ResearchClawHost } from '../../shared/platform/researchclaw-host';
import { createWebHost } from '../../web/host/web-host';

function getWindowControlsSupport(api: ElectronBridgeApi) {
  return Boolean(
    api.windowClose && api.windowMinimize && api.windowMaximize && api.windowIsMaximized,
  );
}

export function createElectronHost(api: ElectronBridgeApi): ResearchClawHost {
  const supportsWindowControls = getWindowControlsSupport(api);

  return {
    kind: 'electron',
    supportsNativeEvents: true,
    supportsWindowControls,
    invoke: <T>(channel: string, ...args: unknown[]) => api.invoke(channel, ...args) as Promise<T>,
    on: (channel: string, listener) => api.on(channel, listener),
    isMainReady: async () => {
      try {
        await api.invoke('ping');
        return true;
      } catch {
        return false;
      }
    },
    windowClose: async () => {
      await api.windowClose?.();
    },
    windowMinimize: async () => {
      await api.windowMinimize?.();
    },
    windowMaximize: async () => {
      await api.windowMaximize?.();
    },
    windowIsMaximized: async () => (await api.windowIsMaximized?.()) ?? false,
  };
}

export function getResearchClawHost(): ResearchClawHost {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return createWebHost();
  }

  return createElectronHost(window.electronAPI);
}
