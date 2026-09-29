import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Params {
	systemPrompt: string;
}

/**
 * Role + plan + standards can exceed the OS argv ceiling, so the prompt goes
 * through a file. Each call gets its own directory so concurrent spawns cannot collide.
 */
export const writeSystemPromptFile = async ({ systemPrompt }: Params): Promise<{ path: string; cleanup: () => Promise<void> }> => {
	const dir = await mkdtemp(join(tmpdir(), 'lightsout-system-prompt-'));
	const path = join(dir, 'system-prompt.md');

	await writeFile(path, systemPrompt, 'utf8');

	return { path, cleanup: () => rm(dir, { recursive: true, force: true }).catch(() => undefined) };
};
