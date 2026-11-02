import { PlanWorkspaceNotFoundError } from '@lightsout/engine';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getReader } from '#src/common/server/getReader/getReader.ts';
import { readOrNotFound } from '#src/plans/server/getPlanWorkspaceServerFn/readOrNotFound.ts';

export const getPlanWorkspaceServerFn = createServerFn({ method: 'GET' })
	.inputValidator(z.object({ name: z.string().min(1) }))
	.handler(({ data }) => readOrNotFound({ read: () => getReader().getPlanWorkspace({ name: data.name }), absent: [PlanWorkspaceNotFoundError] }));
