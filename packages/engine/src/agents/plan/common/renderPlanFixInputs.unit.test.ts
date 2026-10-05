import { describe, expect, test } from '@jest/globals';
import { renderPlanFixInputs } from '#src/agents/plan/common/renderPlanFixInputs.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

const setupFindings = (): { findings: StructuralFinding[] } => ({
	findings: [
		{
			check: 'no-placeholders',
			severity: 'blocking',
			phase: 'plan.md',
			issue: 'unresolved TBD marker',
			location: 'Files to Create',
			fix: 'resolve the TBD from the verified facts',
		},
		{
			check: 'sections-present',
			severity: 'blocking',
			phase: 'plan.md',
			issue: 'Verification section missing',
			location: 'end of plan',
			fix: 'add a ## Verification section',
		},
	],
});

describe('renderPlanFixInputs', () => {
	test('each finding is one bullet naming its check, place and issue, with its fix on the line below', () => {
		const { findings } = setupFindings();

		const { findingList } = renderPlanFixInputs({ findings, decisionsPath: '/tmp/decisions.json', factsPath: '/tmp/facts.json' });

		expect(findingList).toBe(
			'- [no-placeholders] Files to Create — unresolved TBD marker\n  fix: resolve the TBD from the verified facts\n- [sections-present] end of plan — Verification section missing\n  fix: add a ## Verification section',
		);
	});

	test('the reference files are the decisions record and the verified facts', () => {
		const { findings } = setupFindings();

		const { referenceList } = renderPlanFixInputs({ findings, decisionsPath: '/tmp/decisions.json', factsPath: '/tmp/facts.json' });

		expect(referenceList).toBe('- Decisions record: /tmp/decisions.json\n- Verified facts: /tmp/facts.json');
	});

	test('the brainstorm decisions are listed between the two when the workspace has them', () => {
		const { findings } = setupFindings();

		const { referenceList } = renderPlanFixInputs({
			findings,
			decisionsPath: '/tmp/decisions.json',
			brainstormDecisionsPath: '/tmp/brainstorm-decisions.json',
			factsPath: '/tmp/facts.json',
		});

		expect(referenceList).toBe(
			'- Decisions record: /tmp/decisions.json\n- Brainstorm decisions (settled during brainstorm, before planning began): /tmp/brainstorm-decisions.json\n- Verified facts: /tmp/facts.json',
		);
	});
});
