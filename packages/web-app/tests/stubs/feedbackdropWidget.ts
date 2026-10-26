interface FeedbackDropConfig {
	apiKey?: string;
	theme?: string;
}

/**
 * A stand-in for `@feedbackdropai/widget`.
 *
 * The real widget injects its own UI and calls FeedbackDrop's servers when it
 * mounts, and every test that renders the root route would mount it. What it
 * does once mounted is FeedbackDrop's contract, proved by the build and by the
 * app running. What this app owns is the config it hands over and that it
 * mounts and unmounts the widget, so the stub records exactly that.
 */
export class FeedbackDrop {
	static readonly instances: FeedbackDrop[] = [];

	readonly config: FeedbackDropConfig;
	isMounted = false;

	constructor(config: FeedbackDropConfig) {
		this.config = config;
		FeedbackDrop.instances.push(this);
	}

	mount = async () => {
		this.isMounted = true;
	};

	unmount = () => {
		this.isMounted = false;
	};
}

export const Theme = { Light: 'light', Dark: 'dark', Auto: 'auto' } as const;
