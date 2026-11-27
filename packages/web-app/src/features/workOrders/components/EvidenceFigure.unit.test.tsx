import { describe, expect, test } from '@jest/globals';
import { EvidenceCount, EvidenceProvenance } from '@lightsout/engine/contracts';
import { render, screen } from '@testing-library/react';
import { EvidenceFigure } from '#src/features/workOrders/components/EvidenceFigure.tsx';

/** Parsed through the engine's own contract, so the figure is shaped as the reader hands it over. */
const setupEvidenceFigure = ({ provenance }: { provenance: EvidenceProvenance }) => {
	const count = EvidenceCount.parse({ value: 7, provenance });
	render(<EvidenceFigure label="Standards findings fixed" count={count} />);
};

const tickCases = [
	{ provenance: EvidenceProvenance.Measured, ticked: true },
	{ provenance: EvidenceProvenance.Reported, ticked: false },
];

describe('EvidenceFigure', () => {
	test.each(tickCases)('shows a tick only for a measured figure', ({ provenance, ticked }) => {
		setupEvidenceFigure({ provenance });

		const drawn = {
			label: screen.queryByText('Standards findings fixed') !== null,
			value: screen.queryByText('7') !== null,
			tick: screen.queryByLabelText('measured') !== null,
		};

		expect(drawn).toEqual({ label: true, value: true, tick: ticked });
	});
});
