import { formatDate } from '@/lib/format-date';

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Compact count for headline figures: 3200000 → "3.2M", 10000000 → "10M". */
export function formatCompactCount(value: number): string {
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateOrDash(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}
