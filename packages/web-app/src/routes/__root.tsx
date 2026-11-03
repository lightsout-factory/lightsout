/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { DefaultCatchBoundary } from '#src/components/boundaries/DefaultCatchBoundary.tsx';
import { NotFound } from '#src/components/boundaries/NotFound.tsx';
import { Theme } from '#src/constants/Theme.ts';
import { FeedbackWidget } from '#src/layouts/FeedbackWidget.tsx';
import { RootDocument } from '#src/layouts/RootDocument.tsx';
import { ThemeProvider } from '#src/providers/ThemeProvider.tsx';
import appCss from '#src/styles/app.css?url';

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
