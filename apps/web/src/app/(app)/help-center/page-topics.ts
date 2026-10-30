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
};
