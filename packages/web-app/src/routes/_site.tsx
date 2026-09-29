import { createFileRoute } from '@tanstack/react-router';
import { SiteShell } from '#src/features/app/components/SiteShell.tsx';

/**
 * Pathless, so every page under it keeps its own URL, and a page belongs to the
 * site by where it sits rather than by a list somebody has to update.
 */
export const Route = createFileRoute('/_site')({ component: SiteShell });
