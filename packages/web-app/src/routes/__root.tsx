/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { DefaultCatchBoundary } from '#src/common/boundaries/DefaultCatchBoundary.tsx';
import { NotFound } from '#src/common/boundaries/NotFound.tsx';
import { Theme } from '#src/common/constants/Theme.ts';
import { FeedbackWidget } from '#src/feedback/FeedbackWidget.tsx';
import { RootDocument } from '#src/shell/RootDocument.tsx';
import appCss from '#src/styles/app.css?url';
import { ThemeProvider } from '#src/theme/ThemeProvider.tsx';

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
