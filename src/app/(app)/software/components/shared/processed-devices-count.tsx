import { formatCount } from '@/lib/format-number';

interface ProcessedDevicesCountProps {
  responded: number;
  total: number;
}

/** "3/10": how many of a run's devices have reported back. */
export function ProcessedDevicesCount({ responded, total }: ProcessedDevicesCountProps) {
  return (
    <>
      {formatCount(responded)}
      <span className="text-ods-text-secondary">/{formatCount(total)}</span>
    </>
  );
}
