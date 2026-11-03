import { createFileRoute } from '@tanstack/react-router';
import { homeMeta } from '#src/features/home/constants/homeMeta.ts';
import { HomeScreen } from '#src/features/home/screens/HomeScreen.tsx';

export const Route = createFileRoute('/_site/')({
	// No loader: the default pack's numbers are left cold so the headline paints
	// immediately, and the section stands without them.
	head: () => ({ meta: homeMeta }),
	component: HomeScreen,
});
