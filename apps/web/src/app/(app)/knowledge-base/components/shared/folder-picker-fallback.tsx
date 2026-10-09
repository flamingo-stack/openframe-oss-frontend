'use client';

import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { InputTrigger } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface FolderPickerFallbackProps {
  /** What the picker will show once the tree is in, when that is known without it. */
  label?: string;
  placeholder?: string;
}

/** `FolderPicker` while the folder tree loads: the same control, locked. */
export function FolderPickerFallback({ label, placeholder = 'Select Folder' }: FolderPickerFallbackProps) {
  return (
    <InputTrigger
      selectedLabel={label}
      placeholder={placeholder}
      endIcon={<Chevron02DownIcon className="size-6" />}
      disabled
    />
  );
}
