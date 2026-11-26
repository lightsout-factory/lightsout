import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';

/** The local app's landing page: the work orders this repository holds. */
export const WorkOrdersScreen = () => (
	<SitePageFrame>
		<h1 className="font-semibold text-3xl tracking-tight">Work orders</h1>
		<p className="text-muted-foreground">No work orders yet.</p>
	</SitePageFrame>
);
