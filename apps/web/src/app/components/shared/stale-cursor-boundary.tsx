'use client';

import { Component, type ReactNode } from 'react';

/**
 * The server answered a paged query with GraphQL errors and no data. With a cursor in the URL that is the cursor
 * (stale, tampered, issued under another sort): the lists disagree on how they refuse one (BadRequest,
 * IllegalArgumentException, a Pinot error, `INVALID_CURSOR`). A transport or session failure (offline, timeout, 5xx,
 * 401, workspace gone, update required) is not: it never reaches the data layer as this Relay error.
 */
export function isCursorRefusal(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('No data returned for operation');
}

/**
 * The cursor a paged query was READ with: its deferred page variables' `after` (or `before` on a page read backward).
 * Not the URL's cursor: right after a drop the URL has none while the deferred render still reads the old one.
 */
export function readCursor(page: { after?: string | null; before?: string | null }): string | null {
  return page.after ?? page.before ?? null;
}

interface StaleCursorBoundaryProps {
  /** The cursor the query below is read with (`readCursor` of its deferred page variables); `null` on page 1. */
  cursor: string | null;
  /** Leave the cursor (replace, no history entry): the table reads its first page. */
  onStaleCursor: () => void;
  children: ReactNode;
}

interface StaleCursorBoundaryState {
  error: unknown;
  /** The cursor of the last render: the caught error belongs to it, and only a different cursor clears it. */
  cursor: string | null;
}

/**
 * Wraps a paged table's query, INSIDE its `ContentErrorBoundary`. A refused cursor drops to the first page with no
 * error screen; every other error (and any error on the first page) goes up to the content boundary unchanged, so its
 * Retry and its reconnect retry keep the cursor and the reader's place.
 */
export class StaleCursorBoundary extends Component<StaleCursorBoundaryProps, StaleCursorBoundaryState> {
  constructor(props: StaleCursorBoundaryProps) {
    super(props);
    this.state = { error: null, cursor: props.cursor };
  }

  static getDerivedStateFromError(error: unknown): Partial<StaleCursorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: StaleCursorBoundaryProps,
    state: StaleCursorBoundaryState,
  ): Partial<StaleCursorBoundaryState> | null {
    // Another cursor is being read (the drop landed, or the reader paged): the error was the old cursor's.
    if (props.cursor !== state.cursor) return { error: null, cursor: props.cursor };
    return null;
  }

  componentDidCatch(error: unknown): void {
    if (this.props.cursor && isCursorRefusal(error)) this.props.onStaleCursor();
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Not ours: the content boundary above shows it, with Retry.
    if (!this.props.cursor || !isCursorRefusal(error)) throw error;
    // The cursor is being dropped; the first page renders once the read cursor changes.
    return null;
  }
}
