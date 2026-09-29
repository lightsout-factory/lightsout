import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';

interface Params {
	flags: Map<string, string | true>;
	name: string;
}

/**
 * A flag present but naming nothing (`--phase ,`) is `[]`, not `undefined`, so a
 * caller that must refuse an empty request can tell it from an absent flag.
 *
 * Comma-separated rather than repeated, because `parseFlags` keeps one value per
 * name and a second `--phase 3` would overwrite the first.
 */
export const getListFlag = ({ flags, name }: Params): string[] | undefined => {
	if (!flags.has(name)) {
		return undefined;
	}

	return (getStringFlag({ flags, name }) ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
};
