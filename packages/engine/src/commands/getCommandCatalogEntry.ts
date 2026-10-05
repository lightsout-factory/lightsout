import { commandCatalog } from '#src/commands/commandCatalog/commandCatalog.ts';
import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';

interface Params {
	/** The word after `lightsout`, or the `$command` route param. */
	id: string;
}

export const getCommandCatalogEntry = ({ id }: Params): CommandCatalogEntry | undefined => commandCatalog.find((entry) => entry.id === id);
