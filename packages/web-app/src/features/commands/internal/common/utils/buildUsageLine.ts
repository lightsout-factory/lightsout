import { spellFlag } from '@lightsout/engine/commands';
import type { CommandCatalogEntry, CommandInvocation } from '@lightsout/engine/contracts';

interface Params {
	entry: CommandCatalogEntry;
	invocation: CommandInvocation;
}

/**
 * A line a reader can paste and fill in: the command word, the shape's own
 * words, then every flag that shape requires. Optional flags stay in the flag
 * list below it, so the line never grows a bracketed grammar of its own.
 */
export const buildUsageLine = ({ entry, invocation }: Params): string => {
	const required = entry.flags.filter((flag) => flag.required && (flag.shape === undefined || flag.shape === invocation.id));

	return [entry.cli ?? entry.slash ?? entry.id, invocation.positional, ...required.map((flag) => spellFlag({ flag }))]
		.filter((word) => word !== undefined)
		.join(' ');
};
