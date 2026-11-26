import { Link, Outlet } from '@tanstack/react-router';
import { SiteHeader } from '#src/layouts/SiteHeader.tsx';

const repoLinkClasses = 'font-medium text-muted-foreground-strong transition-colors hover:text-foreground';

/**
 * The `/app` frame: the site's own header, so the local browser reads as part
 * of the site, over a navigation of its two places. The document scrolls, as on
 * the public site.
 */
export const AppLayout = () => (
	<div className="relative min-h-screen w-full">
		<SiteHeader />
		<nav aria-label="Your repo" className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 pt-6 text-sm">
			<Link to="/app" className={repoLinkClasses}>
				Work orders
			</Link>
			<Link to="/app/queue" className={repoLinkClasses}>
				Queue
			</Link>
		</nav>
		<main>
			<Outlet />
		</main>
	</div>
);
