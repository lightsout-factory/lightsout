import { describe, expect, test } from '@jest/globals';
import { buildTrendPath } from '#src/common/buildTrendPath.ts';

describe('buildTrendPath', () => {
	test('spreads the points across the box and draws each as its share of the peak, highest at the top', () => {
		const path = buildTrendPath({ values: [0, 5, 10], peak: 10 });

		expect(path).toBe('M0.0000,1.0000 L0.5000,0.5000 L1.0000,0.0000');
	});

	test('draws against a peak larger than its own, so a line shares the scale of the set it belongs to', () => {
		const path = buildTrendPath({ values: [2, 4], peak: 8 });

		expect(path).toBe('M0.0000,0.7500 L1.0000,0.5000');
	});

	test('lays an all-zero series on the floor rather than divide by nothing', () => {
		const path = buildTrendPath({ values: [0, 0, 0], peak: 0 });

		expect(path).toBe('M0.0000,1.0000 L0.5000,1.0000 L1.0000,1.0000');
	});
});
