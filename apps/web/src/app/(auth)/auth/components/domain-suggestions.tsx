'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';

interface DomainSuggestionsProps {
  suggestions: string[];
  onSelect: (subdomain: string) => void;
}

/** Alternative subdomains offered when the typed one is taken. Rendered into the domain field's slot. */
export function DomainSuggestions({ suggestions, onSelect }: DomainSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 text-ods-text-secondary text-h6">
      <p>Available suggestions:</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(suggestion => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="small-legacy"
            onClick={() => onSelect(suggestion)}
          >
            {suggestion}.{SAAS_DOMAIN_SUFFIX}
          </Button>
        ))}
      </div>
    </div>
  );
}
