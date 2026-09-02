const SQL_COMMENT_IN_CHUNK_NAME = /--[^.][^/]*\.(?:css|js)$/u;

export function findWafBlockedChunkNames(chunkNames) {
  return chunkNames.filter(chunkName => SQL_COMMENT_IN_CHUNK_NAME.test(chunkName));
}
