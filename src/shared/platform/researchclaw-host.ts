export type HostListener = (...args: unknown[]) => void;

export interface ElectronBridgeApi {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: HostListener) => () => void;
  off: (channel: string, listener: HostListener) => void;
  once: (channel: string, listener: HostListener) => void;
  readLocalFile: (path: string) => Promise<string>;
  windowClose?: () => Promise<void>;
  windowMinimize?: () => Promise<void>;
  windowMaximize?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
}

export interface ResearchClawHost {
  kind: 'electron' | 'web';
  supportsNativeEvents: boolean;
  supportsWindowControls: boolean;
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
  on: (channel: string, listener: HostListener) => () => void;
  isMainReady: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
}
