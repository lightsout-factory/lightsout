import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '#src/features/home/screens/Home/internal/hooks/usePrefersReducedMotion.ts';

interface Params {
	stepCount: number;
	stepMs: number;
	/** Called when the last frame has held its full time. Given, the animation stays on its last frame for the caller to move on; left out, it loops back to the start. */
	onFinish?: () => void;
}

/**
 * The same timer decides the end, so nothing that moves on afterwards races a
 * second clock.
 *
 * A reader who asked for less motion gets only the last frame: every animation
 * here ends on its finished state, the one frame that still tells the story.
 */
export const useLoopingStep = ({ stepCount, stepMs, onFinish }: Params): number => {
	const prefersReduced = usePrefersReducedMotion();
	const [step, setStep] = useState(0);
	const stepRef = useRef(0);
	// The latest listener, read when the timer fires, so a caller passing a new
	// function does not restart the animation.
	const onFinishRef = useRef(onFinish);

	useEffect(() => {
		onFinishRef.current = onFinish;
	});

	useEffect(() => {
		if (prefersReduced) {
			setStep(stepCount - 1);

			return;
		}

		const timer = setInterval(() => {
			const next = stepRef.current + 1;

			if (next < stepCount) {
				stepRef.current = next;
				setStep(next);
			} else if (onFinishRef.current === undefined) {
				stepRef.current = 0;
				setStep(0);
			} else {
				onFinishRef.current();
			}
		}, stepMs);

		return () => clearInterval(timer);
	}, [prefersReduced, stepCount, stepMs]);

	return step;
};
