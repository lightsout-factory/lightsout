import type { CommandFlag } from '#src/contracts/commands/CommandFlag.ts';

interface Params {
	flag: CommandFlag;
}

/** Exported because the CLI's `--help` line and the web app's flag table must spell a flag the same way. */
export const spellFlag = ({ flag }: Params): string => (flag.value === undefined ? `--${flag.name}` : `--${flag.name} ${flag.value}`);
