/** Which event a read-out answers: the end of a turn, or a picker the user must choose from. */
export const VoiceSpeakKind = {
	Turn: 'turn',
	Picker: 'picker',
} as const;

export type VoiceSpeakKind = (typeof VoiceSpeakKind)[keyof typeof VoiceSpeakKind];
