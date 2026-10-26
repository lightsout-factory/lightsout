import { expect, test } from '@jest/globals';
import { getFileStem } from '#src/plan/common/getFileStem.ts';

test('getFileStem: the file name without its directory or its last extension, in any language', () => {
	expect(
		['src/plan/runPlanDraft.ts', 'a/b/Component.tsx', 'app/models/user.rb', 'pkg/rates.py', 'name.with.dots.ts', 'Makefile'].map((path) =>
			getFileStem({ path }),
		),
	).toStrictEqual(['runPlanDraft', 'Component', 'user', 'rates', 'name.with.dots', 'Makefile']);
});
