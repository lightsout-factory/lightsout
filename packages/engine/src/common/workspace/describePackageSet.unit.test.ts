import { describe, expect, test } from '@jest/globals';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';

describe('describePackageSet', () => {
	test('puts the repo root label first and the packages after it in name order', () => {
		const orders = [
			['web-app', '', 'engine'],
			['', 'engine', 'web-app'],
			['engine', 'web-app', ''],
			['web-app', 'engine', ''],
		];

		const labels = orders.map((packages) => describePackageSet({ packages }));

		expect(labels).toStrictEqual([
			'repo root (outside packages), engine, web-app',
			'repo root (outside packages), engine, web-app',
			'repo root (outside packages), engine, web-app',
			'repo root (outside packages), engine, web-app',
		]);
	});

	test('labels a set holding only the root or only one package without a separator', () => {
		const sets = [[''], ['web-app']];

		const labels = sets.map((packages) => describePackageSet({ packages }));

		expect(labels).toStrictEqual(['repo root (outside packages)', 'web-app']);
	});
});
