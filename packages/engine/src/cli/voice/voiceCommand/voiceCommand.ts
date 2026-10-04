import { getPositionals } from '#src/cli/common/args/getPositionals.ts';
import { getStreamText } from '#src/cli/voice/voiceCommand/getStreamText.ts';
import { voiceHookCommand } from '#src/cli/voice/voiceCommand/voiceHookCommand.ts';
import { voiceOffCommand } from '#src/cli/voice/voiceCommand/voiceOffCommand.ts';
import { voiceOnCommand } from '#src/cli/voice/voiceCommand/voiceOnCommand.ts';
import { voiceSpeakCommand } from '#src/cli/voice/voiceCommand/voiceSpeakCommand.ts';
import { usage } from '#src/common/constants/usage.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';

export const voiceCommand = async ({ rest, cwd }: CommandContext): Promise<void> => {
	const subcommand = getPositionals({ args: rest })[0];

	if (subcommand === 'on') {
		await voiceOnCommand({ cwd });
		return;
	}

	if (subcommand === 'off') {
		await voiceOffCommand({ cwd });
		return;
	}
	if (subcommand === 'hook') {
		// A hook context always pipes its payload in. Run by hand in a terminal
		// there is no payload coming, and waiting on a keyboard would hang forever.
		const input = process.stdin.isTTY ? '' : await getStreamText({ stream: process.stdin });

		await voiceHookCommand({ cwd, input });
		return;
	}

	if (subcommand === 'speak') {
		const kind = getPositionals({ args: rest })[1];

		if (kind !== 'turn' && kind !== 'picker') {
			console.error(usage);
			return exitCli({ code: 1 });
		}

		const input = process.stdin.isTTY ? '' : await getStreamText({ stream: process.stdin });

		await voiceSpeakCommand({ cwd, kind, input });
		return;
	}

	console.error(usage);
	return exitCli({ code: 1 });
};
