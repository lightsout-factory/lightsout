import sprawlGif from '#assets/sprawl.gif?url';
import { heroDescription } from '#src/features/home/internal/common/constants/heroDescription.ts';

/**
 * `process.env` rather than `import.meta.env`: Jest compiles this file to
 * CommonJS, where `import.meta` is a syntax error. `vite.config.ts` substitutes
 * the value at build time.
 *
 * Unset is normal in local dev: the two tags that need an absolute URL are then
 * left out, since a scraper ignores a relative one.
 */
const siteOrigin = process.env.VITE_SITE_ORIGIN;

const homeTitle = 'lightsout — Stop the slop.';

const origin = siteOrigin === undefined || siteOrigin === '' ? undefined : siteOrigin.replace(/\/$/, '');

/** A link pasted into a post needs a title and image of its own; the root's "lightsout" is only the fallback. */
export const homeMeta = [
	{ title: homeTitle },
	{ name: 'description', content: heroDescription },
	{ property: 'og:title', content: homeTitle },
	{ property: 'og:description', content: heroDescription },
	...(origin === undefined
		? []
		: [
				{ property: 'og:image', content: `${origin}${sprawlGif}` },
				{ property: 'og:url', content: `${origin}/` },
			]),
];
