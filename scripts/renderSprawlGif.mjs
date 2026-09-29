import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import gifenc from 'gifenc';
import { buildSprawlFrameSchedule } from '../packages/web-app/src/features/sprawl/common/rendering/buildSprawlFrameSchedule.ts';
import { buildSprawlLaneStates } from '../packages/web-app/src/features/sprawl/common/rendering/buildSprawlLaneStates.ts';
import { getSprawlMaxLines } from '../packages/web-app/src/features/sprawl/common/rendering/getSprawlMaxLines.ts';
import { invokedDirectly } from './invokedDirectly.mjs';
import { renderSprawlSvg } from './renderSprawlSvg.mjs';
import { runScript } from './runScript.mjs';

/**
 * Colours are hex literals here because a Node script writing pixels cannot
 * resolve a Tailwind token.
 *
 * An author-built committed artefact that CI never rebuilds, so fonts from the
 * author's machine are fine.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The light one is the README's `<img>` fallback, the dark one its dark-scheme `<source>`. */
const themes = [
	{ file: 'sprawl.gif', ground: '#0d1524', barFrom: '#35d6e8', barTo: '#b06bf5', muted: '#d3dfef', mutedOpacity: 0.4, overCap: '#e5484d', text: '#d3dfef' },
	{
		file: 'sprawl-light.gif',
		ground: '#f6f8fb',
		barFrom: '#0e93ad',
		barTo: '#7c3aed',
		muted: '#1f2937',
		mutedOpacity: 0.4,
		overCap: '#c62a2f',
		text: '#374151',
	},
];

/** A README image has a weight limit in practice. */
const maxBytes = 3 * 1024 * 1024;

/**
 * Evenly spaced, but never dropping a refactor marker: a marker is where a move
 * happens, and dropping one would show the outcome with the cause edited out.
 */
const sampleFrames = ({ frames, target }) => {
	if (frames.length <= target) {
		return frames.map((_unused, index) => index);
	}

	const kept = new Set([0, frames.length - 1]);

	frames.forEach((frame, index) => {
		if (frame.isRefactorMarker) {
			kept.add(index);
		}
	});

	for (let step = 0; step < target && kept.size < target; step += 1) {
		kept.add(Math.round((step * (frames.length - 1)) / (target - 1)));
	}

	return [...kept].sort((left, right) => left - right);
};

const rasterise = ({ svg, width }) => {
	const rendered = new Resvg(svg, {
		fitTo: { mode: 'width', value: width },
		font: { loadSystemFonts: true, defaultFontFamily: 'JetBrains Mono' },
		logLevel: 'error',
	}).render();

	return { pixels: rendered.pixels, width: rendered.width, height: rendered.height };
};

/**
 * One global palette rather than one per frame: a local table would add a
 * kilobyte a frame for colours that never change.
 */
const encodeGif = ({ dataset, theme, width, kept, schedule }) => {
	const { GIFEncoder, quantize, applyPalette } = gifenc;
	const states = {
		with: buildSprawlLaneStates({ dataset, lane: 'with' }),
		without: buildSprawlLaneStates({ dataset, lane: 'without' }),
	};
	const maxLines = getSprawlMaxLines({ dataset });
	const last = dataset.frames[dataset.frames.length - 1];
	const counter = { without: last.without.overCap, real: last.with.overCap };
	const draw = ({ index }) => {
		const frame = dataset.frames[kept[index]];
		const svg = renderSprawlSvg({
			withState: states.with[kept[index]],
			withoutState: states.without[kept[index]],
			maxLines,
			caps: dataset.caps,
			frame,
			counter,
			theme,
			width,
		});

		return rasterise({ svg, width });
	};

	const sample = [0, Math.floor(kept.length / 3), Math.floor((kept.length * 2) / 3), kept.length - 1].map((index) => draw({ index }));
	const palette = quantize(Buffer.concat(sample.map(({ pixels }) => pixels)), 256);
	const gif = GIFEncoder();
	const { height } = sample[0];
	let drawnIndex = -1;
	let indexed;

	schedule.forEach((index, position) => {
		if (index !== drawnIndex) {
			indexed = applyPalette(draw({ index }).pixels, palette);
			drawnIndex = index;
		}

		// 83 ms is twelve frames a second.
		gif.writeFrame(indexed, width, height, position === 0 ? { palette, delay: 83, repeat: 0 } : { delay: 83 });
	});

	gif.finish();

	return { bytes: gif.bytes(), height };
};

export const renderSprawlGif = ({ log = console.log } = {}) => {
	const dataset = JSON.parse(readFileSync(join(repoRoot, 'assets', 'sprawl-dataset.json'), 'utf8'));
	const kept = sampleFrames({ frames: dataset.frames, target: 120 });
	const frames = kept.map((index) => dataset.frames[index]);
	// The last frame is held so a reader lands on the outcome.
	const schedule = [...buildSprawlFrameSchedule({ frames }), ...Array.from({ length: 24 }, () => kept.length - 1)];

	log(`sampled ${kept.length} of ${dataset.frames.length} frames, ${frames.filter((frame) => frame.isRefactorMarker).length} of them refactor markers`);
	log(`encoding ${schedule.length} frames at 12 fps`);

	for (const width of [1200, 800]) {
		const written = themes.map((theme) => ({ theme, ...encodeGif({ dataset, theme, width, kept, schedule }) }));
		const over = written.filter(({ bytes }) => bytes.length > maxBytes);

		for (const { theme, bytes, height } of written) {
			log(`${theme.file}: ${width} × ${height}, ${(bytes.length / 1024 / 1024).toFixed(2)} MB${bytes.length > maxBytes ? ' — over the 3 MB budget' : ''}`);
		}

		if (over.length === 0) {
			for (const { theme, bytes } of written) {
				writeFileSync(join(repoRoot, 'assets', theme.file), bytes);
			}

			return written.map(({ theme, bytes }) => ({ file: theme.file, bytes: bytes.length }));
		}

		// Both are re-rendered, never just the heavy one: the README pairs them in
		// one `<picture>`, and different sizes would jump on a colour-scheme switch.
		log(`${over.length} render(s) over budget at ${width} px — falling back to the smaller pair`);
	}

	throw new Error('both renders exceed the 3 MB budget even at 800 × 420 — cut frames rather than commit a README image that large');
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	runScript({ run: renderSprawlGif });
}
