const SQL_COMMENT_IN_CHUNK_NAME = /--[^.][^/]*\.(?:css|js)$/u;
const SQL_COMMENT_SEQUENCE = '--';
const SAFE_SEQUENCE = '__';

export function findWafBlockedChunkNames(chunkNames) {
  return chunkNames.filter(chunkName => SQL_COMMENT_IN_CHUNK_NAME.test(chunkName));
}

export function toWafSafeChunkName(chunkName) {
  if (!SQL_COMMENT_IN_CHUNK_NAME.test(chunkName)) return chunkName;

  return chunkName.replace(SQL_COMMENT_SEQUENCE, SAFE_SEQUENCE);
}
