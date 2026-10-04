import { readCommandFlags } from '#src/cli/getUnknownFlagsMessage/readCommandFlags.ts';

interface Params {
	command: string;
	flags: Map<string, string | true>;
}

/** An unknown flag is a usage error, so a misspelt flag cannot quietly run a different command than the one asked for. */
export const getUnknownFlagsMessage = ({ command, flags }: Params): string | undefined => {
	const accepted = readCommandFlags({ command });
	const unknown = [...flags.keys()].filter((name) => !accepted.has(name));

	return unknown.length === 0
		? undefined
		: `lightsout ${command}: unknown flag${unknown.length > 1 ? 's' : ''} ${unknown.map((name) => `--${name}`).join(', ')}`;
};
