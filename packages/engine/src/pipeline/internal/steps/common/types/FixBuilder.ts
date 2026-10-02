/**
 * The builder steps choose which role repairs a checkpoint, and the checkpoint only calls what it is given.
 * Asynchronous because a repair's invocation may read the tree as it stands when the repair is spawned.
 */
export type FixBuilder = ({ errorContext }: { errorContext: string }) => Promise<{ systemPrompt: string; prompt: string }>;
