import { appStyleSources } from '@flamingo-stack/openframe-frontend-core/style-sources';
import openframeCorePreset from '@flamingo-stack/openframe-frontend-core/tailwind.config.ts';
import type { Config } from 'tailwindcss';

const config: Config = {
  // The files the app's routes import, its own and the design-system lib's (`style-sources`):
  // Tailwind writes a rule only for a class something on a page can render.
  content: appStyleSources({ root: __dirname, appDir: 'src/app' }),
  // The whole theme is the lib's preset: ODS colours and tokens, and its plugins (tailwindcss-animate
  // included). Give the app no `safelist` of its own: it would replace the preset's.
  presets: [openframeCorePreset],
};

export default config;
