import { sprawlUnitBox } from '../packages/web-app/src/features/sprawl/common/constants/sprawlUnitBox.ts';
import { buildSprawlLayout } from '../packages/web-app/src/features/sprawl/common/rendering/buildSprawlLayout.ts';

/** `&`, `<` and `>` in a commit subject would otherwise close the tag they sit in. */
const escapeText = ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const mixHex = ({ from, to, at }) => {
	const parse = ({ hex }) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
	const [left, right] = [parse({ hex: from }), parse({ hex: to })];
	const channel = (value, index) =>
		Math.round(value + (right[index] - value) * at)
			.toString(16)
			.padStart(2, '0');

	return `#${left.map(channel).join('')}`;
};

/** Rounded to two places so two runs of this script write the same bytes. */
const rect = ({ x, y, width, height, fill, opacity = 1 }) =>
	`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="${fill}" fill-opacity="${opacity}"/>`;

const line = ({ x1, y1, x2, y2, theme, scale }) =>
	`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"` +
	` stroke="${theme.muted}" stroke-opacity="${theme.mutedOpacity}" stroke-width="${(scale * 0.15).toFixed(2)}"/>`;

/**
 * The baseline is placed by hand because `dominant-baseline` support varies
 * between renderers.
 */
const text = ({ centre, top, band, size, family, weight, fill, opacity = 1, content }) =>
	`<text x="${centre}" y="${(top + band / 2 + size * 0.35).toFixed(0)}" text-anchor="middle" font-family="${family}"` +
	` font-weight="${weight}" font-size="${size}" fill="${fill}" fill-opacity="${opacity}">${content}</text>`;

/**
 * Bars follow the brand gradient here, while the page deliberately stays on one
 * theme token: the GIF is the brand artefact the README opens with.
 */
const renderLane = ({ state, maxLines, caps, theme, scale, top }) => {
	const layout = buildSprawlLayout({ state, maxLines, caps, ...sprawlUnitBox });
	const parts = [];

	layout.bars.forEach((bar, index) => {
		const along = layout.bars.length < 2 ? 0 : index / (layout.bars.length - 1);
		const fill = bar.overCap ? theme.overCap : mixHex({ from: theme.barFrom, to: theme.barTo, at: along });

		parts.push(rect({ x: bar.x * scale, y: bar.y * scale + top, width: bar.width * scale, height: bar.height * scale, fill }));
	});

	const capY = layout.capY * scale + top;

	parts.push(line({ x1: 0, y1: capY, x2: sprawlUnitBox.width * scale, y2: capY, theme, scale }));

	for (const row of layout.folderRows) {
		for (const square of row.squares) {
			const fill = row.overCap ? theme.overCap : theme.muted;
			const opacity = row.overCap ? 1 : theme.mutedOpacity;
			const size = square.size * scale;

			parts.push(rect({ x: square.x * scale, y: square.y * scale + top, width: size, height: size, fill, opacity }));
		}
	}

	const censusX = layout.censusX * scale;
	const censusY = layout.censusY * scale + top;

	parts.push(line({ x1: censusX, y1: censusY, x2: censusX, y2: sprawlUnitBox.height * scale + top, theme, scale }));

	return parts.join('');
};

/**
 * The caption labels the two lanes, so the README never shows the
 * counterfactual unlabelled.
 *
 * @param counter - the LAST frame's over-cap counts, as `{ without, real }`: the claim is where the histories end up
 */
export const renderSprawlSvg = ({ withState, withoutState, maxLines, caps, frame, counter, theme, width }) => {
	const scaleBand = width / 1200;
	const scale = width / sprawlUnitBox.width;
	const lane = sprawlUnitBox.height * scale;
	const [caption, gap, subject, payoff] = [40, 20, 40, 50].map((size) => Math.round(size * scaleBand));
	const height = caption + lane * 2 + gap + subject + payoff;
	const centre = width / 2;
	const sans = 'Plus Jakarta Sans, sans-serif';
	const stops = `<stop offset="0" stop-color="${theme.barFrom}"/><stop offset="1" stop-color="${theme.barTo}"/>`;

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		`<defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>`,
		rect({ x: 0, y: 0, width, height, fill: theme.ground }),
		text({
			centre,
			top: 0,
			band: caption,
			size: Math.round(20 * scaleBand),
			family: sans,
			weight: 500,
			fill: theme.text,
			content: 'Top: the same commits with every split undone. Bottom: what actually happened.',
		}),
		renderLane({ state: withoutState, maxLines, caps, theme, scale, top: caption }),
		renderLane({ state: withState, maxLines, caps, theme, scale, top: caption + lane + gap }),
		text({
			centre,
			top: caption + lane * 2 + gap,
			band: subject,
			size: Math.round(18 * scaleBand),
			family: 'JetBrains Mono, monospace',
			weight: 400,
			fill: theme.muted,
			opacity: theme.mutedOpacity,
			content: escapeText({ text: `${frame.sha} · ${frame.at} · ${frame.subject}` }),
		}),
		text({
			centre,
			top: caption + lane * 2 + gap + subject,
			band: payoff,
			size: Math.round(26 * scaleBand),
			family: sans,
			weight: 600,
			fill: theme.text,
			content: `files over cap: ${counter.without} → <tspan fill="url(#brand)">${counter.real}</tspan>`,
		}),
		'</svg>',
	].join('');
};
