import { PlanWorkspaceNotFoundError } from '@lightsout/engine';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { readOrNotFound } from '#src/features/plans/server/readOrNotFound.ts';
import { getReader } from '#src/server/getReader.ts';

export const getPlanWorkspaceServerFn = createServerFn({ method: 'GET' })
	.inputValidator(z.object({ name: z.string().min(1) }))
	.handler(({ data }) => readOrNotFound({ read: () => getReader().getPlanWorkspace({ name: data.name }), absent: [PlanWorkspaceNotFoundError] }));
