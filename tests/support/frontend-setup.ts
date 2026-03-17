/**
 * Setup file for frontend component tests
 * Runs before each test file
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock electronAPI globally for all component tests
declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
      once: (channel: string, listener: (...args: unknown[]) => void) => void;
      readLocalFile: (path: string) => Promise<string>;
      windowClose: () => Promise<void>;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
    };
  }
}

// Store for mock overrides set by mockIPCResponse
const mockOverrides: Map<string, unknown> = new Map();

// Default mock responses
const defaultMocks: Record<string, unknown> = {
  'papers:list': [],
  'projects:list': [],
  'providers:list': [],
  'agent-todo:list-agents': [],
  'agents:list': [],
  'window:isMaximized': false,
};

// Mock implementation function - defined outside to keep reference stable
function mockInvokeImplementation(channel: string, ...args: unknown[]): Promise<unknown> {
  // Check for test-specific overrides first
  if (mockOverrides.has(channel)) {
    const override = mockOverrides.get(channel);
    // Handle promises in overrides
    if (override instanceof Promise) {
      return override;
    }
    return Promise.resolve(override);
  }
  // Return default mock or null
  return Promise.resolve(defaultMocks[channel] ?? null);
}

// Create mock electronAPI with stable references
const mockElectronAPI = {
  invoke: vi.fn(mockInvokeImplementation),
  on: vi.fn(() => () => {}),
  off: vi.fn(),
  once: vi.fn(),
  readLocalFile: vi.fn(() => Promise.resolve('')),
  windowClose: vi.fn(() => Promise.resolve()),
  windowMinimize: vi.fn(() => Promise.resolve()),
  windowMaximize: vi.fn(() => Promise.resolve()),
  windowIsMaximized: vi.fn(() => Promise.resolve(false)),
};

// Helper to set mock overrides (used by mockIPCResponse)
export function setMockOverride(channel: string, response: unknown) {
  mockOverrides.set(channel, response);
}

// Helper to clear mock overrides
export function clearMockOverrides() {
  mockOverrides.clear();
}

// Attach to window before each test
beforeEach(() => {
  // Clear overrides first
  clearMockOverrides();
  // Reset mock call history but keep implementations
  vi.clearAllMocks();
  // Ensure window.electronAPI is set
  window.electronAPI = mockElectronAPI;
});

afterEach(() => {
  // Clean up any mounted components
  document.body.innerHTML = '';
});

// Export for test usage
export { mockElectronAPI };
