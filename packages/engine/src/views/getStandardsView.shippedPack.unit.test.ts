import { expect, test } from '@jest/globals';
import { getStandardsView } from '#src/views/getStandardsView.ts';
import { seedConfiguredCwd } from '#tests/helpers/seedConfiguredCwd.ts';

/** A repo that registers no library of its own and names one of the packs the engine ships. */
const setupShippedPackRepo = async () => ({ cwd: await seedConfiguredCwd({ config: { 'standards-pack': 'lightsout/standards' } }) });

test('a repo naming a shipped pack is described by the standards that ship with the engine', async () => {
	const { cwd } = await setupShippedPackRepo();

	const view = await getStandardsView({ cwd });

	// the bundled library travels with the engine, so naming one of its packs is all a repo has to do
	expect(view.totals.rules > 0).toBe(true);
	expect(view.rules.every((rule) => rule.doc.startsWith('lightsout: '))).toBe(true);
	expect(view.at).toBe(undefined);
});
