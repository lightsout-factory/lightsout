import { expect, test } from '@jest/globals';
import { getStandardsView } from '#src/views/getStandardsView.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { standardsViewFixtures } from '#tests/helpers/standardsViewFixtures.ts';

const { seedStandardsRepo, finding } = standardsViewFixtures;

test('refactor history is folded onto the rule whose sites a run attempted', async () => {
	const cwd = await seedStandardsRepo();
	const worklist = JSON.stringify({
		at: '2026-01-01T00:00:00.000Z',
		path: '.',
		all: false,
		batches: [{ id: 'batch-00:house-loose-file:src', rule: 'acme/house-loose-file', folder: 'src', blocking: [finding()], advisories: [] }],
	});

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-refactor',
			pipeline: 'refactor',
			plan: '.lightsout/runs/run-refactor/worklist.json',
			steps: [{ id: 'batch-00:house-loose-file:src', status: 'passed', attempts: 1, report: { outcome: 'resolved', remainingSiteKeys: [], rationale: [] } }],
		},
		worklist,
	});

	const view = await getStandardsView({ cwd });

	// the site was frozen and is gone afterwards, so it counts as resolved
	expect(view.rules[0]?.history).toStrictEqual({
		attempted: 1,
		resolved: 1,
		declined: 0,
		untracked: 0,
		adviceApplied: 0,
		adviceDeclined: 0,
		adviceAlreadyMet: 0,
		reasons: [],
	});
});

test('every history count and reason lands in its own column, on the rule it belongs to', async () => {
	const cwd = await seedStandardsRepo();
	const worklist = JSON.stringify({
		at: '2026-01-01T00:00:00.000Z',
		path: '.',
		all: false,
		batches: [
			{
				id: 'batch-00:house-loose-file:src',
				rule: 'acme/house-loose-file',
				folder: 'src',
				blocking: [finding({ siteKey: 'a' }), finding({ siteKey: 'b' }), finding({ siteKey: 'c' }), finding({ siteKey: 'd' })],
				advisories: [],
			},
			{
				id: 'batch-01:house-loose-file:lib',
				rule: 'acme/house-loose-file',
				folder: 'lib',
				blocking: [finding({ siteKey: 'e' }), finding({ siteKey: 'f' })],
				advisories: [],
			},
		],
	});

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-refactor',
			pipeline: 'refactor',
			plan: '.lightsout/runs/run-refactor/worklist.json',
			steps: [
				{
					id: 'batch-00:house-loose-file:src',
					status: 'passed',
					attempts: 1,
					report: {
						outcome: 'declined',
						remainingSiteKeys: ['b', 'c', 'd'],
						rationale: ['the generated module is not ours to split'],
						advisoryOutcomes: [
							{ rule: 'acme/house-name-things-well', siteKey: 'name:a', outcome: 'applied' },
							{ rule: 'acme/house-name-things-well', siteKey: 'name:b', outcome: 'declined', reason: 'the name is a term of art here' },
							{ rule: 'acme/house-name-things-well', siteKey: 'name:c', outcome: 'declined', reason: 'renaming it would break the published API' },
						],
					},
				},
				{
					id: 'batch-01:house-loose-file:lib',
					status: 'passed',
					attempts: 1,
					report: { outcome: 'resolved', remainingSiteKeys: ['e', 'f'], rationale: [] },
				},
			],
		},
		worklist,
	});

	const view = await getStandardsView({ cwd });

	// six sites frozen: one gone, three the agent declined and said why, and two
	// a batch that called itself resolved left standing without an account
	expect(view.rules[0]?.history).toStrictEqual({
		attempted: 6,
		resolved: 1,
		declined: 3,
		untracked: 2,
		adviceApplied: 0,
		adviceDeclined: 0,
		adviceAlreadyMet: 0,
		reasons: ['the generated module is not ours to split'],
	});
	// advice is recorded against the rule that gave it, never the rule the batch was working
	expect(view.rules[1]?.history).toStrictEqual({
		attempted: 0,
		resolved: 0,
		declined: 0,
		untracked: 0,
		adviceApplied: 1,
		adviceDeclined: 2,
		adviceAlreadyMet: 0,
		reasons: ['the name is a term of art here', 'renaming it would break the published API'],
	});
});
