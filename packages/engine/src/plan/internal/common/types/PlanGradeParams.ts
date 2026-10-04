import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';

export interface PlanGradeParams {
	cwd: string;
	driver: Driver;
	name: string;
	/** A bare phase number (`3`) or a full basename. A narrowed pass is always incomplete. */
	phases?: string[];
	standards?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs?: number;
	/** Positional rather than fixed: `runGradePass` substitutes its own pass level for the command run's before threading the object further down. */
	level?: ActivityLevel;
	onProgress?: (message: string) => void;
}
