import { createFileRoute } from '@tanstack/react-router';
import { homeMeta } from '#src/features/home/common/constants/homeMeta.ts';
import { Home } from '#src/features/home/screens/Home/Home.tsx';

export const Route = createFileRoute('/_site/')({
	// No loader: the default pack's numbers are left cold so the headline paints
	// immediately, and the section stands without them.
	head: () => ({ meta: homeMeta }),
	component: Home,
});
