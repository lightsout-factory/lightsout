import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/args/parseFlags.ts';
import { standardsValidateCommand } from '#src/cli/standardsValidateCommand.ts';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsPackFile } from '#src/common/types/LoadedStandardsPackFile.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';

// Mocked Imports
// -------------------------
// Loading a pack off disk and running its checks against fixtures are two
// other modules' entry points, each covered by its own tests. What this command
// owns is which pack path it resolves, the order it prints in, and how it
// ends — all observable with both stubbed.

const mockLoadStandardsPack = jest.fn<(params: { packPath: string }) => Promise<LoadedStandardsLibrary>>();
const mockResolveDefaultStandardsLibrary = jest.fn<() => string>();
const mockValidateStandardsPack =
	jest.fn<
		(params: { library: LoadedStandardsLibrary; libraries: LoadedStandardsLibrary[] }) => Promise<{ problems: string[]; notes: string[]; warnings: string[] }>
	>();

jest.mock('#src/standardsLibraries/readStandardsLibrary/readStandardsLibrary.ts', () => ({
	readStandardsLibrary: (params: { packPath: string }) => mockLoadStandardsPack(params),
}));
jest.mock('#src/standardsLibraries/resolveDefaultStandardsLibrary.ts', () => ({ resolveDefaultStandardsLibrary: () => mockResolveDefaultStandardsLibrary() }));

jest.mock('#src/standardsCheck/validateStandardsLibrary/validateStandardsLibrary.ts', () => ({
	validateStandardsLibrary: (params: { library: LoadedStandardsLibrary; libraries: LoadedStandardsLibrary[] }) => mockValidateStandardsPack(params),
}));
// -------------------------
// The repo's config and its registered libraries are read by two other
// modules; the command owns only where the validated library sits among them.
const mockReadOptionalConfig = jest.fn<(params: { cwd: string }) => Promise<LightsoutConfig | undefined>>();

jest.mock('#src/common/config/readOptionalConfig.ts', () => ({ readOptionalConfig: (params: { cwd: string }) => mockReadOptionalConfig(params) }));
// -------------------------
const mockResolveStandardsLibraries =
	jest.fn<(params: { cwd: string; config?: LightsoutConfig; builtIn?: LoadedStandardsLibrary }) => Promise<LoadedStandardsLibrary[]>>();

jest.mock('#src/standardsLibraries/resolveStandardsLibraries/resolveStandardsLibraries.ts', () => ({
	resolveStandardsLibraries: (params: { cwd: string; config?: LightsoutConfig; builtIn?: LoadedStandardsLibrary }) => mockResolveStandardsLibraries(params),
}));
// -------------------------

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/module-api',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: overrides.deterministic !== true,
	defaultSeverity: 'advisory',
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

const setupValidate = ({
	args = [],
	rules = [rule({ id: 'multi-export', deterministic: true }), rule({ id: 'premature-abstraction' })],
	problems = [],
	notes = [],
}: {
	args?: string[];
	rules?: LoadedStandardsRule[];
	problems?: string[];
	notes?: string[];
} = {}) => {
	const captured = captureCommandOutput();
	const pack: LoadedStandardsLibrary = { name: 'acme', formatVersion: 2, rootPath: '/packages/acme', documents: [], rules, packs: [] };

	mockResolveDefaultStandardsLibrary.mockReturnValue('/plugin/standards');
	mockLoadStandardsPack.mockResolvedValue(pack);
	// No config and no registered library: the validated library is the only one its packs resolve against.
	mockReadOptionalConfig.mockResolvedValue(undefined);
	mockResolveStandardsLibraries.mockResolvedValue([]);
	mockValidateStandardsPack.mockResolvedValue({ problems, notes, warnings: [] });

	return { context: { flags: parseFlags({ args }), rest: [], cwd: '/repo' }, pack, ...captured };
};

const packFile = ({ name }: { name: string }): LoadedStandardsPackFile => ({
	name,
	filePath: `packs/${name}.json`,
	description: 'a pack',
	include: { packs: [], topics: [], rules: [] },
	ruleSettings: {},
	appliesWhen: undefined,
});

const library = ({
	name,
	rootPath,
	rules = [],
	packs = [],
}: {
	name: string;
	rootPath: string;
	rules?: LoadedStandardsRule[];
	packs?: LoadedStandardsPackFile[];
}): LoadedStandardsLibrary => ({ name, formatVersion: 2, rootPath, documents: [], rules, packs });

// Each library differs from its namesakes by root, so an equality check tells
// which copy of a name reached the validator.
const shippedBuiltIn = library({ name: 'lightsout', rootPath: '/plugin/standards' });
const registeredAcme = library({ name: 'acme', rootPath: '/repo/libs/acme' });
const house = library({ name: 'house', rootPath: '/repo/libs/house' });
const flaggedAcme = library({ name: 'acme', rootPath: '/elsewhere/acme' });
const flaggedLightsout = library({ name: 'lightsout', rootPath: '/repo/my-lightsout' });
const tally = library({
	name: 'tally',
	rootPath: '/repo/libs/tally',
	rules: [rule({ id: 'multi-export', deterministic: true }), rule({ id: 'dead-export', deterministic: true }), rule({ id: 'premature-abstraction' })],
	packs: [packFile({ name: 'base' }), packFile({ name: 'node' }), packFile({ name: 'web' })],
});

const libraryFolders: Record<string, LoadedStandardsLibrary> = {
	'/plugin/standards': shippedBuiltIn,
	'/repo/libs/house': house,
	'/elsewhere/acme': flaggedAcme,
	'/repo/my-lightsout': flaggedLightsout,
	'/repo/libs/tally': tally,
};

const acmeConfig: LightsoutConfig = {
	gates: { check: 'true', test: 'true', 'test-coverage': false },
	'standards-libraries': { acme: './libs/acme' },
};

const setupRegisteredLibraries = ({
	args = [],
	config = acmeConfig,
	registered = [registeredAcme],
	registeredFailure,
}: {
	args?: string[];
	config?: LightsoutConfig;
	registered?: LoadedStandardsLibrary[];
	registeredFailure?: string;
} = {}) => {
	const captured = captureCommandOutput();

	mockResolveDefaultStandardsLibrary.mockReturnValue('/plugin/standards');
	mockLoadStandardsPack.mockImplementation(async ({ packPath }) => {
		const found = libraryFolders[packPath];

		if (found === undefined) {
			throw new Error(`no library at ${packPath}`);
		}

		return found;
	});
	mockReadOptionalConfig.mockResolvedValue(config);
	// Stands in for the registry as it behaves: a given built-in replaces the
	// shipped one, and the registered entries follow it.
	mockResolveStandardsLibraries.mockImplementation(async ({ builtIn }) => {
		if (registeredFailure !== undefined) {
			throw new Error(registeredFailure);
		}

		return [builtIn ?? shippedBuiltIn, ...registered];
	});
	mockValidateStandardsPack.mockResolvedValue({ problems: [], notes: [], warnings: [] });

	return { context: { flags: parseFlags({ args }), rest: [], cwd: '/repo' }, ...captured };
};

describe('standardsValidateCommand', () => {
	test('validates the bundled default pack when no --library is given', async () => {
		const { context, pack, logged, exitCodes } = setupValidate();

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockLoadStandardsPack).toHaveBeenCalledWith({ packPath: '/plugin/standards' });
		// the pack that was loaded is the one validated — not a second read
		expect(mockValidateStandardsPack).toHaveBeenCalledWith({ library: pack, libraries: [pack] });
		// the tally separates what was validated from what nothing could validate
		expect(logged).toContain('acme — 1 deterministic rule(s) validated, 1 agent rule(s), 0 pack file(s)');
		expect(exitCodes).toStrictEqual([0]);
	});

	test('resolves a repo-relative --library against the cwd', async () => {
		const { context } = setupValidate({ args: ['--library', 'plugin/standards'] });

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockLoadStandardsPack).toHaveBeenCalledWith({ packPath: '/repo/plugin/standards' });
	});

	test('takes an absolute --library as it stands', async () => {
		const { context } = setupValidate({ args: ['--library', '/elsewhere/standards'] });

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockLoadStandardsPack).toHaveBeenCalledWith({ packPath: '/elsewhere/standards' });
	});

	test('prints the notes and then the problems, and ends red when any problem remains', async () => {
		const { context, logged, exitCodes } = setupValidate({
			notes: ['premature-abstraction: agent check — fixtures reserved for agent accuracy'],
			problems: ['multi-export: the fail fixture produced no finding — the check does not catch what the rule describes'],
		});

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe('ℹ premature-abstraction: agent check — fixtures reserved for agent accuracy');
		expect(logged[1]).toBe('✗ multi-export: the fail fixture produced no finding — the check does not catch what the rule describes');
		expect(logged).toContain('acme — 1 problem(s) across 1 deterministic rule(s) and 0 pack file(s)');
		expect(exitCodes).toStrictEqual([1]);
	});

	test('ends green when the run produced notes but no problems', async () => {
		const { context, logged, exitCodes } = setupValidate({
			notes: ['multi-export: fixtures skipped — no typescript resolvable'],
		});

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		// a rule nothing could validate is reported, not counted against the pack
		expect(logged[0]).toBe('ℹ multi-export: fixtures skipped — no typescript resolvable');
		expect(logged).toContain('acme — 1 deterministic rule(s) validated, 1 agent rule(s), 0 pack file(s)');
		expect(exitCodes).toStrictEqual([0]);
	});

	test('reports a pack it cannot load and never runs the validation', async () => {
		const { context, errors, exitCodes } = setupValidate();

		mockLoadStandardsPack.mockRejectedValue(new Error('standards pack root file not found: /plugin/standards/lightsout-standards.json'));

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toStrictEqual(['standards pack root file not found: /plugin/standards/lightsout-standards.json']);
		expect(mockValidateStandardsPack).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test.each([
		{ args: [], validated: shippedBuiltIn, libraries: [shippedBuiltIn, registeredAcme] },
		{ args: ['--library', 'libs/house'], validated: house, libraries: [shippedBuiltIn, registeredAcme, house] },
		{ args: ['--library', '/elsewhere/acme'], validated: flaggedAcme, libraries: [shippedBuiltIn, flaggedAcme] },
	])("validates against the repo's registered libraries with the validated library in place of its namesake", async ({ args, validated, libraries }) => {
		const { context } = setupRegisteredLibraries({ args });

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockResolveStandardsLibraries).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo', config: acmeConfig }));
		expect(mockValidateStandardsPack).toHaveBeenCalledWith({ library: validated, libraries });
	});

	test('a validated library named lightsout replaces the built-in library rather than joining it', async () => {
		const { context } = setupRegisteredLibraries({ args: ['--library', 'my-lightsout'], registered: [] });

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockResolveStandardsLibraries).toHaveBeenCalledWith(expect.objectContaining({ builtIn: flaggedLightsout }));
		// the flagged folder is the only one read — the shipped built-in never loads
		expect(mockLoadStandardsPack.mock.calls).toStrictEqual([[{ packPath: '/repo/my-lightsout' }]]);
		expect(mockValidateStandardsPack).toHaveBeenCalledWith({ library: flaggedLightsout, libraries: [flaggedLightsout] });
	});

	test('a registered library that will not load stops standards-validate with its message', async () => {
		const { context, errors, exitCodes } = setupRegisteredLibraries({
			registeredFailure: 'standards library acme (./libs/acme) will not load: lightsout-standards.json not found',
		});

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toStrictEqual(['standards library acme (./libs/acme) will not load: lightsout-standards.json not found']);
		expect(mockValidateStandardsPack).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('reports how many pack files were validated', async () => {
		const { context, logged, exitCodes } = setupRegisteredLibraries({ args: ['--library', 'libs/tally'] });

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		const finalLine = logged.at(-1);

		expect({ finalLine, exitCodes }).toEqual({
			finalLine: expect.stringMatching(/2 deterministic rule.*1 agent rule.*3 pack file/),
			exitCodes: [0],
		});
	});
});
