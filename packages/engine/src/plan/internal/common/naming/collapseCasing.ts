interface Params {
	name: string;
}

/**
 * Two names identical up to casing/separators (`GetStarted` vs `get-started`)
 * are a framework pair, not a synonym clash.
 */
export const collapseCasing = ({ name }: Params): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');
