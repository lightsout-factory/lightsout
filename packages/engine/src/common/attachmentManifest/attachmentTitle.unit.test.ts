import { describe, expect, test } from '@jest/globals';
import { attachmentTitle } from '#src/common/attachmentManifest/attachmentTitle.ts';

const setupPlanFile = () => ({ prefix: '002-fix', name: 'plan.md' });

describe('attachmentTitle', () => {
	test('attachmentTitle: joins the prefix and the file name with a double hyphen', () => {
		const { prefix, name } = setupPlanFile();

		const title = attachmentTitle({ prefix, name });

		expect(title).toBe('002-fix--plan.md');
	});
});
