'use client';

import { Autocomplete, Button, FieldWrapper } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { assignArticleModalMutation as AssignArticleModalMutationType } from '@/__generated__/assignArticleModalMutation.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useAssignmentSearch } from '@/components/assignments';
import { AssignmentItemType, AssignmentTargetType } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import type { AssignedArticlesTarget } from './assigned-articles-target';

const assignArticleModalMutation = graphql`
  mutation assignArticleModalMutation(
    $itemId: ID!
    $itemType: AssignmentItemType!
    $targetType: AssignmentTargetType!
    $targetId: ID!
  ) {
    assignItem(itemId: $itemId, itemType: $itemType, targetType: $targetType, targetId: $targetId) {
      id
    }
  }
`;

interface ArticleOption {
  value: string;
  label: string;
}

interface AssignArticleModalProps {
  target: AssignedArticlesTarget;
  isOpen: boolean;
  onClose: () => void;
  /** At least one article was assigned — the tab asks for its list and tags again. */
  onAssigned: () => void;
}

/**
 * Assigns knowledge base articles to the page's customer or device. The picker
 * lists every article, assigned or not: `assignItem` answers an article that is
 * already assigned with the existing assignment, so every pick can simply be sent.
 */
export function AssignArticleModal({ target, isOpen, onClose, onAssigned }: AssignArticleModalProps) {
  const { toast } = useToast();
  const [commit] = useMutation<AssignArticleModalMutationType>(assignArticleModalMutation);
  const [selected, setSelected] = useState<ArticleOption[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { options, isLoading } = useAssignmentSearch(AssignmentTargetType.KNOWLEDGE_ARTICLE, searchInput, isOpen);

  // The search narrows `options`; picks it filtered out are kept at the end so their
  // chips keep a label. The rest stays in place, so a pick never moves under the cursor.
  const selectedIds = selected.map(option => option.value);
  const listedIds = new Set(options.map(option => option.value));
  const mergedOptions = [...options, ...selected.filter(option => !listedIds.has(option.value))];

  const handleChange = (nextIds: string[]) => {
    const byId = new Map(mergedOptions.map(option => [option.value, option]));
    setSelected(nextIds.flatMap(id => byId.get(id) ?? []));
  };

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old picks on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setSelected([]);
      setSearchInput('');
    }
  }

  const assignOne = (articleId: string) =>
    new Promise<void>((resolve, reject) => {
      commit({
        variables: {
          itemId: articleId,
          itemType: AssignmentItemType.KNOWLEDGE_ARTICLE,
          targetType: target.targetType,
          targetId: target.targetId,
        },
        onCompleted: (_response, errors) => (errors?.length ? reject(errors[0]) : resolve()),
        onError: reject,
      });
    });

  const handleAssign = async () => {
    if (selectedIds.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    // No batch mutation: one `assignItem` per article, sent together.
    const results = await Promise.allSettled(selectedIds.map(assignOne));
    setIsSubmitting(false);

    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    const assignedCount = results.length - failures.length;
    if (assignedCount > 0) onAssigned();

    if (failures.length === 0) {
      toast({
        title: assignedCount === 1 ? 'Article assigned' : 'Articles assigned',
        description: `${assignedCount} ${assignedCount === 1 ? 'article' : 'articles'} assigned`,
        variant: 'success',
      });
      onClose();
      return;
    }
    toast({
      title: assignedCount > 0 ? 'Some articles were not assigned' : 'Assign failed',
      description: getRelayErrorMessage(failures[0].reason, 'Unable to assign the article'),
      variant: 'destructive',
    });
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title="Assign Article"
      contentClassName="overflow-visible"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="accent"
            className="flex-1"
            onClick={handleAssign}
            disabled={selectedIds.length === 0 || isSubmitting}
            loading={isSubmitting}
          >
            Assign
          </Button>
        </>
      }
    >
      <FieldWrapper label="Articles" labelVariant="large">
        <Autocomplete
          multiple
          options={mergedOptions}
          value={selectedIds}
          onChange={handleChange}
          onInputChange={(inputValue, reason) => {
            if (reason === 'input' || reason === 'clear') setSearchInput(inputValue);
          }}
          placeholder={selectedIds.length > 0 ? 'Add More...' : 'Select Articles'}
          loading={isLoading}
          disableClientFilter
          disabled={isSubmitting}
        />
      </FieldWrapper>
    </SimpleModal>
  );
}
