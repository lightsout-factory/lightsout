import { useEffect, useState } from 'react';

/** Read in an effect, so the server render and the first client render agree: both assume motion. */
export const usePrefersReducedMotion = (): boolean => {
	const [prefersReduced, setPrefersReduced] = useState(false);

	useEffect(() => {
		if (typeof globalThis.matchMedia === 'function') {
			setPrefersReduced(globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
		}
	}, []);

	return prefersReduced;
};
