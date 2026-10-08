/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { DefaultCatchBoundary } from '#src/common/components/boundaries/DefaultCatchBoundary.tsx';
import { NotFound } from '#src/common/components/boundaries/NotFound.tsx';
import { Theme } from '#src/common/constants/Theme.ts';
import { themeStorageKey } from '#src/common/constants/themeStorageKey.ts';
import { FeedbackWidget } from '#src/feedback/FeedbackWidget.tsx';
import appCss from '#src/styles/app.css?url';
import { ThemeProvider } from '#src/theme/ThemeProvider.tsx';

/**
 * The server always sends the light class because it cannot know this viewer's
 * choice, so this swaps it before the stylesheet applies to avoid a flash of
 * light. The provider reads the same key in an effect, so there is no hydration
 * mismatch. A browser with storage blocked throws and keeps the server's answer.
 */
const themeScript = `try {
	var stored = localStorage.getItem('${themeStorageKey}');
	if (stored === '${Theme.Dark}') {
		document.documentElement.classList.remove('${Theme.Light}');
		document.documentElement.classList.add('${Theme.Dark}');
	}
} catch (error) { }`;

const RootDocument = ({ children }: { children: ReactNode }) => (
	<html lang="en" className={`min-h-full min-w-full ${Theme.Light}`}>
		<head>
			<script>{themeScript}</script>
			<HeadContent />
		</head>
		<body className="min-h-full min-w-full">
			{children}
			<Scripts />
		</body>
	</html>
);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	head: () => ({
		meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'lightsout' }],
		links: [{ rel: 'stylesheet', href: appCss }],
	}),
	errorComponent: (props) => (
		<RootDocument>
			<DefaultCatchBoundary {...props} />
		</RootDocument>
	),
	notFoundComponent: () => <NotFound />,
	component: () => (
		<RootDocument>
			<ThemeProvider defaultTheme={Theme.Light}>
				<Outlet />
				<FeedbackWidget />
			</ThemeProvider>
		</RootDocument>
	),
});
