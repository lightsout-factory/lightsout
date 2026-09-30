import type { ConfigView } from '@lightsout/engine';
import { StandardsSeverity } from '@lightsout/engine/contracts';

interface Params {
	/** Only what a test varies, over a repo whose config states a harness and loads the default pack. */
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
	packs: [{ name: 'lightsout', rootPath: '/repos/lightsout/packages/standards-typescript', isDefault: true, channels: ['base'] }],
	channels: [],
	ruleStates: [
		{
			rule: 'lightsout/file-size',
			id: 'file-size',
			pack: 'lightsout',
			channel: 'base',
			severity: StandardsSeverity.Blocking,
			fromConfig: true,
			options: { file: 250 },
		},
	],
	...overrides,
});
