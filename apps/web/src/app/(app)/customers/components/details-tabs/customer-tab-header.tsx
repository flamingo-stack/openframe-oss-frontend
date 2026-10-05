'use client';

import type { ReactNode } from 'react';

interface CustomerTabHeaderProps {
  title: string;
  rightActions?: ReactNode;
}

/** Subtitle row inside an organization detail tab — title + optional right-side actions. */
export function CustomerTabHeader({ title, rightActions }: CustomerTabHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-ods-text-primary text-h2">{title}</h2>
      {rightActions && <div className="flex items-center gap-2">{rightActions}</div>}
    </div>
  );
}
