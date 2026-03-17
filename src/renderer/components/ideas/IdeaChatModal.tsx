import { UnifiedChatModal } from '../chat/UnifiedChatModal';

interface IdeaChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectWorkdir?: string | null;
  paperIds: string[];
  repoIds?: string[];
}

export function IdeaChatModal(props: IdeaChatModalProps) {
  return <UnifiedChatModal {...props} />;
}
