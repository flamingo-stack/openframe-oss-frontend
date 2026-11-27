import type { Check } from '../utils/check-transform';

/** What a row does, for an admin or owner; a reader's rows have none. */
export interface CheckRowActions {
  busy: boolean;
  toggle: (enabled: boolean) => void;
  editDefault: () => void;
  addOverride: () => void;
}

/**
 * A row and everything its cells draw. It rides IN the row data, not in the column closures: the table
 * memoizes a row on its object, so a cell reading the columns' closure would keep what it saw first.
 * `check` is absent on a loading row, whose cells draw their loading forms.
 */
export interface CheckTableRow {
  id: string;
  check?: Check;
  actions?: CheckRowActions | null;
  open?: () => void;
}
