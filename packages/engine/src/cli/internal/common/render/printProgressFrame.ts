import type { RunProgress } from '#src/views/common/types/RunProgress.ts';

interface Params {
	progress: RunProgress;
	lines: string[];
}

/**
 * A frame is appended and nothing clears the screen, because a chat transcript
 * relaying this stdout would show a clear-screen sequence as noise.
 *
 * @returns the progress the lines were drawn from, so a caller decides what to do next from exactly what it showed
 */
export const printProgressFrame = ({ progress, lines }: Params): RunProgress => {
	console.log('');

	for (const line of lines) {
		console.log(line);
	}

	return progress;
};
