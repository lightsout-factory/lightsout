import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCodexArgs } from '#src/drivers/buildCodexArgs.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { isRateLimitMessage } from '#src/drivers/internal/common/utils/isRateLimitMessage.ts';
import { spawnCollect } from '#src/drivers/internal/common/utils/spawnCollect.ts';

/** Codex has no system-prompt channel, so the role instructions ride at the top of the task text. */
export const createCodexDriver = (): Driver => {
	const driver: Driver = {
		name: 'codex',
		invoke: async (invocation) => {
			// allowedCommands is deliberately unused: codex's workspace-write
			// sandbox already permits commands, so the grant that binds is the
			// prompt-level list the engine injects into the invocation.
			// foregroundCommandsOnly is deliberately unused too: codex exposes no
			// mechanism to forbid background commands or lift a per-command
			// ceiling, so the request is ignored rather than refused. The queue
			// auto-plan worker's prompt rule and its post-session check of the
			// planning-progress record cover this harness.
			const { prompt, systemPrompt, model, effort, permissions, writableDirs, cwd, timeoutMs } = invocation;

			const outDir = await mkdtemp(join(tmpdir(), 'lightsout-codex-'));
			const outFile = join(outDir, 'last-message.txt');
			const args = buildCodexArgs({ outFile, model, effort, permissions, writableDirs });

			const fullPrompt = systemPrompt ? `# Role instructions\n\n${systemPrompt}\n\n# Task\n\n${prompt}` : prompt;

			try {
				const { exitCode, stdout, stderr } = await spawnCollect({
					command: 'codex',
					args,
					cwd,
					stdinText: fullPrompt,
					timeoutMs,
				});

				const text = await readFile(outFile, 'utf8').catch(() => '');
				const errored = exitCode !== 0 || text === '';

				return {
					text: text || stdout || stderr,
					exitCode,
					rateLimited: errored && isRateLimitMessage({ text: `${stdout}\n${stderr}` }),
				};
			} finally {
				await rm(outDir, { recursive: true, force: true });
			}
		},
	};

	return driver;
};
