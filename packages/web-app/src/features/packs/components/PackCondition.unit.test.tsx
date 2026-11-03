import { describe, expect, test } from '@jest/globals';
import { render } from '@testing-library/react';
import { PackCondition } from '#src/features/packs/components/PackCondition.tsx';

describe('PackCondition', () => {
	test.each([
		{ dependencies: ['@nestjs/core'], sentence: 'Applies only to packages that depend on @nestjs/core.' },
		{
			dependencies: ['@tanstack/react-start', '@tanstack/start'],
			sentence: 'Applies only to packages that depend on @tanstack/react-start or @tanstack/start.',
		},
		{ dependencies: ['react', 'preact', 'react-dom'], sentence: 'Applies only to packages that depend on react, preact or react-dom.' },
	])('reads as one sentence for $dependencies.length dependencies, since declaring any one is enough', ({ dependencies, sentence }) => {
		const { container } = render(<PackCondition dependencies={dependencies} />);

		expect(container.textContent).toBe(sentence);
	});

	test('draws each dependency as code, so a package name is never read as a word of the sentence', () => {
		const { container } = render(<PackCondition dependencies={['react', 'preact']} />);

		expect([...container.querySelectorAll('code')].map((code) => code.textContent)).toStrictEqual(['react', 'preact']);
	});
});
