import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';

/** Where a row leads: a folder opens its own listing, an article opens its page. */
export function knowledgeBaseItemHref(type: string, id: string): string {
  return type === KnowledgeBaseItemType.FOLDER ? routes.knowledgeBase.folder(id) : routes.knowledgeBase.details(id);
}
