import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';

// The Start plugin resolves `getRouter` from src/router.tsx by convention, so nothing imports it.
const fetch = createStartHandler(defaultStreamHandler);

export default createServerEntry({ fetch });
