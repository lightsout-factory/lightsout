import type { GateCommands } from '#src/gates/common/types/GateCommands.ts';
import type { GateEntry } from '#src/gates/common/types/GateEntry.ts';

interface Params {
	/** The root block's finished commands, or a scoped block's `{package}` templates. */
	commands: GateCommands;
}

export const buildGateEntries = ({ commands }: Params): GateEntry[] => {
	const declared = [
		{ family: 'check', name: 'check', command: commands.check },
		{ family: 'test', name: 'test', command: commands.test },
		{ family: 'testCoverage', name: 'test-coverage', command: commands.testCoverage },
		...(commands.extraTests ?? []).map(({ name, command }) => ({ family: name, name, command })),
		{ family: 'build', name: 'build', command: commands.build },
	];

	return declared.flatMap(({ family, name, command }) => (command === undefined ? [] : [{ family, name, command }]));
};
