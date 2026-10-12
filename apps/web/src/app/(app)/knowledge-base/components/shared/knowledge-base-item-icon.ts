import { BookTextIcon, FolderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';

/**
 * The glyph for each Knowledge Base item type. Single source for the KB table
 * and Mingo's `@kb` / `@kbFolder` mention chips, so an article or folder reads
 * the same in the chat as on the Knowledge Base page.
 */
export const KB_ITEM_ICON = {
  [KnowledgeBaseItemType.ARTICLE]: BookTextIcon,
  [KnowledgeBaseItemType.FOLDER]: FolderIcon,
} satisfies Record<KnowledgeBaseItemType, typeof BookTextIcon>;
