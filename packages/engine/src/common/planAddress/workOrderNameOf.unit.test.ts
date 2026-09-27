import { describe, expect, test } from '@jest/globals';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';

describe('workOrderNameOf', () => {
	test('answers the work-order segment of an address and the whole name for a work order name', () => {
		const fromAddress = workOrderNameOf({ name: 'lo-140-multi/001-record' });
		const fromWorkOrderName = workOrderNameOf({ name: 'lo-140-multi' });
		const fromThreeSegments = workOrderNameOf({ name: 'a/b/001-x' });

		expect({ fromAddress, fromWorkOrderName, fromThreeSegments }).toStrictEqual({
			fromAddress: 'lo-140-multi',
			fromWorkOrderName: 'lo-140-multi',
			fromThreeSegments: 'a/b/001-x',
		});
	});
});
