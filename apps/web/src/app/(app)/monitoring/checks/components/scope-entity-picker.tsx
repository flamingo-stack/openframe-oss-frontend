'use client';

import { InsightCheckScopeType } from '@/generated/schema-enums';
import { CustomerPicker } from './customer-picker';
import { DevicePicker } from './device-picker';
import type { EntityPickerProps } from './picker-field';
import { TagPicker } from './tag-picker';

/** The customer, device tag or device an exception is for: a single pick, searched on the server where the list is long. */
export function ScopeEntityPicker(props: EntityPickerProps) {
  switch (props.type) {
    case InsightCheckScopeType.CUSTOMER:
      return <CustomerPicker {...props} />;
    case InsightCheckScopeType.DEVICE:
      return <DevicePicker {...props} />;
    case InsightCheckScopeType.TAG:
      return <TagPicker {...props} />;
  }
}
