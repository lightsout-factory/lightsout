import type { z } from 'zod';

const customTestKey = /^test-[a-z0-9]+(-[a-z0-9]+)*$/;

interface Params {
	gates: Record<string, unknown>;
	/** The block's fixed keys — everything else in it must be a custom `test-*` suite. */
	knownGateKeys: Set<string>;
	/** The block's own wording for a key it does not recognise; it names the keys that block accepts. */
	unknownKeyMessage: ({ key }: { key: string }) => string;
	ctx: z.RefinementCtx;
}

/** The key set of a gate block is closed, because a silently dropped gate is a suite that never runs. */
export const validateCustomTestGates = ({ gates, knownGateKeys, unknownKeyMessage, ctx }: Params): string[] => {
	const commands: string[] = [];

	for (const [key, value] of Object.entries(gates)) {
		if (knownGateKeys.has(key)) {
			continue;
		}

		if (!customTestKey.test(key)) {
			ctx.addIssue({ code: 'custom', message: unknownKeyMessage({ key }) });
		} else if (typeof value !== 'string') {
			ctx.addIssue({ code: 'custom', message: `custom test gate '${key}' must be a full shell command string` });
		} else {
			commands.push(value);
		}
	}

	return commands;
};
