import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../issues/IssuesScreen/IssuesScreen.tsx';

// The route only wires the screen to its path.
export const Route = createFileRoute('/issues')({ component: IssuesScreen });
