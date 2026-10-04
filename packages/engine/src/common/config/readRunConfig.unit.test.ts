import { describe, expect, test } from '@jest/globals';
import { describeConfigIssues } from '#src/common/config/describeConfigIssues.ts';
import { readRunConfig } from '#src/common/config/readRunConfig.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { manifestOf } from '#tests/helpers/setupResume.ts';

const recordedRunId = 'run-recorded-config-01';

const setupRecordedRun = ({ config, configPath }: { config?: Record<string, unknown>; configPath?: string } = {}) => {
	const manifest = manifestOf({
		runId: recordedRunId,
		...(config === undefined ? {} : { config }),
		...(configPath === undefined ? {} : { configPath }),
	});

	return { manifest };
};

describe('readRunConfig', () => {
	test('readRunConfig: a recorded config the engine accepts comes back as the typed config', () => {
		const recorded = {
			harness: 'codex',
			gates: { check: 'pnpm run check:recorded', test: 'pnpm run test:recorded', 'test-coverage': false },
		};
		const { manifest } = setupRecordedRun({ config: recorded, configPath: '/elsewhere/lightsout.config.json' });

		const result = readRunConfig({ manifest });

		expect(result).toStrictEqual({ config: LightsoutConfig.parse(recorded) });
	});

	test('readRunConfig: a manifest that records no config is refused, naming the run', () => {
		const { manifest } = setupRecordedRun();

		const result = readRunConfig({ manifest });

		expect({
			error: 'error' in result ? result.error : undefined,
			carriesConfig: Object.hasOwn(result, 'config'),
		}).toEqual({ error: expect.stringContaining(recordedRunId), carriesConfig: false });
	});

	test('readRunConfig: a recorded config this engine rejects is refused with its issues and its recorded path', () => {
		const recorded = {
			gates: { check: 'pnpm run check', test: 'pnpm run test', 'test-coverage': false },
			'not-a-lightsout-key': true,
		};
		const configPath = '/launching/checkout/lightsout.config.json';
		const { manifest } = setupRecordedRun({ config: recorded, configPath });
		const parsed = LightsoutConfig.safeParse(recorded);
		const issueLines = parsed.success ? [] : describeConfigIssues({ error: parsed.error });

		const result = readRunConfig({ manifest });

		const error = 'error' in result ? result.error : '';
		expect({
			namesRun: error.includes(recordedRunId),
			namesPath: error.includes(configPath),
			namesKey: error.includes('not-a-lightsout-key'),
			holdsIssueLines: issueLines.length > 0 && issueLines.every((line) => error.split('\n').includes(line)),
			carriesConfig: Object.hasOwn(result, 'config'),
		}).toStrictEqual({ namesRun: true, namesPath: true, namesKey: true, holdsIssueLines: true, carriesConfig: false });
	});

	test('readRunConfig: a rejected config whose run recorded no path is refused without naming one', () => {
		const { manifest } = setupRecordedRun({
			config: { gates: { check: 'pnpm run check', test: 'pnpm run test', 'test-coverage': false }, 'not-a-lightsout-key': true },
		});

		const result = readRunConfig({ manifest });

		const error = 'error' in result ? result.error : '';
		expect({
			namesRun: error.includes(recordedRunId),
			namesKey: error.includes('not-a-lightsout-key'),
			namesUndefinedPath: error.includes('undefined'),
			carriesConfig: Object.hasOwn(result, 'config'),
		}).toStrictEqual({ namesRun: true, namesKey: true, namesUndefinedPath: false, carriesConfig: false });
	});
});
