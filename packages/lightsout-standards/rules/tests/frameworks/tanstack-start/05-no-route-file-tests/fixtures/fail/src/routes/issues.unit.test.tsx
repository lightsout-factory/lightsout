import { describe, expect, test } from '@jest/globals';
import { Route } from './issues';

// Incorrect: a unit test for a route file, which holds nothing but wiring.
describe('issues route', () => {
	test('renders the issues screen', () => {
		const component = Route.options.component;

		expect(component).toBeDefined();
	});
});
