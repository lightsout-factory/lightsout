import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { type StandardsCheckFunction, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { validateStandardsLibrary } from '#src/standardsCheck/validateStandardsLibrary/validateStandardsLibrary.ts';

// Mocked Imports
// -------------------------
// The plugin installed on its own, with no typescript beside it. The engine
// reaches its own compiler through `createRequire`, so refusing that one lookup
// IS the condition under test — and nothing else in this suite resolves a
// module, so the rest of `node:module` is left as it is.
jest.mock('node:module', () => {
	const actual = jest.requireActual<typeof import('node:module')>('node:module');

	return {
		...actual,
		createRequire: () => (id: string) => {
			throw new Error(`Cannot find module '${id}'`);
		},
	};
});
// -------------------------

/** A check that objects to any file named `banned.ts` — small enough to reason about, real enough to fail. */
const bansTheBannedFile: StandardsCheckFunction = ({ inputs }) =>
	(inputs[StandardsInputKind.FileList]?.files ?? [])
		.filter((file) => file.endsWith('banned.ts'))
		.map((path) => ({
			siteKey: `no-banned-file:${path}`,
			files: [{ path }],
			detail: 'a file the rule bans',
		}));

/**
 * A pack holding one rule that needs parsed trees and one that does not,
 * both pointed at a real fixture pair: the fail side holds the banned file, the
 * pass side does not.
 */
const setupPack = () => {
	const fixturesPath = join(mkdtempSync(join(tmpdir(), 'lightsout-validate-no-ts-')), 'fixtures');

	for (const [side, name] of [
		['pass', 'allowed.ts'],
		['fail', 'banned.ts'],
	] as const) {
		mkdirSync(join(fixturesPath, side, 'src'), { recursive: true });
		writeFileSync(join(fixturesPath, side, 'src', name), 'export const value = 1;\n');
	}

	const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
		name: `acme/${overrides.id}`,
		library: 'acme',
		set: 'code',
		documentPath: 'code/style-guide/structure/module-api',
		summary: 'a rule',
		prose: 'the argument for the rule',
		deterministic: true,
		agent: overrides.deterministic === false,
		defaultSeverity: StandardsSeverity.Advisory,
		defaultOptions: {},
		requires: [],
		fixturesPath,
		run: bansTheBannedFile,
		...overrides,
	});

	const pack: LoadedStandardsLibrary = {
		name: 'acme',
		formatVersion: 2,
		rootPath: '/packages/acme',
		documents: [],
		packs: [],
		rules: [
			rule({ id: 'dead-export', inputKinds: [StandardsInputKind.SyntaxTree] }),
			rule({ id: 'no-banned-file', inputKinds: [StandardsInputKind.FileList] }),
		],
	};

	return { pack };
};

describe('validateStandardsLibrary', () => {
	test('notes the rules it cannot parse fixtures for and still validates the rest', async () => {
		const { pack } = setupPack();

		const { problems, notes } = await validateStandardsLibrary({ library: pack, libraries: [pack] });

		expect(notes).toStrictEqual(['dead-export: not validated — its syntax-tree input needs a typescript this install does not have']);
		// a missing compiler is this machine's shortcoming, not the pack's, so
		// the rule that needs none is still held to its fixtures
		expect(problems).toStrictEqual([]);
	});
});
