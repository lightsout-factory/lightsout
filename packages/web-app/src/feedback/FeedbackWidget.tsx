import { FeedbackDropWidget } from '@feedbackdropai/react';
import { Theme as WidgetTheme } from '@feedbackdropai/widget';
import { Theme } from '#src/common/constants/Theme.ts';
import { useTheme } from '#src/theme/useTheme.ts';

/**
 * FeedbackDrop's public project key: it identifies the project feedback lands
 * in and is shipped to every browser by design, so it is not a secret.
 */
const feedbackDropApiKey = 'fd_5q-1p_LkT7ZiGg-JbV5RXEwHbf4XM9Qq3Qq4jnBQjtY';

const widgetThemes: Record<Theme, WidgetTheme> = {
	[Theme.Light]: WidgetTheme.Light,
	[Theme.Dark]: WidgetTheme.Dark,
};

/**
 * Follows the viewer's in-app theme rather than the operating system's, so the
 * widget never sits light on a dark page. It mounts in an effect, so the server
 * renders nothing for it.
 */
export const FeedbackWidget = () => {
	const { theme } = useTheme();

	return <FeedbackDropWidget apiKey={feedbackDropApiKey} theme={widgetThemes[theme]} />;
};
