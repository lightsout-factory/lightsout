import { createFileRoute } from '@tanstack/react-router';
import { SiteLayout } from '#src/layouts/SiteLayout.tsx';

/**
 * Pathless, so every page under it keeps its own URL, and a page belongs to the
 * site by where it sits rather than by a list somebody has to update.
 */
export const Route = createFileRoute('/_site')({ component: SiteLayout });
