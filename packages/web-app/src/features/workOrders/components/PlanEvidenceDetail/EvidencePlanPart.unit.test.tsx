import { describe, expect, test } from '@jest/globals';
import { EvidenceProvenance, EvidenceSectionState, GradeFindingStatus, type PlanEvidence } from '@lightsout/engine/contracts';
import { render } from '@testing-library/react';
import { EvidencePlanPart } from '#src/features/workOrders/components/PlanEvidenceDetail/EvidencePlanPart.tsx';

type PlanSection = NonNullable<PlanEvidence['plan']>;

const measured = (value: number) => ({ value, provenance: EvidenceProvenance.Measured });

const reported = (value: number) => ({ value, provenance: EvidenceProvenance.Reported });

const gradePass = ({ gradedAt, grade }: { gradedAt: string; grade: string }) => ({
	gradedAt,
	grade,
	gaps: reported(0),
	structural: measured(0),
	provenance: EvidenceProvenance.Reported,
});

const setupEvidencePlanPart = ({ plan = {} }: { plan?: Partial<PlanSection> } = {}) => {
	const section: PlanSection = {
		state: EvidenceSectionState.Finished,
		gradePasses: [],
		findingsByStatus: [],
		...plan,
	};
	render(<EvidencePlanPart plan={section} />);
};

describe('EvidencePlanPart', () => {
	test('lists grading passes and questions asked against answered without you', () => {
		setupEvidencePlanPart({
			plan: {
				gradePasses: [gradePass({ gradedAt: '2026-01-01T00:01:00.000Z', grade: 'below-A' }), gradePass({ gradedAt: '2026-01-01T00:06:00.000Z', grade: 'A' })],
				questionsAsked: measured(1),
				answeredWithoutUser: measured(2),
			},
		});

		const text = document.body.textContent ?? '';

		expect(text).toMatch(/Pass 1\D*below-A/);
		expect(text).toMatch(/Pass 2\D*Grade A/);
		expect(text).toMatch(/Questions asked of you\D*1/);
		expect(text).toMatch(/Answered without you\D*2/);
	});

	test('states a plan never graded, and shows grader findings by status and the paths and scripts checked', () => {
		setupEvidencePlanPart({
			plan: {
				findingsByStatus: [{ status: GradeFindingStatus.Noted, count: reported(3) }],
				pathsChecked: measured(12),
				pathsMissing: measured(1),
				scriptsChecked: measured(4),
				scriptsMissing: measured(0),
			},
		});

		const text = document.body.textContent ?? '';

		expect({
			noPasses: /No grading passes/i.test(text),
			findings: /noted\D*3(?!\d)/.test(text),
			pathsChecked: /Paths checked\D*12(?!\d)/.test(text),
			pathsMissing: /Paths missing\D*1(?!\d)/.test(text),
			scriptsChecked: /Scripts checked\D*4(?!\d)/.test(text),
			scriptsMissing: /Scripts missing\D*0(?!\d)/.test(text),
			questions: /Questions asked of you|Answered without you/.test(text),
		}).toStrictEqual({
			noPasses: true,
			findings: true,
			pathsChecked: true,
			pathsMissing: true,
			scriptsChecked: true,
			scriptsMissing: true,
			questions: false,
		});
	});
});
