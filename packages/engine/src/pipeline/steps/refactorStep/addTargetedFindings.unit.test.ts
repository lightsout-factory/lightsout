import { describe, expect, test } from '@jest/globals';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { addTargetedFindings } from '#src/pipeline/steps/refactorStep/addTargetedFindings.ts';

/** One blocking finding at `siteKey`; `detail` tells two findings that share a site apart. */
const findingAt = ({ siteKey, detail }: { siteKey: string; detail: string }): StandardsFinding => ({
	rule: 'acme/max-nesting',
	severity: StandardsSeverity.Blocking,
	siteKey,
	files: [{ path: `packages/app/src/${siteKey}.ts` }],
	detail,
});

/** Targeted [a, b] and a work list [b, c, c'] where c' shares c's site, with copies taken before the call. */
const setupTargeted = () => {
	const a = findingAt({ siteKey: 'a', detail: 'site a' });
	const b = findingAt({ siteKey: 'b', detail: 'site b' });
	const c = findingAt({ siteKey: 'c', detail: 'site c, first seen' });
	const cAgain = findingAt({ siteKey: 'c', detail: 'site c, seen again' });
	const targeted = [a, b];
	const findings = [b, c, cAgain];

	return { a, b, c, cAgain, targeted, findings };
};

describe('addTargetedFindings', () => {
	test('addTargetedFindings: appends only findings whose siteKey is new, first one wins, inputs untouched', () => {
		const { a, b, c, cAgain, targeted, findings } = setupTargeted();

		const answer = addTargetedFindings({ targeted, findings });

		expect({ answer, targeted, findings }).toStrictEqual({
			answer: [a, b, c],
			targeted: [a, b],
			findings: [b, c, cAgain],
		});
	});
});
