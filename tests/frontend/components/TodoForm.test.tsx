import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, setupTest, mockIPCResponse, waitFor } from '../../support/render-utils';
import { TodoForm } from '@/components/agent-todo/TodoForm';

/**
 * Tests for TodoForm component
 * Covers form rendering, validation, submission, and all interactive elements
 */
describe('TodoForm', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock IPC responses
    mockIPCResponse('projects:list', []);
    mockIPCResponse('agent-todo:list-agents', [
      {
        id: 'agent-1',
        name: 'Test Agent',
        backend: 'anthropic',
        agentTool: 'claude-code',
        model: 'claude-3-opus',
        enabled: true,
      },
    ]);
    mockIPCResponse('agent-todo:create', { id: 'new-todo-id' });
    mockIPCResponse('agent-todo:update', { success: true });
  });

  describe('Rendering', () => {
    it('renders new task form when no editId', () => {
      render(<TodoForm {...defaultProps} />);
      expect(screen.getByText('New Agent Task')).toBeInTheDocument();
    });

    it('renders edit task form when editId provided', () => {
      render(<TodoForm {...defaultProps} editId="todo-1" />);
      expect(screen.getByText('Edit Agent Task')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<TodoForm {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('New Agent Task')).not.toBeInTheDocument();
    });

    it('renders all form fields', async () => {
      render(<TodoForm {...defaultProps} />);
      // Use placeholder text instead of label text for more reliable querying
      expect(screen.getByPlaceholderText('e.g. Refactor PDF parser module')).toBeInTheDocument();
      expect(screen.getByText('Working Directory')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Describe what the agent should do...'),
      ).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('calls onClose when X button clicked', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      // Find the X button by looking for the close button (first button in the header)
      const buttons = screen.getAllByRole('button');
      const xButton = buttons.find((btn) => btn.querySelector('svg') && !btn.textContent?.trim());

      if (xButton) {
        await user.click(xButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('Form Input Handling', () => {
    it('updates title input value', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      const titleInput = screen.getByPlaceholderText('e.g. Refactor PDF parser module');
      await user.type(titleInput, 'Test Task Title');

      expect(titleInput).toHaveValue('Test Task Title');
    });

    it('updates task description textarea', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Describe what the agent should do...');
      await user.type(textarea, 'Test task description');

      expect(textarea).toHaveValue('Test task description');
    });

    it('textarea is not resizable', () => {
      render(<TodoForm {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Describe what the agent should do...');
      expect(textarea).toHaveClass('resize-none');
    });
  });

  describe('YOLO Mode Toggle', () => {
    it('renders YOLO mode toggle switch', () => {
      render(<TodoForm {...defaultProps} />);
      expect(screen.getByText('YOLO Mode')).toBeInTheDocument();
      expect(screen.getByText('auto-approve all permissions')).toBeInTheDocument();
    });

    it('toggles YOLO mode when clicked', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('has correct initial YOLO mode value from props', () => {
      render(<TodoForm {...defaultProps} initialValues={{ yoloMode: true }} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Cancel Button', () => {
    it('calls onClose when Cancel button clicked', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('shows error when submitting with empty title', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      // Fill in other fields but not title
      const textarea = screen.getByPlaceholderText('Describe what the agent should do...');
      await user.type(textarea, 'Test description');

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
    });

    it('shows error when submitting with empty description', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      // Fill title but not description
      const titleInput = screen.getByPlaceholderText('e.g. Refactor PDF parser module');
      await user.type(titleInput, 'Test Title');

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
    });
  });

  describe('Create Mode', () => {
    it('shows Create button for new task', () => {
      render(<TodoForm {...defaultProps} />);
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    it('disables submit button while submitting', async () => {
      const { user } = setupTest();
      mockIPCResponse('agent-todo:create', new Promise(() => {})); // Never resolves

      render(
        <TodoForm
          {...defaultProps}
          initialValues={{
            title: 'Test',
            prompt: 'Test prompt',
            cwd: '/test',
            agentId: 'agent-1',
          }}
        />,
      );

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeDisabled();
      });
    });
  });

  describe('Edit Mode', () => {
    it('shows Save button for editing', () => {
      render(<TodoForm {...defaultProps} editId="todo-1" />);
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('does not show Create button when editing', () => {
      render(<TodoForm {...defaultProps} editId="todo-1" />);
      expect(screen.queryByText('Create')).not.toBeInTheDocument();
    });
  });

  describe('Initial Values', () => {
    it('populates form with initial values', () => {
      render(
        <TodoForm
          {...defaultProps}
          initialValues={{
            title: 'Initial Title',
            prompt: 'Initial Prompt',
            cwd: '/initial/path',
            agentId: 'agent-1',
            priority: 3,
            yoloMode: true,
          }}
        />,
      );

      expect(screen.getByDisplayValue('Initial Title')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Initial Prompt')).toBeInTheDocument();
    });

    it('resets form when reopened with different initial values', () => {
      const { rerender } = render(
        <TodoForm {...defaultProps} isOpen={true} initialValues={{ title: 'First Title' }} />,
      );

      expect(screen.getByDisplayValue('First Title')).toBeInTheDocument();

      rerender(
        <TodoForm {...defaultProps} isOpen={false} initialValues={{ title: 'Second Title' }} />,
      );

      rerender(
        <TodoForm {...defaultProps} isOpen={true} initialValues={{ title: 'Second Title' }} />,
      );

      expect(screen.getByDisplayValue('Second Title')).toBeInTheDocument();
    });
  });

  describe('Priority Selection', () => {
    it('renders PriorityPicker with initial value', () => {
      render(<TodoForm {...defaultProps} initialValues={{ priority: 2 }} />);
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('updates priority when clicking priority buttons', async () => {
      const { user } = setupTest();
      render(<TodoForm {...defaultProps} />);

      // Priority buttons are identified by title attribute
      const urgentButton = screen.getByTitle('Urgent');
      await user.click(urgentButton);
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });
  });

  describe('Remote Project Indicators', () => {
    it('shows Remote badge for remote projects', async () => {
      mockIPCResponse('projects:list', [
        {
          id: 'project-1',
          name: 'Remote Project',
          workdir: '/remote/path',
          sshServerId: 'ssh-1',
        },
      ]);
      mockIPCResponse('ssh:get-server', {
        id: 'ssh-1',
        label: 'Test Server',
        host: 'example.com',
        port: 22,
        username: 'user',
        authMethod: 'key',
      });

      render(<TodoForm {...defaultProps} projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Remote')).toBeInTheDocument();
      });
    });
  });

  describe('Form Accessibility', () => {
    it('has correct placeholders for all inputs', () => {
      render(<TodoForm {...defaultProps} />);
      expect(screen.getByPlaceholderText('e.g. Refactor PDF parser module')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Describe what the agent should do...'),
      ).toBeInTheDocument();
    });

    it('YOLO toggle has correct role and aria attributes', () => {
      render(<TodoForm {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('type', 'button');
    });

    it('submit button has type submit', () => {
      render(<TodoForm {...defaultProps} />);
      const submitButton = screen.getByText('Create');
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('cancel button has type button', () => {
      render(<TodoForm {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toHaveAttribute('type', 'button');
    });
  });
});
