/** One exported name no production file references, and what still reaches it. */
export interface UnconsumedExport {
	file: string;
	name: string;
	/** What mentions it elsewhere. No source file does, or it would not be unconsumed. */
	reachedBy: {
		test: boolean;
	};
}
