import { create } from 'zustand';
import { type CompanyUsage, UNREAD_COMPANY_USAGE } from '../hooks/mingo-usage-panel-data';

/**
 * The company rows of Mingo's Usage panel, as `MingoUsageHydrator` last read them. A store rather than a query in
 * the chat state: the billing read is Relay, and the chat state stays a plain hook every shell test can import.
 */
interface MingoUsageState {
  company: CompanyUsage;
  setCompany: (company: CompanyUsage) => void;
}

export const useMingoUsageStore = create<MingoUsageState>()(set => ({
  company: UNREAD_COMPANY_USAGE,
  setCompany: company => set({ company }),
}));
