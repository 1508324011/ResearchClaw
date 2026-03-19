import type { ResearchClawHost } from '../../shared/platform/researchclaw-host';

const PRELOAD_MISSING_MESSAGE = 'Electron preload API not found.';

export function createWebHost(): ResearchClawHost {
  return {
    kind: 'web',
    supportsNativeEvents: false,
    supportsWindowControls: false,
    invoke: async () => Promise.reject(new Error(PRELOAD_MISSING_MESSAGE)),
    on: () => () => undefined,
    isMainReady: async () => true,
    windowClose: async () => undefined,
    windowMinimize: async () => undefined,
    windowMaximize: async () => undefined,
    windowIsMaximized: async () => false,
  };
}
