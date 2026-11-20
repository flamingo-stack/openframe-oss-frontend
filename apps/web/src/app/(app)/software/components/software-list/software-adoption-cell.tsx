'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { createContext, use } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { softwareAdoptionCell_software$key } from '@/__generated__/softwareAdoptionCell_software.graphql';
import { ValueText } from '@/app/components/shared';

const softwareAdoptionCellFragment = graphql`
  fragment softwareAdoptionCell_software on Software {
    adoptionCount
  }
`;

/**
 * The Adoption column's reads, by title id. Only the list query run with Adopt on selects `adoptionCount`
 * (`softwareListTableAdoptQuery`): a backend without Adopt rejects any operation that names it, even under a skipped
 * `@include`, so the shared row fragment cannot carry it. That query hands its rows' references in here.
 */
export type SoftwareAdoptionRefs = ReadonlyMap<string, softwareAdoptionCell_software$key>;

export const SoftwareAdoptionRefsContext = createContext<SoftwareAdoptionRefs | null>(null);

/**
 * ADOPTION column (design 1076:16413): on how many devices Adopt would reinstall the title, the server's count of the
 * devices an order would actually reach. The empty mark for none (0, or a title with no adoption package). Its read
 * comes from the Adopt list query, by title id (`SoftwareAdoptionRefsContext`).
 */
export function SoftwareAdoptionCell({ softwareId }: { softwareId: string }) {
  const loading = useLoadingScope();
  const ref = use(SoftwareAdoptionRefsContext)?.get(softwareId) ?? null;
  const data = useFragment(softwareAdoptionCellFragment, loading ? null : ref);
  // A row still being read (a loading scope): `ValueText` draws its bar.
  return <ValueText value={loading ? undefined : data?.adoptionCount || null} skeletonWidth="w-8" />;
}
