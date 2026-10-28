import { describe, expect, test } from '@jest/globals';
import { Route } from './issues.tsx';

// Incorrect: a test of the wiring, which the end-to-end tests already walk.
describe('issues route', () => {
	test('renders the issues screen', () => {
		expect(Route.options.component).toBeDefined();
	});
});
