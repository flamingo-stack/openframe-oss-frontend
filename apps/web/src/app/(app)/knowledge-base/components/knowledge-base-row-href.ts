import type { KnowledgeBaseRow } from '@flamingo-stack/openframe-frontend-core/components/features';
import { routes } from '@/lib/routes';

/** Where a Knowledge Base row leads: the article's page, or the folder's listing. */
export const knowledgeBaseRowHref = (item: KnowledgeBaseRow): string =>
  item.type === 'ARTICLE' ? routes.knowledgeBase.details(item.id) : routes.knowledgeBase.folder(item.id);
