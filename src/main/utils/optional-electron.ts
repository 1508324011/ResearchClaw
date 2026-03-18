type BrowserWindowLike = {
  webContents: {
    send: (...args: unknown[]) => void;
  };
};

type ElectronModuleLike = {
  BrowserWindow?: {
    getAllWindows?: () => BrowserWindowLike[];
  };
};

let cachedElectronModule: ElectronModuleLike | null | undefined;

function isOptionalElectronLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('Electron failed to install correctly') ||
    error.message.includes("Cannot find module 'electron'")
  );
}

export function loadOptionalElectron(): ElectronModuleLike | null {
  if (cachedElectronModule !== undefined) {
    return cachedElectronModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedElectronModule = require('electron') as ElectronModuleLike;
  } catch (error) {
    if (!isOptionalElectronLoadError(error)) {
      throw error;
    }

    cachedElectronModule = null;
  }

  return cachedElectronModule;
}

export function getOptionalBrowserWindows(): BrowserWindowLike[] {
  return loadOptionalElectron()?.BrowserWindow?.getAllWindows?.() ?? [];
}
