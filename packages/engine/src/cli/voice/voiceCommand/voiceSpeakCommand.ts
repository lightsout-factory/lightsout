import { getSpokenPickerText } from '#src/voice/getSpokenPickerText.ts';
import { getSpokenTurnQuestion } from '#src/voice/getSpokenTurnQuestion.ts';
import { isVoiceOn } from '#src/voice/isVoiceOn.ts';
import { speakText } from '#src/voice/speakText.ts';

export type VoiceSpeakKind = 'turn' | 'picker';

interface Params {
	cwd: string;
	kind: VoiceSpeakKind;
	/** The event payload as JSON: the ask tool's input for `picker`, the final message's content blocks for `turn`. */
	input: string;
}

/** Swallows every failure, because an extension-side error surfaces in the user's own session. */
export const voiceSpeakCommand = async ({ cwd, kind, input }: Params): Promise<void> => {
	try {
		if (process.platform !== 'darwin') {
			return;
		}

		if (!(await isVoiceOn({ cwd }))) {
			return;
		}

		let payload: unknown;

		try {
			payload = JSON.parse(input);
		} catch {
			return;
		}

		const text = kind === 'picker' ? getSpokenPickerText({ toolInput: payload }) : getSpokenTurnQuestion({ blocks: payload });

		if (text === undefined) {
			return;
		}

		await speakText({ cwd, text });
	} catch {
		// Silence is the contract: a broken read-out must never break the session.
	}
};
