'use client';

import { Component, type ReactNode } from 'react';

/**
 * The server answered a paged query with GraphQL errors and no data. With a cursor in the URL that is the cursor
 * (stale, tampered, issued under another sort): the lists disagree on how they refuse one (BadRequest,
 * IllegalArgumentException, a Pinot error). A transport or session failure (offline, timeout, 5xx, 401, workspace
 * gone, update required) is not: it never reaches the data layer as this Relay error.
 */
export function isCursorRefusal(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('No data returned for operation');
}

interface StaleCursorBoundaryProps {
  /** The cursor the query below was read with; `null` on the first page. */
  cursor: string | null;
  /** Leave the cursor (replace, no history entry): the table reads its first page. */
  onStaleCursor: () => void;
  children: ReactNode;
}

interface StaleCursorBoundaryState {
  error: unknown;
  /** The cursor the caught error was read with: a new cursor clears it. */
  failedCursor: string | null;
}

/**
 * Wraps a paged table's query, INSIDE its `ContentErrorBoundary`. A refused cursor drops to the first page with no
 * error screen; every other error (and any error on the first page) goes up to the content boundary unchanged, so its
 * Retry and its reconnect retry keep the cursor and the reader's place.
 */
export class StaleCursorBoundary extends Component<StaleCursorBoundaryProps, StaleCursorBoundaryState> {
  state: StaleCursorBoundaryState = { error: null, failedCursor: null };

  static getDerivedStateFromError(error: unknown): Partial<StaleCursorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: StaleCursorBoundaryProps,
    state: StaleCursorBoundaryState,
  ): Partial<StaleCursorBoundaryState> | null {
    // The cursor the error belonged to is gone: render the query again.
    if (state.error && props.cursor !== state.failedCursor) return { error: null, failedCursor: props.cursor };
    return null;
  }

  componentDidCatch(error: unknown): void {
    this.setState({ failedCursor: this.props.cursor });
    if (this.props.cursor && isCursorRefusal(error)) this.props.onStaleCursor();
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Not ours: the content boundary above shows it, with Retry.
    if (!this.props.cursor || !isCursorRefusal(error)) throw error;
    // The cursor is being dropped; the first page renders on the next commit.
    return null;
  }
}
