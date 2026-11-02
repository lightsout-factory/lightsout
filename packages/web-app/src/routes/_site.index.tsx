import { createFileRoute } from '@tanstack/react-router';
import { HomeScreen } from '#src/home/HomeScreen/HomeScreen.tsx';
import { homeMeta } from '#src/home/homeMeta.ts';

export const Route = createFileRoute('/_site/')({
	// No loader: the default pack's numbers are left cold so the headline paints
	// immediately, and the section stands without them.
	head: () => ({ meta: homeMeta }),
	component: HomeScreen,
});
