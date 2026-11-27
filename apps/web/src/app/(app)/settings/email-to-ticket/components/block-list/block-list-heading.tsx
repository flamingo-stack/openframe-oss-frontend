import { BLOCK_LIST_HEADING } from '../../utils/block-list-presentation';

/** The Block list's heading: the same on New Mailbox, Edit Mailbox and the details page. */
export function BlockListHeading() {
  return (
    <div className="flex flex-col">
      <h2 className="text-ods-text-primary text-h2">{BLOCK_LIST_HEADING.title}</h2>
      <p className="text-ods-text-secondary text-h6">{BLOCK_LIST_HEADING.description}</p>
    </div>
  );
}
