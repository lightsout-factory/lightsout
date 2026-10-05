import { expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

// `standards-pack` and `package-standards-packs` share one selection schema: a
// single pack address or a list of them. What this file owns is the list form;
// the single address, `false` and the address refusal's wording are pinned in
// `LightsoutConfig.unit.test.ts`.

/** One selection written twice: as the repo's `standards-pack`, and as the `web-app` entry of `package-standards-packs`. */
const setupSelection = ({ selection }: { selection: unknown }) => {
	const gates = { check: 'c', test: 't', 'test-coverage': false };

	return {
		repoConfig: { gates, 'standards-pack': selection },
		packageConfig: { gates, 'package-standards-packs': { 'web-app': selection } },
	};
};

test('LightsoutConfig: standards-pack and a package-standards-packs entry each take a list of pack addresses, kept in listed order', () => {
	const { repoConfig, packageConfig } = setupSelection({ selection: ['lightsout/standards', 'house/strict', 'lightsout/standards'] });

	const parsed = { repo: LightsoutConfig.parse(repoConfig)['standards-pack'], package: LightsoutConfig.parse(packageConfig)['package-standards-packs'] };

	// the order is the merge order — the last listed wins — so parsing neither sorts nor dedupes it
	expect(parsed).toStrictEqual({
		repo: ['lightsout/standards', 'house/strict', 'lightsout/standards'],
		package: { 'web-app': ['lightsout/standards', 'house/strict', 'lightsout/standards'] },
	});
});

test.each([
	{ problem: 'an empty list', selection: [] },
	{ problem: 'a list holding an address with no slash', selection: ['lightsout/standards', 'react'] },
	{ problem: 'a list holding an address with two slashes', selection: ['lightsout/packs/node'] },
	{ problem: 'a list holding false', selection: ['lightsout/standards', false] },
])('LightsoutConfig: $problem is refused under standards-pack and under a package-standards-packs entry alike', ({ selection }) => {
	const { repoConfig, packageConfig } = setupSelection({ selection });

	const accepted = { repo: LightsoutConfig.safeParse(repoConfig).success, package: LightsoutConfig.safeParse(packageConfig).success };

	expect(accepted).toStrictEqual({ repo: false, package: false });
});

test('LightsoutConfig: a malformed address inside a list is refused at its own position, naming the <library>/<pack> form', () => {
	const { packageConfig } = setupSelection({ selection: ['lightsout/standards', 'react'] });

	const result = LightsoutConfig.safeParse(packageConfig);

	const issues = (result.error?.issues ?? []).map((issue) => ({ path: issue.path.join('.'), namesTheForm: /<library>\/<pack>/.test(issue.message) }));
	expect(issues).toStrictEqual([{ path: 'package-standards-packs.web-app.1', namesTheForm: true }]);
});
