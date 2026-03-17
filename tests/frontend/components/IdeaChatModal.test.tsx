import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, setupTest, mockIPCResponse, waitFor } from '../../support/render-utils';
import { IdeaChatModal } from '@/components/ideas/IdeaChatModal';
import {
  emitChatStatus,
  mockChatSessions,
  mockChatSessionDetail,
  setupChatMocks,
} from '../../support/chat-mock';

vi.mock('react-i18next', () => {
  const interpolate = (value: string, options?: Record<string, unknown>) =>
    value.replace(/{{(\w+)}}/g, (_, key: string) => String(options?.[key] ?? ''));

  const translations: Record<string, string> = {
    'chat.mode': 'Mode',
    'chat.backend.lightweight': '💬 Lightweight',
    'chat.backend.claude': '🤖 Claude Agent',
    'chat.backend.codex': '🤖 Codex',
    'chat.backend.gemini': '🤖 Gemini',
    'chat.backend.opencode': '🤖 OpenCode',
    'chat.history': 'History',
    'chat.newChat': 'New Chat',
    'chat.noHistory': 'No chat history yet',
    'chat.thinking': 'Thinking…',
    'chat.placeholder': 'Type a message…',
    'chat.sendHint': 'Press Enter to send, Shift+Enter for new line',
    'chat.sourcesSelected': '{{count}} source(s) selected',
    'chat.startConversation': 'Start a conversation',
    'chat.researchChatTitle': 'Research Chat',
    'chat.hideSidebar': 'Hide sidebar',
    'chat.showSidebar': 'Show sidebar',
    'chat.paperCount': '{{count}} paper(s)',
    'chat.moreCount': '+{{count}} more',
  };

  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) =>
        interpolate(translations[key] ?? key, options),
      i18n: { language: 'en' },
    }),
  };
});

describe('IdeaChatModal', () => {
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    projectId: 'project-1',
    projectWorkdir: '/test/project',
    paperIds: ['paper-1', 'paper-2'],
    repoIds: ['repo-1'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupChatMocks();
  });

  it('renders modal when open', async () => {
    render(<IdeaChatModal {...defaultProps} />);

    expect(await screen.findByRole('heading', { name: 'Research Chat' })).toBeInTheDocument();
    expect(screen.getAllByText('3 source(s) selected')).toHaveLength(2);
  });

  it('does not render when closed', () => {
    render(<IdeaChatModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('heading', { name: 'Research Chat' })).not.toBeInTheDocument();
  });

  it('shows empty conversation state for a new chat', async () => {
    render(<IdeaChatModal {...defaultProps} />);

    expect(await screen.findByText('Start a conversation')).toBeInTheDocument();
  });

  it('loads and displays chat sessions in the sidebar', async () => {
    render(<IdeaChatModal {...defaultProps} />);

    expect(await screen.findByText('History')).toBeInTheDocument();
    for (const session of mockChatSessions) {
      expect(await screen.findByText(session.title)).toBeInTheDocument();
    }
  });

  it('shows empty history state when there are no sessions', async () => {
    mockIPCResponse('acp-chat:session:list', []);

    render(<IdeaChatModal {...defaultProps} />);

    expect(await screen.findByText('No chat history yet')).toBeInTheDocument();
  });

  it('creates a new ACP session when clicking New Chat', async () => {
    const { user } = setupTest();
    render(<IdeaChatModal {...defaultProps} />);

    await user.click(await screen.findByTitle('New Chat'));

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
      'acp-chat:session:create',
      expect.objectContaining({
        projectId: 'project-1',
        title: 'New Chat',
        paperIds: ['paper-1', 'paper-2'],
        repoIds: ['repo-1'],
        cwd: '/test/project',
      }),
    );
  });

  it('loads session metadata when clicking a session', async () => {
    const { user } = setupTest();
    render(<IdeaChatModal {...defaultProps} />);

    await user.click(await screen.findByText(mockChatSessions[0].title));

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
      'acp-chat:session:get',
      mockChatSessions[0].id,
    );
    await waitFor(() => {
      expect(screen.getAllByText(mockChatSessionDetail.title).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('toggles sidebar visibility', async () => {
    const { user } = setupTest();
    render(<IdeaChatModal {...defaultProps} />);

    await user.click(await screen.findByTitle('Hide sidebar'));
    await waitFor(() => {
      expect(screen.queryByText('History')).not.toBeInTheDocument();
    });

    await user.click(await screen.findByTitle('Show sidebar'));
    expect(await screen.findByText('History')).toBeInTheDocument();
  });

  it('sends a message through ACP chat', async () => {
    const { user } = setupTest();
    render(<IdeaChatModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type a message…');
    await user.type(textarea, 'Hello ACP');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(window.electronAPI?.invoke.mock.calls).toEqual(
        expect.arrayContaining([
          ['acp-chat:generateTitle', 'Hello ACP'],
          [
            'acp-chat:send',
            expect.objectContaining({
              projectId: 'project-1',
              prompt: 'Hello ACP',
              paperIds: ['paper-1', 'paper-2'],
              repoIds: ['repo-1'],
              language: 'en',
            }),
          ],
        ]),
      );
    });
  });

  it('shows thinking state and allows stopping the active job', async () => {
    const { user } = setupTest();
    render(<IdeaChatModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type a message…');
    await user.type(textarea, 'Hello ACP');
    await user.keyboard('{Enter}');

    emitChatStatus('running');
    expect(await screen.findByText((content) => content.includes('Thinking'))).toBeInTheDocument();

    const stopButton = document.querySelector('.bg-red-500');
    expect(stopButton).toBeInTheDocument();
    await user.click(stopButton as HTMLElement);

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith('acp-chat:kill', 'test-job-id');
  });

  it('closes on escape', async () => {
    const { user } = setupTest();
    render(<IdeaChatModal {...defaultProps} />);

    await user.keyboard('{Escape}');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
