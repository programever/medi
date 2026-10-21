// Build: bundle src/app.ts into dist/app.js, copy the page files and the three session sounds.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of [
  'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', '.nojekyll',
  'medi-10.mp3', 'medi-30.mp3', 'medi-60.mp3',
]) {
  cpSync(`src/${f}`, `dist/${f}`);
}
const r = await build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  target: ['es2022'],
  outfile: 'dist/app.js',
  logLevel: 'info',
});
if (r.errors.length) process.exit(1);
