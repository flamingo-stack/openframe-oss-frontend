import type { ReactNode } from 'react';

/** The one title an Update <software> form runs on (design 1577:3), as the page has read it. */
export interface SoftwareActionTitle {
  /** `Software.id`: what the package input carries instead of a package. */
  id: string;
  name: string;
  /** The systems it is on: the picker's frame. */
  osTypes: string[];
  /** Its card, where the package rows would be. */
  summary: ReactNode;
}
