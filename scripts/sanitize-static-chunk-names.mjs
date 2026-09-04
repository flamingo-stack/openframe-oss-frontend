import { fileURLToPath } from 'node:url';
import { sanitizeStaticChunkNames } from '../src/lib/static-chunk-name-sanitizer.mjs';

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const result = await sanitizeStaticChunkNames(distDirectory);

if (result.renamedFiles.length > 0) {
  console.info(
    `Sanitized ${result.renamedFiles.length} Cloud Armor-blocked chunk files and ${result.replacementCount} references.`,
  );
}
