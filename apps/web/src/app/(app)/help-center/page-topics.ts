import type { PageTopics } from '@flamingo-stack/openframe-frontend-core/utils/page-topics';
import { routes } from '@/lib/routes';

/**
 * This app's route to topic map: the ONE place a page's topic is declared. The
 * lib reads every page's topic from its address through it (`PageTopicsProvider`,
 * given once by the app's runtime provider) for the FAQ block, its "Ask Mingo"
 * card and the chat's quick actions; no page passes a topic. The topics are the
 * hub's (its FAQ admin and quick-action editor), so a Help Center page names the
 * topic of the hub page it mirrors.
 */
const help = routes.helpCenter;

export const PAGE_TOPICS: PageTopics = {
  [help.faqs]: 'faqs',
  [help.trustCenter]: 'trust-center',
  [help.roadmap]: 'roadmap',
  [help.releases]: 'releases',
  [`${help.releases}/detail`]: 'product_release',
  [help.bugFixesAndEnhancements]: 'bug-fixes-and-enhancements',
  [help.onboardingGuides]: 'onboarding-guides',
  [`${help.onboardingGuides}/detail`]: 'onboarding_guide',
  // Each legal document is the hub page it mirrors.
  [help.legal('privacy')]: 'privacy-policy',
  [help.legal('terms')]: 'terms-of-service',
  [help.legal('payment')]: 'payment-terms',
  [help.legal('license')]: 'license',
  [help.legal('security')]: 'security-policy',
  [help.tickets]: 'tickets',
  [help.knowledgeBase]: 'knowledge-base',

  // The product's own screens: the chat asks for their quick actions by these topics (Mingo's home wall and a new
  // chat's empty state today, any chip row a screen adds later). A route stands for the pages under it. Where the
  // hub uses a topic for a different page, the screen takes its own name (the helpdesk's tickets, the tenant's
  // articles), so one topic never means two pages.
  [routes.mingo.home]: 'mingo',
  [routes.dashboard]: 'dashboard',
  [routes.devices.list]: 'devices',
  [routes.tickets.list]: 'helpdesk-tickets',
  [routes.scripts.list]: 'scripts',
  [routes.software.list]: 'software',
  '/monitoring': 'monitoring',
  [routes.logs.page]: 'logs',
  '/log-details': 'logs',
  [routes.incidents.list]: 'incidents',
  [routes.approvals]: 'approvals',
  '/customers': 'customers-list',
  [routes.knowledgeBase.list]: 'knowledge-articles',
  '/notifications': 'notifications',
  '/settings': 'settings',
  [routes.worktime]: 'worktime',
};
