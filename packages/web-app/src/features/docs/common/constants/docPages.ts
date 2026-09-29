import configurationDoc from '#docs/configuration.md';
import monoreposDoc from '#docs/monorepos.md';

interface DocPageEntry {
	title: string;
	text: string;
}

/**
 * Bundled at build time rather than read from disk: the public site holds no
 * repo. Keyed by plain string because the route param is whatever a reader
 * typed, and a possibly absent entry lets the page answer a wrong one.
 */
export const docPages: Record<string, DocPageEntry | undefined> = {
	configuration: { title: 'Configuration', text: configurationDoc },
	monorepos: { title: 'Monorepos', text: monoreposDoc },
};
