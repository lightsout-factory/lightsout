import { getCommandCatalogEntry } from '#src/commands/getCommandCatalogEntry.ts';

interface Params {
	command: string;
}

/**
 * Unioned across the command's invocation shapes. Read from the command catalog,
 * which the usage text also renders from, so a flag works exactly when `--help`
 * says it does.
 */
export const readCommandFlags = ({ command }: Params): Set<string> => {
	const entry = getCommandCatalogEntry({ id: command });

	// --cwd is read by the dispatcher, before it knows which command it holds.
	return new Set(['cwd', ...(entry?.flags.map((flag) => flag.name) ?? [])]);
};
