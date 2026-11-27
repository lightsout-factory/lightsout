import { describe, expect, jest, test } from '@jest/globals';
import { type EvidenceHeadline, EvidenceProvenance } from '@lightsout/engine/contracts';
import { formatCost, formatDuration } from '@lightsout/shared';
import { render } from '@testing-library/react';
import { EvidenceHeadlineRow } from '#src/features/workOrders/components/EvidenceHeadlineRow.tsx';

const startedAt = '2026-11-27T10:00:00.000Z';

const measured = (value: number) => ({ value, provenance: EvidenceProvenance.Measured });

/** The clock is fixed so an unmerged headline's elapsed time is the same on every run. */
const setupEvidenceHeadlineRow = ({ headline, now }: { headline: EvidenceHeadline; now: string }) => {
	jest.useFakeTimers({ now: new Date(now) });
	render(<EvidenceHeadlineRow headline={headline} />);
};

const cases: { headline: EvidenceHeadline; now: string; shown: string[]; hidden: string[] }[] = [
	{
		headline: { startedAt, mergedAt: '2026-11-27T12:07:00.000Z' },
		now: '2026-11-27T15:00:00.000Z',
		shown: ['Plan to merge', formatDuration({ ms: 127 * 60_000 })],
		hidden: ['unmerged'],
	},
	{
		headline: { startedAt },
		now: '2026-11-27T10:30:00.000Z',
		shown: ['Elapsed so far (unmerged)', formatDuration({ ms: 30 * 60_000 })],
		hidden: ['Plan to merge'],
	},
	{
		headline: { recordedCostUsd: measured(5.5) },
		now: '2026-11-27T10:30:00.000Z',
		shown: ['Recorded cost', formatCost({ usd: 5.5 })],
		hidden: ['No evidence recorded yet.'],
	},
	{
		headline: {},
		now: '2026-11-27T10:30:00.000Z',
		shown: ['No evidence recorded yet.'],
		hidden: ['Plan to merge', 'Elapsed so far', 'Recorded cost'],
	},
];

describe('EvidenceHeadlineRow', () => {
	test.each(cases)('derives merged and unmerged time, labels recorded cost, and states an empty headline', ({ headline, now, shown, hidden }) => {
		setupEvidenceHeadlineRow({ headline, now });

		const text = document.body.textContent ?? '';

		expect({
			missing: shown.filter((expected) => !text.includes(expected)),
			unexpected: hidden.filter((absent) => text.includes(absent)),
		}).toStrictEqual({ missing: [], unexpected: [] });
	});

	test('labels the questions asked of you and the standards findings fixed', () => {
		setupEvidenceHeadlineRow({ headline: { questionsAsked: measured(2), findingsFixed: measured(3) }, now: '2026-11-27T10:30:00.000Z' });

		const text = document.body.textContent ?? '';

		expect({
			questions: /Questions asked of you\D*2(?!\d)/.test(text),
			fixed: /Standards findings fixed\D*3(?!\d)/.test(text),
			time: /Plan to merge|Elapsed so far/.test(text),
		}).toStrictEqual({ questions: true, fixed: true, time: false });
	});
});
