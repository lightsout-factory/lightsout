export interface ResolvedStandards {
	standards?: string;
	testStandards?: string;
	channels: string[];
	/** True when the channels came from config rather than dependency detection. */
	configured: boolean;
	/** Some standards were asked for — false when the consumer loaded no packages. */
	requested: boolean;
}
