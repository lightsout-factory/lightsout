import { join, resolve } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { RunWorkspace } from '#src/cli/common/types/RunWorkspace.ts';
import { openDirectWorkspace } from '#src/cli/implementDirectCommand/openDirectWorkspace.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

// Mocked Imports
// -------------------------
// The resolver is mocked so each case can state the one fact it is about —
// which checkout the run builds in, and whether lightsout cut it.
interface ResolveWorkspaceParams {
	cwd: string;
	config: LightsoutConfig;
	flags: CommandContext['flags'];
	planPath?: string;
	ticketPath?: string;
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

const mockResolveRunWorkspace = jest.fn<(params: ResolveWorkspaceParams) => Promise<RunWorkspace | { error: string }>>();

jest.mock('#src/cli/common/implementRun/resolveRunWorkspace/resolveRunWorkspace.ts', () => ({
	resolveRunWorkspace: (params: ResolveWorkspaceParams) => mockResolveRunWorkspace(params),
}));
// -------------------------
interface CopyInputsParams {
	sourceCwd: string;
	workspace: string;
	planPath?: string;
	ticketPath?: string;
}

const mockCopyRunInputs = jest.fn<(params: CopyInputsParams) => Promise<{ planPath?: string; ticketPath?: string } | { error: string }>>();

jest.mock('#src/cli/common/implementRun/copyRunInputs.ts', () => ({
	copyRunInputs: (params: CopyInputsParams) => mockCopyRunInputs(params),
}));
// -------------------------
// The dirty-tree guard is NOT mocked: it is the behaviour these rows are
// about, so what it reads is mocked instead and the real guard decides.
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined>>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({
	readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params),
}));
// -------------------------

const launchedFrom = resolve('/tmp/lightsout-direct-checkout');
const worktreePath = resolve('/tmp/lightsout-direct-worktrees/lo-186-direct');
const branch = 'lo-186-direct';
const ticketPath = join('notes', 'ticket.md');
const copiedTicketPath = join('.lightsout', 'inputs', 'ticket.md');
const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

/**
 * The command's own arguments, and what the mocked resolver, copier and git
 * status answer beneath them.
 *
 * `isolated` is the whole variable of these rows: a tree lightsout cut for the
 * run, against the checkout a person chose themselves with `--no-worktree`.
 */
const setupDirectWorkspace = ({ isolated = false, dirty = [] }: { isolated?: boolean; dirty?: string[] } = {}) => {
	const workspace: RunWorkspace = isolated
		? { cwd: worktreePath, branch, isolated: true, created: true }
		: { cwd: launchedFrom, isolated: false, created: false };

	mockResolveRunWorkspace.mockResolvedValue(workspace);
	mockReadGitChangedFiles.mockResolvedValue(dirty);
	mockCopyRunInputs.mockResolvedValue({ ticketPath: copiedTicketPath });

	return {
		params: { cwd: launchedFrom, config, flags: new Map<string, string | true>(), ticketPath, flaggedRef: undefined },
		workspace,
	};
};

describe('openDirectWorkspace', () => {
	test("refuses a person's checkout holding non-generated edits before the ticket is copied, naming each file", async () => {
		const { params } = setupDirectWorkspace({ dirty: ['src/thing.ts'] });

		const opened = await openDirectWorkspace(params);

		expect({ opened, copies: mockCopyRunInputs.mock.calls.length }).toEqual({
			opened: { error: expect.stringContaining('src/thing.ts') },
			copies: 0,
		});
	});

	test.each([
		{ isolated: false, dirty: [], judged: [[{ cwd: launchedFrom }]] },
		{ isolated: true, dirty: ['src/thing.ts'], judged: [] },
	])("opens a clean person's checkout and never judges a tree lightsout cut", async ({ isolated, dirty, judged }) => {
		const { params, workspace } = setupDirectWorkspace({ isolated, dirty });

		const opened = await openDirectWorkspace(params);

		expect({
			opened,
			copied: mockCopyRunInputs.mock.calls[0]?.[0],
			judged: mockReadGitChangedFiles.mock.calls,
		}).toStrictEqual({
			opened: { workspace, ticketPath: copiedTicketPath },
			copied: { sourceCwd: launchedFrom, workspace: workspace.cwd, ticketPath },
			judged,
		});
	});
});
