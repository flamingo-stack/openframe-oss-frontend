/**
 * The theme the previews are shown in. Not a setting: the client picks the
 * theme in the Fae app, so the previews show the one Fae opens in until then.
 * `.ai-preview-theme` (`globals.css`) plus the core library's `.theme-dark`
 * scope it to the preview, so the page around it keeps the app's own theme.
 */
export const PREVIEW_THEME_CLASS = 'ai-preview-theme theme-dark';
