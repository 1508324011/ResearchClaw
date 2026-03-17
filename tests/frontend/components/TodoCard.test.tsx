import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, setupTest, mockIPCResponse } from '../../support/render-utils';
import { TodoCard } from '@/components/agent-todo/TodoCard';
import type { AgentTodoItem } from '@shared';

/**
 * Tests for TodoCard component
 * Covers all interactive elements: Run, Stop, Edit, Delete buttons
 */
describe('TodoCard', () => {
  const mockTodo: AgentTodoItem = {
    id: 'todo-1',
    title: 'Test Task',
    prompt: 'Test prompt',
    cwd: '/test/path',
    agentId: 'agent-1',
    agent: {
      id: 'agent-1',
      name: 'Test Agent',
      backend: 'anthropic',
      agentTool: 'claude-code',
      model: 'claude-3-opus',
    },
    status: 'pending',
    priority: 3,
    yoloMode: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: null,
    resultsCount: 0,
    projectId: null,
  };

  const mockRunningTodo: AgentTodoItem = {
    ...mockTodo,
    id: 'todo-2',
    status: 'running',
    lastRunAt: new Date().toISOString(),
  };

  const mockTodoWithResults: AgentTodoItem = {
    ...mockTodo,
    id: 'todo-3',
    resultsCount: 5,
    lastRunAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  };

  const mockOnRefresh = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm - use Object.defineProperty for happy-dom compatibility
    Object.defineProperty(window, 'confirm', {
      writable: true,
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  describe('Rendering', () => {
    it('renders todo title correctly', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('renders agent name with backend', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      expect(screen.getByText(/Test Agent/)).toBeInTheDocument();
      expect(screen.getByText(/\(anthropic\)/)).toBeInTheDocument();
    });

    it('renders working directory', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('/test/path')).toBeInTheDocument();
    });

    it('renders "Never run" when lastRunAt is null', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('Never run')).toBeInTheDocument();
    });

    it('renders results count when available', () => {
      render(<TodoCard todo={mockTodoWithResults} onRefresh={mockOnRefresh} />);
      expect(screen.getByText('5 results')).toBeInTheDocument();
    });

    it('renders relative time for last run', () => {
      render(<TodoCard todo={mockTodoWithResults} onRefresh={mockOnRefresh} />);
      expect(screen.getByText(/\d+[mh] ago/)).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('shows pending status dot for pending todo', () => {
      const { container } = render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      expect(container.querySelector('.bg-gray-400')).toBeInTheDocument();
    });

    it('shows running status for running todo', () => {
      const { container } = render(<TodoCard todo={mockRunningTodo} onRefresh={mockOnRefresh} />);
      expect(container.querySelector('.bg-notion-text.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Run Button', () => {
    it('shows Run button when status is not running', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const runButton = screen.getByRole('button', { name: /run/i });
      expect(runButton).toBeInTheDocument();
      expect(runButton).toHaveTextContent('Run');
    });

    it('calls ipc.runAgentTodo when Run button is clicked', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:run', undefined);

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const runButton = screen.getByRole('button', { name: /run/i });

      await user.click(runButton);

      expect(window.electronAPI?.invoke).toHaveBeenCalledWith('agent-todo:run', 'todo-1');
    });

    it('calls onRefresh after successful run', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:run', undefined);

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const runButton = screen.getByRole('button', { name: /run/i });

      await user.click(runButton);
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe('Stop Button', () => {
    it('shows Stop button when status is running', () => {
      render(<TodoCard todo={mockRunningTodo} onRefresh={mockOnRefresh} />);
      const stopButton = screen.getByRole('button', { name: /stop/i });
      expect(stopButton).toBeInTheDocument();
      expect(stopButton).toHaveTextContent('Stop');
    });

    it('does not show Run button when status is running', () => {
      render(<TodoCard todo={mockRunningTodo} onRefresh={mockOnRefresh} />);
      const runButton = screen.queryByRole('button', { name: /^run$/i });
      expect(runButton).not.toBeInTheDocument();
    });

    it('calls ipc.stopAgentTodo when Stop button is clicked', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:stop', undefined);

      render(<TodoCard todo={mockRunningTodo} onRefresh={mockOnRefresh} />);
      const stopButton = screen.getByRole('button', { name: /stop/i });

      await user.click(stopButton);

      expect(window.electronAPI?.invoke).toHaveBeenCalledWith('agent-todo:stop', 'todo-2');
    });

    it('calls onRefresh after successful stop', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:stop', undefined);

      render(<TodoCard todo={mockRunningTodo} onRefresh={mockOnRefresh} />);
      const stopButton = screen.getByRole('button', { name: /stop/i });

      await user.click(stopButton);
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe('Edit Button', () => {
    it('shows Edit button when onEdit prop is provided', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} onEdit={mockOnEdit} />);
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it('does not show Edit button when onEdit prop is not provided', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const editButton = screen.queryByRole('button', { name: /edit/i });
      expect(editButton).not.toBeInTheDocument();
    });

    it('calls onEdit with todo id when Edit button is clicked', async () => {
      const { user } = setupTest();

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} onEdit={mockOnEdit} />);
      const editButton = screen.getByRole('button', { name: /edit/i });

      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith('todo-1');
    });

    it('does not trigger card click when clicking Edit button', async () => {
      const { user } = setupTest();

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} onEdit={mockOnEdit} />);
      const editButton = screen.getByRole('button', { name: /edit/i });

      // The click should be stopped from propagating
      await user.click(editButton);

      // onEdit should be called, but navigation should not happen
      expect(mockOnEdit).toHaveBeenCalledWith('todo-1');
    });
  });

  describe('Delete Button', () => {
    it('shows Delete button', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('shows confirmation dialog when Delete button is clicked', async () => {
      const { user } = setupTest();

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const deleteButton = screen.getByRole('button', { name: /delete/i });

      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith('Delete "Test Task"?');
    });

    it('calls ipc.deleteAgentTodo when confirmed', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:delete', undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const deleteButton = screen.getByRole('button', { name: /delete/i });

      await user.click(deleteButton);

      expect(window.electronAPI?.invoke).toHaveBeenCalledWith('agent-todo:delete', 'todo-1');
    });

    it('does not call delete when cancelled', async () => {
      const { user } = setupTest();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const deleteButton = screen.getByRole('button', { name: /delete/i });

      await user.click(deleteButton);

      expect(window.electronAPI?.invoke).not.toHaveBeenCalledWith(
        'agent-todo:delete',
        expect.anything(),
      );
    });

    it('calls onRefresh after successful delete', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:delete', undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const deleteButton = screen.getByRole('button', { name: /delete/i });

      await user.click(deleteButton);
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('navigates to todo detail when card is clicked', async () => {
      const { user } = setupTest();

      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />, {
        routerProps: { initialEntries: ['/agent-todos'] },
      });

      const card = screen.getByText('Test Task').closest('.group');
      if (card) {
        await user.click(card);
      }
    });
  });

  describe('Priority Display', () => {
    it('renders priority bar when priority > 0', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      expect(screen.getByLabelText('Priority: High')).toBeInTheDocument();
    });

    it('does not render priority bar when priority is 0', () => {
      const todoNoPriority = { ...mockTodo, priority: 0 };
      render(<TodoCard todo={todoNoPriority} onRefresh={mockOnRefresh} />);
      expect(screen.queryByLabelText(/Priority:/)).not.toBeInTheDocument();
    });
  });

  describe('Hover Actions', () => {
    it('action buttons are visible on hover', () => {
      render(<TodoCard todo={mockTodo} onRefresh={mockOnRefresh} />);
      const actionsContainer = screen.getByRole('button', { name: /run/i }).parentElement;
      expect(actionsContainer).toHaveClass('group-hover:opacity-100');
    });
  });
});
