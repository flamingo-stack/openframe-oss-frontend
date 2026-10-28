import openframeCorePreset from '@flamingo-stack/openframe-frontend-core/tailwind.config.ts';
import { appStyleSources } from '@flamingo-stack/openframe-frontend-core/style-sources';
import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  // The files the app's routes import, its own and the design-system lib's (`style-sources`):
  // Tailwind writes a rule only for a class something on a page can render.
  content: appStyleSources({ root: __dirname, appDir: 'src/app' }),
  plugins: [tailwindcssAnimate],
  // Use ui-kit configuration as preset - this provides all ODS colors
  presets: [openframeCorePreset],
};

export default config;
