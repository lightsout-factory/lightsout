import { fileURLToPath } from 'node:url';
import netlify from '@netlify/vite-plugin-tanstack-start';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { isPublicDeployment } from './src/common/utils/isPublicDeployment.ts';

/**
 * The engine imports its prompts as `.md` modules. esbuild
 * (scripts/buildEngine.mjs) and Jest (tooling/jest) have their own loaders, and
 * all three must agree that a markdown import is a string.
 */
const markdownAsText = (): Plugin => ({
	name: 'lightsout-markdown-as-text',
	transform(code, id) {
		return id.endsWith('.md') ? { code: `export default ${JSON.stringify(code)};`, map: null } : undefined;
	},
});

/** Netlify sets `NETLIFY` on every build, so its adapter joins only there and a local build stays the plain server. */
const onNetlify = process.env.NETLIFY === 'true';

/** On Netlify the platform's `URL` fills the gap, so there is no second place to set the origin. */
const siteOrigin = process.env.VITE_SITE_ORIGIN ?? (onNetlify ? process.env.URL : undefined);

export default defineConfig({
	// `LIGHTSOUT_PUBLIC` is checked here, so a bad value fails the build rather
	// than shipping `/app` to a public site. It is baked in because the browser
	// has no environment, and a host's function runtime is not guaranteed the
	// build's.
	//
	// Spelled `process.env` rather than `import.meta.env` because the app's own
	// suite compiles these files to CommonJS, where `import.meta` will not parse.
	define: {
		'process.env.VITE_SITE_ORIGIN': JSON.stringify(siteOrigin ?? ''),
		'process.env.LIGHTSOUT_PUBLIC': JSON.stringify(isPublicDeployment() ? '1' : ''),
	},
	server: { port: 4317 },
	// Workspace packages ship TypeScript source, so Vite has to transform them
	// rather than hand them to Node.
	ssr: { noExternal: [/^@lightsout\//] },
	// A package `imports` entry may not escape the package, so each alias is
	// also spelled in tsconfig.json `paths` and jest.config.cjs `moduleNameMapper`.
	resolve: {
		alias: {
			'#assets': fileURLToPath(new URL('../../assets', import.meta.url)),
			'#docs': fileURLToPath(new URL('../../docs', import.meta.url)),
		},
	},
	optimizeDeps: { exclude: ['@lightsout/engine', '@lightsout/shared'] },
	plugins: [markdownAsText(), tanstackStart(), ...(onNetlify ? [netlify()] : []), tailwindcss(), viteReact()],
});
