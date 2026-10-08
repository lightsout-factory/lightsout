import { beforeEach, describe, expect, test } from '@jest/globals';
import { render } from '@testing-library/react';
import { Theme } from '#src/common/constants/Theme.ts';
import { FeedbackWidget } from '#src/feedback/FeedbackWidget.tsx';
import { ThemeProvider } from '#src/theme/ThemeProvider.tsx';
import { FeedbackDrop } from '#tests/stubs/feedbackdropWidget.ts';

/** The same module Jest serves in place of `@feedbackdropai/widget`, so it holds every widget the component built. */
const builtWidgets = () => FeedbackDrop.instances;

const lastWidget = () => builtWidgets().at(-1);

const setupFeedbackWidget = ({ defaultTheme }: { defaultTheme: Theme }) =>
	render(
		<ThemeProvider defaultTheme={defaultTheme}>
			<FeedbackWidget />
		</ThemeProvider>,
	);

describe('FeedbackWidget', () => {
	beforeEach(() => {
		localStorage.clear();
		builtWidgets().length = 0;
	});

	test('mounts the widget for the lightsout FeedbackDrop project', () => {
		setupFeedbackWidget({ defaultTheme: Theme.Light });

		expect(lastWidget()).toMatchObject({ config: { apiKey: expect.stringMatching(/^fd_/) }, isMounted: true });
	});

	test('dresses the widget in the theme the viewer has chosen', () => {
		setupFeedbackWidget({ defaultTheme: Theme.Dark });

		expect(lastWidget()?.config.theme).toBe(Theme.Dark);
	});

	test('takes the widget down when the app unmounts it', () => {
		const { unmount } = setupFeedbackWidget({ defaultTheme: Theme.Light });

		unmount();

		expect(builtWidgets().every((widget) => !widget.isMounted)).toBe(true);
	});
});
