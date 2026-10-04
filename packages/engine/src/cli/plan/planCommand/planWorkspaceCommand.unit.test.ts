import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { PlanWorktree } from '#src/cli/plan/planCommand/common/types/PlanWorktree.ts';
import { planWorkspaceCommand } from '#src/cli/plan/planCommand/planWorkspaceCommand.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';

// The command is handed a tree `planCommand` already resolved, and by then the
// wrapper has announced the move on stdout. The arrangement writes that same
// announcement first, through the same captured stream, so the assertion can
// prove the path lands below it rather than merely somewhere in the output.
const setupWorkspace = () => {
	const captured = captureCommandOutput();
	const worktree: PlanWorktree = { cwd: '/repo/.worktrees/lo-131-demo', branch: 'lo-131-demo', isolated: true, created: true };

	console.log(`lightsout: workspace ${worktree.cwd}\n  branch: ${worktree.branch}`);

	return { worktree, ...captured };
};

// A tree whose cwd has no repository above it, so the plan folder resolves under
// that cwd itself — a path the assertion can state independently of the resolver.
const setupLooseWorkspace = () => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-plan-workspace-command-'));
	const worktree: PlanWorktree = { cwd, branch: 'lo-131-demo', isolated: true, created: true };
	const name = 'lo-131-demo/001-demo';

	return { worktree, name, ...captured };
};

describe('planWorkspaceCommand', () => {
	test('writes the resolved path alone on the last stdout line and exits 0', async () => {
		const { worktree, logged, errors, exitCodes } = setupWorkspace();

		await expect(planWorkspaceCommand({ worktree, name: 'lo-131-demo/001-demo' })).rejects.toThrow(/process\.exit/);

		const stdoutLines = logged.join('\n').split('\n');
		expect(stdoutLines.at(-1)).toBe('/repo/.worktrees/lo-131-demo');
		expect(stdoutLines.slice(0, 2)).toStrictEqual(['lightsout: workspace /repo/.worktrees/lo-131-demo', '  branch: lo-131-demo']);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('writes the plan folder on a labelled line directly above the worktree path, which stays alone on the last line', async () => {
		const { worktree, name, logged, errors, exitCodes } = setupLooseWorkspace();

		await expect(planWorkspaceCommand({ worktree, name })).rejects.toThrow(/process\.exit/);

		const stdoutLines = logged.join('\n').split('\n');
		expect(stdoutLines.slice(-2)).toStrictEqual([
			`plan folder: ${join(worktree.cwd, '.lightsout', 'work-orders', 'lo-131-demo', 'plans', '001-demo')}`,
			worktree.cwd,
		]);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});
});
