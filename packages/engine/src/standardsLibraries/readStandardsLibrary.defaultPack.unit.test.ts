import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSet } from '@lightsout/standards-contracts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/**
 * The pack the plugin ships, loaded from disk exactly as a consumer's run
 * loads it. This is the only test that reads the real default pack, so it is
 * where the shipped tree's shape is pinned: how many documents it carries, which
 * channels it offers, and that every rule claiming a check ships one.
 */
const setupDefaultPack = async () => {
	// The authored pack, not its build copy under plugin/ — a test that read
	// the copy would pass or fail on whether someone had run `pnpm bundle`.
	//
	// Anchored on this file rather than on process.cwd(): the working directory
	// depends on where the runner was invoked from, which is exactly the sort of
	// thing that changes when a repo grows a second place to run tests from.
	const packPath = join(__dirname, '..', '..', '..', 'standards-typescript');

	return { pack: await readStandardsLibrary({ packPath }) };
};

/** The one group a repo whose manifest names no framework gets: the shipped library's node pack, every rule at the pack's own grade. */
const nodeGroupOf = ({ pack }: { pack: LoadedStandardsLibrary }): StandardsGroup => {
	const resolved = resolveStandardsPack({ address: 'lightsout/node', libraries: [pack] });

	return {
		packages: [''],
		pack: resolved,
		source: StandardsPackSource.Detected,
		states: new Map<string, ResolvedRuleState>(
			resolved.rules.map(({ rule, severity, options }) => [
				rule.name,
				{ severity, options, fromConfig: false, reachesAgents: severity !== StandardsSeverity.Off },
			]),
		),
	};
};

describe('readStandardsLibrary', () => {
	test('carries all 24 shipped documents, split across the code and tests trees', async () => {
		const { pack } = await setupDefaultPack();

		expect(pack.name).toBe('lightsout');
		expect(pack.documents).toHaveLength(24);
		expect(pack.documents.filter((document) => document.set === StandardsSet.Code)).toHaveLength(21);
		expect(pack.documents.filter((document) => document.set === StandardsSet.Tests)).toHaveLength(3);
	});

	test('carries the line and the address the root file states about the pack itself', async () => {
		const { pack } = await setupDefaultPack();

		// what a pack page shows under the name — read from the root file rather
		// than from any folder, so this is the only place they can come from
		expect({ description: pack.description, homepage: pack.homepage }).toEqual({
			description: expect.stringContaining('TypeScript pack'),
			homepage: 'https://github.com/lightsout-factory/lightsout/tree/main/packages/standards-typescript',
		});
	});

	test('offers exactly the base, nestjs, react, and tanstack channels', async () => {
		const { pack } = await setupDefaultPack();

		// a channel no document declares could never be activated by a repo
		expect([...new Set(pack.documents.map((document) => document.channel))].sort()).toStrictEqual(['base', 'nestjs', 'react', 'tanstack']);
	});

	test('every rule declaring a check ships one that can be run', async () => {
		const { pack } = await setupDefaultPack();

		const checked = pack.rules.filter((rule) => rule.checked);
		const runnable = checked.filter((rule) => typeof rule.run === 'function' && rule.inputKind !== undefined);

		// the honesty rule at load time is what makes this hold — this pins that it holds for the shipped pack
		expect(checked.length).toBeGreaterThan(0);
		expect(runnable).toHaveLength(checked.length);
		// a judgment-only rule declares no check and carries none
		expect(pack.rules.filter((rule) => !rule.checked).every((rule) => rule.run === undefined)).toBe(true);
	});

	test('assembles both sets for a repo running no framework, each document headed by where it came from', async () => {
		const { pack } = await setupDefaultPack();

		const { code, tests } = buildStandardsDocuments({ groups: [nodeGroupOf({ pack })] });

		expect(code?.match(/^<!-- lightsout: code\/.+ -->$/gm)).toHaveLength(17);
		expect(tests?.match(/^<!-- lightsout: tests\/.+ -->$/gm)).toHaveLength(2);
		// the prose itself rides along, not just the headers
		expect(code ?? '').toContain('One Export Per File');
		expect(tests ?? '').toContain('Module Boundary Testing');
	});

	test('the built-in library is named lightsout and every rule name starts with lightsout/', async () => {
		const { pack } = await setupDefaultPack();

		const misnamed = pack.rules.filter((rule) => rule.name !== `lightsout/${rule.id}`).map((rule) => rule.name);

		// an empty rule list would make "every rule" hold vacuously
		expect(pack.rules.length).toBeGreaterThan(0);
		expect({ name: pack.name, misnamed }).toStrictEqual({ name: 'lightsout', misnamed: [] });
	});
});
