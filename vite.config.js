import { defineConfig } from 'vite';

export default defineConfig({
  // /assets (murals, music, fonts) is served at the site root in dev and
  // copied verbatim into dist/ on build — e.g. assets/murals/x.jpg is
  // fetched as /murals/x.jpg.
  publicDir: 'assets',
});
