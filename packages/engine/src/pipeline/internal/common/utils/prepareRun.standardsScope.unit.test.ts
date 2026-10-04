import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { prepareRun } from '#src/pipeline/internal/common/utils/prepareRun.ts';
import { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { createRun } from '#src/runState/createRun.ts';

// Mocked Imports
// -------------------------
interface ResolveStandardsGroupsParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	packages?: string[];
}

const mockResolveStandardsGroups = jest.fn<(params: ResolveStandardsGroupsParams) => Promise<StandardsGroup[]>>();

jest.mock('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts', () => ({
	resolveStandardsGroups: (params: ResolveStandardsGroupsParams) => mockResolveStandardsGroups(params),
}));
// -------------------------

const plainRepo: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };
const monorepo: LightsoutConfig = {
	...plainRepo,
	'package-gates': { check: 'pnpm --filter {package} check', test: 'pnpm --filter {package} test' },
};

const idleDriver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 0 }) };

const write = ({ cwd, path, content }: { cwd: string; path: string; content: string }) => {
	mkdirSync(dirname(join(cwd, path)), { recursive: true });
	writeFileSync(join(cwd, path), content);
};

/** A real run over a temp repo whose workspace holds `api` and `web`; only the group resolver is doubled. */
const setupScopedRun = async ({ config, packages }: { config: LightsoutConfig; packages: string[] | undefined }) => {
	mockResolveStandardsGroups.mockResolvedValue([]);

	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-prepare-run-scope-'));
	write({ cwd, path: 'packages/api/package.json', content: JSON.stringify({ name: 'api' }) });
	write({ cwd, path: 'packages/web/package.json', content: JSON.stringify({ name: 'web' }) });
	write({ cwd, path: 'plan.md', content: '# Plan\n' });

	const manifest = await createRun({ cwd, plan: 'plan.md', pipeline: 'implement', driver: idleDriver.name, loadedConfig: { config } });
	const run = new PipelineRun({ cwd, config, driver: idleDriver, manifest, onProgress: () => undefined });

	return { cwd, run, config, packages };
};

describe('prepareRun', () => {
	// An empty scope must reach the resolver as undefined: `[]` would cover only
	// the repo root group, leaving every workspace package without standards.
	test.each([
		{ scope: 'the settled scope api', config: monorepo, flag: ['api'], expected: [['api']] },
		{ scope: 'an empty scope', config: plainRepo, flag: undefined, expected: [undefined] },
	])("prepareRun: resolves standards for the run's package scope, or every package when the scope is empty", async ({ config, flag, expected }) => {
		const { cwd, run, packages } = await setupScopedRun({ config, packages: flag });

		await prepareRun({ run, cwd, config, packages });

		const requestedScopes = mockResolveStandardsGroups.mock.calls.map(([params]) => params.packages);
		expect(requestedScopes).toStrictEqual(expected);
	});
});
