import { describe, expect, test } from '@jest/globals';
import { runSelfCheck } from '#src/gates/runSelfCheck/runSelfCheck.ts';
import { gateLogCommand } from '#tests/helpers/gateLogCommand.ts';
import { selfCheckGateBlocks } from '#tests/helpers/selfCheckGateBlocks.ts';
import { setupSelfCheck } from '#tests/helpers/setupSelfCheck.ts';

/** A root-block gate command that logs "root <kind>" — which gates ran is read off gates.log. */
const rootGate = ({ kind }: { kind: string }) => `${gateLogCommand({ kind })} root`;

/** A scoped template that logs "<package name> <kind>", so package scope is readable off the same log. */
const packageGate = ({ kind }: { kind: string }) => `${gateLogCommand({ kind })} {package}`;

describe('runSelfCheck', () => {
	test("runSelfCheck: runs the checkpoint's cheap gates and the build, scoped to the packages the live diff touched", async () => {
		const { dir, config, log } = await setupSelfCheck();

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		expect(result.reason).toBe('ran');
		expect(result.error).toBe(undefined);
		// the checkpoint's cheap tier, plus the build — the expensive suite is what a
		// spawn must never wait on
		expect(result.gateNames).toStrictEqual(['check', 'test', 'build']);
		// only the touched package ran: the untouched one and the whole-repo scripts
		// are absent from ${log().join(', ')}
		expect(log()).toStrictEqual(['@acme/api check', '@acme/api test', '@acme/api build']);
	});

	test('runSelfCheck: drops every custom test-* suite, so a spawn never waits on an end-to-end run', async () => {
		const { dir, config, log } = await setupSelfCheck({
			gates: { ...selfCheckGateBlocks.gates, 'test-browser': rootGate({ kind: 'browser' }) },
			packageGates: { ...selfCheckGateBlocks.packageGates, 'test-browser': packageGate({ kind: 'browser' }) },
		});

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// both custom suites fall out — every one of them is expensive, and neither
		// is the build
		expect(result.gateNames).toStrictEqual(['check', 'test', 'build']);
		expect(log()).toStrictEqual(['@acme/api check', '@acme/api test', '@acme/api build']);
	});

	test('runSelfCheck: takes the cheap subset of a pinned gate list, plus the build when that list names it', async () => {
		const { dir, config, log } = await setupSelfCheck({ overrides: { 'verify-implement': ['check', 'test', 'test-e2e', 'build'] } });

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// the pinned list still decides which gates exist; the cheap/build filter
		// decides which of them a self-check spends
		expect(result.gateNames).toStrictEqual(['check', 'test', 'build']);
		expect(log()).toStrictEqual(['@acme/api check', '@acme/api test', '@acme/api build']);
	});

	test('runSelfCheck: reports an empty gate list for a checkpoint that is off, and never calls the gate runner', async () => {
		const { dir, config, log } = await setupSelfCheck({
			// the codegen command runs before any gate under every schedule but off, so
			// its absence from the log is what proves the gate runner was never called
			gates: { ...selfCheckGateBlocks.gates, generate: rootGate({ kind: 'generate' }) },
			overrides: { 'verify-implement': 'off' },
		});

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		expect(result.reason).toBe('nothing-scheduled');
		expect(result.gateNames).toStrictEqual([]);
		// an off checkpoint is not a green one — and it is not an error either
		expect(result.error).toBe(undefined);
		expect(log()).toStrictEqual([]);
	});

	test('runSelfCheck: records its executions under a self-check step name of its own', async () => {
		const { dir, config, records } = await setupSelfCheck();

		await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-evidence',
			step: 'implement',
			onProgress: () => undefined,
		});

		// a self-check execution recorded under the step itself would land in the
		// checkpoint's own evidence namespace, where the following gate reads it
		expect(records({ runId: 'run-evidence' }).map((record) => record.step)).toStrictEqual([
			'self-check-implement',
			'self-check-implement',
			'self-check-implement',
		]);
	});

	test('runSelfCheck: schedules a build declared only by package-gates, which root-only names would miss', async () => {
		const { dir, config, log } = await setupSelfCheck({
			gates: { check: rootGate({ kind: 'check' }), test: rootGate({ kind: 'test' }), 'test-coverage': false },
			packageGates: { check: packageGate({ kind: 'check' }), test: packageGate({ kind: 'test' }), build: packageGate({ kind: 'build' }) },
		});

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// names read off the root block alone would never schedule this build
		expect(result.gateNames).toStrictEqual(['check', 'test', 'build']);
		expect(log()).toStrictEqual(['@acme/api check', '@acme/api test', '@acme/api build']);
	});

	test('runSelfCheck: keeps coverage out at the implement step even when a pinned gate list names it', async () => {
		const { dir, config, log } = await setupSelfCheck({ overrides: { 'verify-implement': ['check', 'test-coverage'] } });

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// at implement the freshly written source has no tests yet, so coverage is
		// red by construction and the executor is not the role that fixes it
		expect(result.gateNames).toStrictEqual(['check']);
		expect(log()).toStrictEqual(['@acme/api check']);
	});

	test('runSelfCheck: reports that it ran nothing when every scheduled gate was skipped, never the gate-override error', async () => {
		const { dir, config, log } = await setupSelfCheck({
			gates: { check: rootGate({ kind: 'check' }), test: rootGate({ kind: 'test' }), 'test-coverage': false },
			// every template names a script the package does not declare, so each one
			// is script-detected as absent and skipped
			packageGates: { check: `${packageGate({ kind: 'check' })} run gate:check`, test: `${packageGate({ kind: 'test' })} run gate:test` },
			scripts: {},
		});

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		expect(result.reason).toBe('nothing-scheduled');
		// the engine's own answer here names `gate-overrides`, a block this consumer
		// may never have written and this caller never used — a round spent on the
		// engine rather than on the code
		expect(result.error).toBe(undefined);
		expect(result.gates.map((observation) => [observation.group, observation.kind, observation.skipped])).toStrictEqual([
			['api', 'check', true],
			['api', 'test', true],
		]);
		expect(log()).toStrictEqual([]);
	});

	test('runSelfCheck: hands a red gate back as the error and the output the agent repairs from', async () => {
		const { dir, config, log } = await setupSelfCheck({
			// a single-package repo: no scoped block at all, so the names and the
			// commands both come from the root block
			packageGates: null,
			gates: {
				check: `${rootGate({ kind: 'check' })} && echo "src/added.js:1 unused import" && exit 1`,
				test: rootGate({ kind: 'test' }),
				'test-coverage': false,
				build: rootGate({ kind: 'build' }),
			},
		});

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		expect(result.reason).toBe('ran');
		// the red is what the agent reads its own mistake off, so the failing gate
		// and the output it left both survive the trip back
		expect(result.error).toContain('check failed (exit 1)');
		expect(result.gates.map((observation) => observation.outputTail)).toEqual([expect.stringContaining('src/added.js:1 unused import')]);
		// and the exact schedule stopped there — gates behind a red one buy nothing
		expect(log()).toStrictEqual(['root check']);
	});
});
