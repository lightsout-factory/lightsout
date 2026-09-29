import { join } from 'node:path';

/** One list, so `preShip.mjs` bumps exactly what `checkShipped.mjs` then verifies. */
export const shippedDirectories = [
	{
		dir: 'plugin',
		primaryManifestPath: join('plugin', '.claude-plugin', 'plugin.json'),
		manifestPaths: [join('plugin', '.claude-plugin', 'plugin.json'), join('plugin', '.codex-plugin', 'plugin.json')],
	},
	{
		dir: 'plugin-linear',
		primaryManifestPath: join('plugin-linear', '.claude-plugin', 'plugin.json'),
		manifestPaths: [join('plugin-linear', '.claude-plugin', 'plugin.json'), join('plugin-linear', '.codex-plugin', 'plugin.json')],
	},
	{
		dir: 'plugin-jira',
		primaryManifestPath: join('plugin-jira', '.claude-plugin', 'plugin.json'),
		manifestPaths: [join('plugin-jira', '.claude-plugin', 'plugin.json'), join('plugin-jira', '.codex-plugin', 'plugin.json')],
	},
];
