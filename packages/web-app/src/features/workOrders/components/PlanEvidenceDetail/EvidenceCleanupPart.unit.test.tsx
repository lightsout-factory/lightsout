import { describe, expect, test } from '@jest/globals';
import type { PlanEvidence } from '@lightsout/engine/contracts';
import { EvidenceProvenance, EvidenceSectionState } from '@lightsout/engine/contracts';
import { render, screen } from '@testing-library/react';
import { EvidenceCleanupPart } from '#src/features/workOrders/components/PlanEvidenceDetail/EvidenceCleanupPart.tsx';

type Cleanup = NonNullable<PlanEvidence['cleanup']>;

type Standards = NonNullable<Cleanup['standards']>;

const measured = (value: number) => ({ value, provenance: EvidenceProvenance.Measured });

const fixedFinding = { rule: 'acme/max-nesting', files: ['src/ranking/sortByAge.ts'], provenance: EvidenceProvenance.Measured };

const remainingFinding = { rule: 'acme/no-magic-numbers', files: ['src/ranking/scoreResult.ts'], provenance: EvidenceProvenance.Measured };

const hit = { symbol: 'sortByAge', searches: ['sortByAge'], matches: ['src/ranking/sortByDate.ts'], provenance: EvidenceProvenance.Reported };

const miss = { symbol: 'scoreResult', searches: ['scoreResult'], matches: [], provenance: EvidenceProvenance.Reported };

const buildStandards = (overrides: Partial<Standards> = {}): Standards => ({
	state: EvidenceSectionState.Finished,
	found: measured(0),
	fixed: [],
	remaining: [],
	carried: measured(0),
	reviewFindings: { value: 0, provenance: EvidenceProvenance.Reported },
	...overrides,
});

const buildCleanup = (overrides: Partial<Cleanup> = {}): Cleanup => ({
	state: EvidenceSectionState.Finished,
	searches: [],
	...overrides,
});

const setupEvidenceCleanupPart = ({ cleanup }: { cleanup: Cleanup }) => {
	render(<EvidenceCleanupPart cleanup={cleanup} />);
};

const neverRanOrEmptyCases = [
	{
		cleanup: buildCleanup({ searches: [hit] }),
		expected: { notRun: true, nothingHanded: false, measuredTicks: 0 },
	},
	{
		cleanup: buildCleanup({ standards: buildStandards() }),
		expected: { notRun: false, nothingHanded: true, measuredTicks: expect.any(Number) },
	},
];

describe('EvidenceCleanupPart', () => {
	test('lists fixed and remaining findings and searches with misses, never worded as reuse', () => {
		setupEvidenceCleanupPart({
			cleanup: buildCleanup({
				standards: buildStandards({ found: measured(2), fixed: [fixedFinding], remaining: [remainingFinding] }),
				searches: [hit, miss],
			}),
		});

		const text = document.body.textContent ?? '';

		expect({
			findings:
				/Fixed[\s\S]*acme\/max-nesting[\s\S]*src\/ranking\/sortByAge\.ts[\s\S]*Remaining[\s\S]*acme\/no-magic-numbers[\s\S]*src\/ranking\/scoreResult\.ts/.test(
					text,
				),
			hit: /Searched[\s\S]*sortByAge[\s\S]*—\s*found[\s\S]*src\/ranking\/sortByDate\.ts/.test(text),
			miss: /Searched[\s\S]*scoreResult[\s\S]*—\s*found nothing/.test(text),
			reuse: /reuse/i.test(text),
		}).toStrictEqual({ findings: true, hit: true, miss: true, reuse: false });
	});

	test.each(neverRanOrEmptyCases)('tells a cleanup that never ran from one that found nothing', ({ cleanup, expected }) => {
		setupEvidenceCleanupPart({ cleanup });

		const text = document.body.textContent ?? '';

		expect({
			notRun: /Cleanup has not run/.test(text),
			nothingHanded: /No blocking findings handed to cleanup/.test(text),
			measuredTicks: screen.queryAllByLabelText('measured').length,
		}).toStrictEqual(expected);
	});

	test('marks a cleanup still running as in progress, never as one handed nothing', () => {
		setupEvidenceCleanupPart({ cleanup: buildCleanup({ standards: buildStandards({ state: EvidenceSectionState.InProgress }) }) });

		const text = document.body.textContent ?? '';

		expect({ inProgress: screen.queryAllByText('In progress').length, nothingHanded: /No blocking findings/.test(text) }).toStrictEqual({
			inProgress: 1,
			nothingHanded: false,
		});
	});

	test('draws no found or fixed figure for a cleanup record that predates the targeted findings', () => {
		setupEvidenceCleanupPart({ cleanup: buildCleanup({ standards: buildStandards({ found: undefined, remaining: [remainingFinding] }) }) });

		const text = document.body.textContent ?? '';

		expect({
			found: /Standards findings found/.test(text),
			fixed: /Standards findings fixed/.test(text),
			remaining: /Remaining[\s\S]*acme\/no-magic-numbers/.test(text),
		}).toStrictEqual({ found: false, fixed: false, remaining: true });
	});

	test('shows the duplicates the duplicate check found', () => {
		setupEvidenceCleanupPart({ cleanup: buildCleanup({ duplicates: { value: 2, provenance: EvidenceProvenance.Reported } }) });

		const text = document.body.textContent ?? '';

		expect(text).toMatch(/Duplicates\D*2(?!\d)/);
	});
});
