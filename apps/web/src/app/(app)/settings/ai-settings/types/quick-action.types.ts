import { z } from 'zod';

/** Quick action form shape shared by the Customer and Mingo AI settings forms. */
export const quickActionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Action name is required'),
  instructions: z.string().min(1, 'Action instructions are required'),
  /** Library glyph key picked in the editor; optional - a row without an icon is valid. */
  iconName: z.string().nullable().optional(),
});

export type QuickActionFormValue = z.infer<typeof quickActionSchema>;

/** Minimal form-values contract required by AiSettingsQuickActionsEditor. */
export interface QuickActionsFormValues {
  quickActions: QuickActionFormValue[];
  /** Mirrors `AgentAiConfig.quickActionsIsDefault` — true hides the editor and keeps hub defaults. */
  quickActionsIsDefault: boolean;
}
