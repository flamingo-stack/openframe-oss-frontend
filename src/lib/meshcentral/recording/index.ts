export { McrecParseError, parseMcrec } from './mcrec-parser';
export { DEFAULT_MAX_SEGMENT_GAP_MS, type StitchOptions, stitchRecordings } from './mcrec-stitch';
export { McrecPlayer, type McrecPlayerCallbacks } from './mcrec-player';
export {
  MCREC_FLAG_BINARY,
  MCREC_FLAG_FROM_BROWSER,
  MCREC_RECORD_TYPE,
  type McrecMetadata,
  type McrecRecord,
  type ParsedRecording,
  type RecordingPlaybackSpeed,
  type RecordingPlayerState,
  type RecordingRenderer,
} from './mcrec-types';
export { DesktopRecordingRenderer, TerminalRecordingRenderer } from './renderers';
