import { EmptyValue } from '@/app/components/shared/empty-value';
import { AddedByFrame } from './device-added-by-frame';

/** The "Added by" cell with no one to show: the empty mark beside the label. */
export function DeviceAddedByNobody() {
  return (
    <AddedByFrame>
      <div className="min-w-0 text-h4">
        <EmptyValue />
      </div>
    </AddedByFrame>
  );
}
