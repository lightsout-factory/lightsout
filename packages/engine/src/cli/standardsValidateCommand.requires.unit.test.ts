import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import { standardsValidateCommand } from '#src/cli/standardsValidateCommand.ts';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';

// Mocked Imports
// -------------------------
// Loading the library and judging its packs are other modules' entry points,
// each covered by its own tests. What this command owns is how it prints the
// validator's warnings and how it ends when warnings are all there is.
const mockReadStandardsLibrary = jest.fn<(params: { packPath: string }) => Promise<LoadedStandardsLibrary>>();

jest.mock('#src/standardsLibraries/readStandardsLibrary/readStandardsLibrary.ts', () => ({
	readStandardsLibrary: (params: { packPath: string }) => mockReadStandardsLibrary(params),
}));
// -------------------------
const mockValidateStandardsLibrary =
	jest.fn<
		(params: { library: LoadedStandardsLibrary; libraries: LoadedStandardsLibrary[] }) => Promise<{ problems: string[]; notes: string[]; warnings: string[] }>
	>();

jest.mock('#src/standardsCheck/validateStandardsLibrary/validateStandardsLibrary.ts', () => ({
	validateStandardsLibrary: (params: { library: LoadedStandardsLibrary; libraries: LoadedStandardsLibrary[] }) => mockValidateStandardsLibrary(params),
}));
// -------------------------
const mockReadOptionalConfig = jest.fn<(params: { cwd: string }) => Promise<LightsoutConfig | undefined>>();

jest.mock('#src/common/config/readOptionalConfig.ts', () => ({ readOptionalConfig: (params: { cwd: string }) => mockReadOptionalConfig(params) }));
// -------------------------
const mockResolveStandardsLibraries =
	jest.fn<(params: { cwd: string; config?: LightsoutConfig; builtIn?: LoadedStandardsLibrary }) => Promise<LoadedStandardsLibrary[]>>();

jest.mock('#src/standardsLibraries/resolveStandardsLibraries/resolveStandardsLibraries.ts', () => ({
	resolveStandardsLibraries: (params: { cwd: string; config?: LightsoutConfig; builtIn?: LoadedStandardsLibrary }) => mockResolveStandardsLibraries(params),
}));
// -------------------------

const rule = ({ id, deterministic, requires }: { id: string; deterministic: boolean; requires: string[] }): LoadedStandardsRule => ({
	id,
	name: `house/${id}`,
	library: 'house',
	set: 'code',
	documentPath: 'code/architecture/react',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic,
	agent: !deterministic,
	defaultSeverity: 'advisory',
	defaultOptions: {},
	fixturesPath: `/repo/libs/house/${id}/fixtures`,
	requires,
});

const setupWarningsOnly = ({ warnings }: { warnings: string[] }) => {
	const captured = captureCommandOutput();
	const library: LoadedStandardsLibrary = {
		name: 'house',
		formatVersion: 2,
		rootPath: '/repo/libs/house',
		documents: [],
		rules: [
			rule({ id: 'component-file-structure', deterministic: false, requires: ['house/index-files'] }),
			rule({ id: 'index-files', deterministic: true, requires: [] }),
		],
		packs: [],
	};

	mockReadStandardsLibrary.mockResolvedValue(library);
	mockReadOptionalConfig.mockResolvedValue(undefined);
	mockResolveStandardsLibraries.mockResolvedValue([]);
	mockValidateStandardsLibrary.mockResolvedValue({ problems: [], notes: [], warnings });

	return { context: { flags: parseFlags({ args: ['--library', 'libs/house'] }), rest: [], cwd: '/repo' }, ...captured };
};

/** The same library, with the validator returning one finding of every kind. */
const setupEveryFinding = ({ note, warning, problem }: { note: string; warning: string; problem: string }) => {
	const setup = setupWarningsOnly({ warnings: [warning] });

	mockValidateStandardsLibrary.mockResolvedValue({ problems: [problem], notes: [note], warnings: [warning] });

	return setup;
};

describe('standardsValidateCommand', () => {
	test('prints each missing-requirement warning and still exits 0', async () => {
		const { context, logged, exitCodes } = setupWarningsOnly({
			warnings: [
				'house/react: house/component-file-structure requires house/index-files, which the pack does not send to agents',
				'house/react: house/component-file-structure requires house/module-folder-layout, which the pack does not send to agents',
			],
		});

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		expect({ warningLines: logged.slice(0, 2), finalLine: logged.at(-1), exitCodes }).toStrictEqual({
			warningLines: [
				'⚠ house/react: house/component-file-structure requires house/index-files, which the pack does not send to agents',
				'⚠ house/react: house/component-file-structure requires house/module-folder-layout, which the pack does not send to agents',
			],
			finalLine: 'house — 1 deterministic rule(s) validated, 1 agent rule(s), 0 pack file(s)',
			exitCodes: [0],
		});
	});

	test('prints warnings after the notes and before the problems, and a problem still exits 1', async () => {
		const { context, logged, exitCodes } = setupEveryFinding({
			note: 'house/index-files: agent check — fixtures reserved for agent accuracy',
			warning: 'house/react: house/component-file-structure requires house/index-files, which the pack does not send to agents',
			problem: 'house/index-files: the fail fixture produced no finding — the check does not catch what the rule describes',
		});

		await expect(standardsValidateCommand(context)).rejects.toThrow(/process\.exit/);

		// the warning is not counted: the summary names one problem, the one the validator returned
		expect({ logged, exitCodes }).toStrictEqual({
			logged: [
				'ℹ house/index-files: agent check — fixtures reserved for agent accuracy',
				'⚠ house/react: house/component-file-structure requires house/index-files, which the pack does not send to agents',
				'✗ house/index-files: the fail fixture produced no finding — the check does not catch what the rule describes',
				'',
				'house — 1 problem(s) across 1 deterministic rule(s) and 0 pack file(s)',
			],
			exitCodes: [1],
		});
	});
});
