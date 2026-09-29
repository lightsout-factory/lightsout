import type { ReactNode } from 'react';
import { ShowcaseWindow } from '#src/features/home/screens/Home/internal/components/CleansAsItCodesSection/internal/components/ShowcaseWindow.tsx';
import { useLoopingStep } from '#src/features/home/screens/Home/internal/hooks/useLoopingStep.ts';

interface Props<TFrame> {
	title: string;
	/** The last is what a reader who asked for less motion sees. */
	frames: TFrame[];
	stepMs: number;
	renderFrame: (frame: TFrame) => ReactNode;
	/** Called when the last frame has held its full time. Given, the scene stays on its last frame for the caller to move on; left out, it loops. */
	onFinish?: () => void;
}

export const LoopingScene = <TFrame,>({ title, frames, stepMs, renderFrame, onFinish }: Props<TFrame>) => {
	const step = useLoopingStep({ stepCount: frames.length, stepMs, onFinish });

	return <ShowcaseWindow title={title}>{renderFrame(frames[step])}</ShowcaseWindow>;
};
