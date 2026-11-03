import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../features/issues/screens/IssuesScreen.tsx';

// The route only wires the screen to its path.
export const Route = createFileRoute('/issues')({ component: IssuesScreen });
