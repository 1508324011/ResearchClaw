import { afterEach, describe, expect, it, vi } from 'vitest';

import { getResearchClawHost, createElectronHost } from '../../src/renderer/host/electron-host';
import { createWebHost } from '../../src/web/host/web-host';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('researchclaw-host', () => {
  it('exposes a browser-safe web host when no preload bridge exists', async () => {
    const host = createWebHost();

    expect(host.kind).toBe('web');
    expect(host.supportsNativeEvents).toBe(false);
    expect(host.supportsWindowControls).toBe(false);
    await expect(host.isMainReady()).resolves.toBe(true);
    await expect(host.windowIsMaximized()).resolves.toBe(false);
    await expect(host.windowClose()).resolves.toBeUndefined();

    const unsubscribe = host.on('main:ready', vi.fn());
    unsubscribe();

    await expect(host.invoke('papers:list')).rejects.toThrow('Electron preload API not found');
  });

  it('adapts an Electron preload bridge into the shared host contract', async () => {
    const unsubscribe = vi.fn();
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'ping') {
        return { success: true, data: 'pong' };
      }

      return { success: true, data: null };
    });
    const on = vi.fn(() => unsubscribe);
    const windowClose = vi.fn(async () => undefined);
    const windowMinimize = vi.fn(async () => undefined);
    const windowMaximize = vi.fn(async () => undefined);
    const windowIsMaximized = vi.fn(async () => true);

    const host = createElectronHost({
      invoke,
      on,
      off: vi.fn(),
      once: vi.fn(),
      readLocalFile: vi.fn(),
      windowClose,
      windowMinimize,
      windowMaximize,
      windowIsMaximized,
    });

    expect(host.kind).toBe('electron');
    expect(host.supportsNativeEvents).toBe(true);
    expect(host.supportsWindowControls).toBe(true);
    await expect(host.isMainReady()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('ping');
    expect(host.on('main:ready', vi.fn())).toBe(unsubscribe);

    await host.windowMinimize();
    await host.windowMaximize();
    await host.windowClose();
    await expect(host.windowIsMaximized()).resolves.toBe(true);

    expect(windowMinimize).toHaveBeenCalledTimes(1);
    expect(windowMaximize).toHaveBeenCalledTimes(1);
    expect(windowClose).toHaveBeenCalledTimes(1);
    expect(windowIsMaximized).toHaveBeenCalledTimes(1);
  });

  it('falls back to the web host when the global preload bridge is missing', () => {
    vi.stubGlobal('window', {});

    const host = getResearchClawHost();

    expect(host.kind).toBe('web');
    expect(host.supportsNativeEvents).toBe(false);
  });
});
