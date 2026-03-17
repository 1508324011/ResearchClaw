import { vi } from 'vitest';
import { mockIPCResponse } from './render-utils';

type IpcListener = (...args: unknown[]) => void;

const listeners = new Map<string, IpcListener[]>();

function registerListener(channel: string, handler: IpcListener) {
  const channelListeners = listeners.get(channel) ?? [];
  channelListeners.push(handler);
  listeners.set(channel, channelListeners);

  return () => {
    const nextListeners = (listeners.get(channel) ?? []).filter((item) => item !== handler);
    listeners.set(channel, nextListeners);
  };
}

function emit(channel: string, payload: unknown) {
  for (const listener of listeners.get(channel) ?? []) {
    listener(undefined, payload);
  }
}

export const mockChatSessions = [
  {
    id: 'session-1',
    projectId: 'project-1',
    title: 'Neural Network Research',
    paperIdsJson: JSON.stringify(['paper-1', 'paper-2']),
    repoIdsJson: JSON.stringify(['repo-1']),
    backend: null,
    cwd: '/test/project',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'session-2',
    projectId: 'project-1',
    title: 'Paper Analysis Discussion',
    paperIdsJson: JSON.stringify(['paper-3']),
    repoIdsJson: JSON.stringify([]),
    backend: 'claude-code',
    cwd: '/test/project',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const mockChatSessionDetail = {
  id: 'session-1',
  projectId: 'project-1',
  title: 'Neural Network Research',
  paperIds: ['paper-1', 'paper-2'],
  repoIds: ['repo-1'],
  backend: 'claude-code',
  cwd: '/test/project',
  createdAt: new Date(Date.now() - 86400000).toISOString(),
  updatedAt: new Date(Date.now() - 3600000).toISOString(),
};

export function setupChatMocks() {
  listeners.clear();

  mockIPCResponse('acp-chat:session:list', mockChatSessions);
  mockIPCResponse('acp-chat:session:create', {
    id: 'new-session-id',
    projectId: 'project-1',
    title: 'New Chat',
    paperIdsJson: JSON.stringify(['paper-1', 'paper-2']),
    repoIdsJson: JSON.stringify(['repo-1']),
    backend: null,
    cwd: '/test/project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  mockIPCResponse('acp-chat:session:get', mockChatSessionDetail);
  mockIPCResponse('acp-chat:session:updateTitle', undefined);
  mockIPCResponse('acp-chat:session:updateBackend', undefined);
  mockIPCResponse('acp-chat:session:delete', undefined);
  mockIPCResponse('acp-chat:generateTitle', 'Generated Chat Title');
  mockIPCResponse('acp-chat:send', { jobId: 'test-job-id' });
  mockIPCResponse('acp-chat:kill', undefined);
  mockIPCResponse('papers:getById', {
    id: 'paper-1',
    title: 'Attention Is All You Need',
  });

  const mockElectronAPI = window.electronAPI as { on: ReturnType<typeof vi.fn> } | undefined;
  mockElectronAPI?.on.mockImplementation((channel: string, handler: IpcListener) =>
    registerListener(channel, handler),
  );
}

export function emitChatStatus(status: string, jobId = 'test-job-id') {
  emit('acp-chat:status', { jobId, status });
}

export function emitChatError(error: string, jobId = 'test-job-id') {
  emit('acp-chat:error', { jobId, error });
}

export function emitChatStream(text: string, jobId = 'test-job-id', msgId = 'assistant-1') {
  emit('acp-chat:stream', {
    jobId,
    message: {
      id: `${msgId}-event`,
      msgId,
      type: 'text',
      role: 'assistant',
      content: { text },
      createdAt: new Date().toISOString(),
    },
  });
}
