import type { Driver } from '#src/common/types/Driver.ts';
import { createClaudeCodeDriver } from '#src/drivers/getDriver/createClaudeCodeDriver/createClaudeCodeDriver.ts';
import { createCodexDriver } from '#src/drivers/getDriver/createCodexDriver/createCodexDriver.ts';
import { createOmpDriver, createPiDriver } from '#src/drivers/getDriver/createPiDriver/createPiDriver.ts';

interface Params {
	name: string;
}

/** Resume reconstructs the driver from the manifest's recorded name, so an unknown name is an error, never a silent fallback. */
export const getDriver = ({ name }: Params): Driver => {
	if (name === 'claude-code') {
		return createClaudeCodeDriver();
	}

	if (name === 'codex') {
		return createCodexDriver();
	}

	if (name === 'omp') {
		return createOmpDriver();
	}

	if (name === 'pi') {
		return createPiDriver();
	}

	throw new Error(`unknown driver: ${name} (available: claude-code, codex, omp, pi)`);
};
