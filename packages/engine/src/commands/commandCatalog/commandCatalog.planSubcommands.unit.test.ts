import { describe, expect, test } from '@jest/globals';
import { commandCatalog } from '#src/commands/commandCatalog/commandCatalog.ts';

const setupCatalog = () => {
	const byId = new Map(commandCatalog.map((entry) => [entry.id, entry]));

	return { byId };
};

describe('commandCatalog plan subcommands', () => {
	test('routes every plan subcommand as its own invocation, in the order a plan is worked through', () => {
		const { byId } = setupCatalog();
		const planShapes = byId.get('plan')?.invocations.map((invocation) => [invocation.id, invocation.positional]);

		expect(planShapes).toStrictEqual([
			['plan-workspace', 'workspace'],
			['plan-verify-facts', 'verify-facts'],
			['plan-draft', 'draft'],
			['plan-sync-decisions', 'sync-decisions'],
			['plan-sync-phases', 'sync-phases'],
			['plan-lint', 'lint'],
			['plan-dedup', 'dedup'],
			['plan-grade', 'grade'],
			['plan-publish', 'publish'],
		]);
	});

	test('carries plan sync-decisions as its own invocation, between draft and sync-phases', () => {
		const { byId } = setupCatalog();
		const invocations = byId.get('plan')?.invocations ?? [];

		const placed = invocations.findIndex((invocation) => invocation.positional === 'sync-decisions');

		expect(invocations[placed]).toStrictEqual({ id: 'plan-sync-decisions', positional: 'sync-decisions' });
		expect([invocations[placed - 1]?.positional, invocations[placed + 1]?.positional]).toStrictEqual(['draft', 'sync-phases']);
	});

	test('carries plan sync-phases as its own invocation, directly after sync-decisions', () => {
		const { byId } = setupCatalog();
		const invocations = byId.get('plan')?.invocations ?? [];

		const placed = invocations.findIndex((invocation) => invocation.positional === 'sync-phases');

		expect({ invocation: invocations[placed], previous: invocations[placed - 1] }).toStrictEqual({
			invocation: { id: 'plan-sync-phases', positional: 'sync-phases' },
			previous: { id: 'plan-sync-decisions', positional: 'sync-decisions' },
		});
	});

	test('plan lists its workspace shape ahead of verify-facts, because it runs before anything else', () => {
		const { byId } = setupCatalog();

		const leading = byId.get('plan')?.invocations.slice(0, 2);

		expect(leading).toStrictEqual([
			{ id: 'plan-workspace', positional: 'workspace' },
			{ id: 'plan-verify-facts', positional: 'verify-facts' },
		]);
	});

	test('notes the extra meaning only on the plan subcommand whose flag changes its result', () => {
		const { byId } = setupCatalog();
		const noted = byId
			.get('plan')
			?.invocations.filter((invocation) => invocation.note !== undefined)
			.map((invocation) => invocation.id);

		expect(noted).toStrictEqual(['plan-grade']);
	});
});
