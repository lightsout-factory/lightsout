import type { ConfigView } from '@lightsout/engine';
import { StandardsPackSource, StandardsSeverity } from '@lightsout/engine/contracts';

interface Params {
	/** Only what a test varies, over a repo whose config states a harness and whose pack is detected. */
	overrides?: Partial<ConfigView>;
}

/** The resolved config, shaped as `getConfigView` assembles it, with nothing in it a test did not ask for. */
export const buildConfigView = ({ overrides = {} }: Params = {}): ConfigView => ({
	path: '/repos/lightsout/lightsout.config.json',
	harness: 'claude-code',
	model: 'claude-opus-5',
	sections: [
		{
			title: 'Gates',
			fields: [
				{ key: 'gates', value: { check: 'pnpm check' }, fromConfig: true, description: 'Verification commands — the mechanical gates.' },
				{ key: 'packages-dir', value: 'packages', fromConfig: false, description: 'Directory holding workspace packages, for monorepo scoped gates.' },
			],
		},
	],
	standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: StandardsPackSource.Detected }],
	ruleStates: [
		{
			rule: 'lightsout/file-size',
			id: 'file-size',
			library: 'lightsout',
			severity: StandardsSeverity.Blocking,
			fromConfig: true,
			options: { file: 250 },
			packages: [''],
			appliesTo: 'repo root (outside packages)',
		},
	],
	...overrides,
});
