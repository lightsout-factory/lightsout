import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../issues/IssuesScreen/IssuesScreen.tsx';

// Incorrect: no loader, so the route is "done" before the screen has its data.
export const Route = createFileRoute('/issues')({ component: IssuesScreen });
