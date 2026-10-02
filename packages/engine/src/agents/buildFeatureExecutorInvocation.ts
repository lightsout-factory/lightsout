import { sharedPromptSections } from '#src/agents/internal/common/constants/sharedPromptSections.ts';
import { acceptanceTestsSection } from '#src/agents/internal/common/utils/acceptanceTestsSection.ts';
import { applyPromptTokens } from '#src/agents/internal/common/utils/applyPromptTokens.ts';
import { changedFilesSection } from '#src/agents/internal/common/utils/changedFilesSection.ts';
import { moveOnlySection } from '#src/agents/internal/common/utils/moveOnlySection.ts';
import { renameOnlySection } from '#src/agents/internal/common/utils/renameOnlySection.ts';
import { selfCheckSection } from '#src/agents/internal/common/utils/selfCheckSection.ts';
import { sharedCodeSection } from '#src/agents/internal/common/utils/sharedCodeSection.ts';
import featureExecutorPrompt from '#src/agents/prompts/featureExecutor.md';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { defaultExecutorFileLimit } from '#src/common/constants/defaultExecutorFileLimit.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { SharedCodeFolder } from '#src/common/types/SharedCodeFolder.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';

interface Params {
	/** Full plan content, inlined — the agent never loads its own context. */
	planContent: string;
	/** Optional overview plan content (phased plans): high-level context; the plan stays authoritative for scope. */
	overviewContent?: string;
	/** Optional consumer standards content (style card), inlined verbatim. */
	standards?: string;
	/** Verification-gate output from a failed attempt, for fix re-invocations. */
	errorContext?: string;
	/** Files already changed earlier in the run — orients fix re-invocations. */
	changedFiles?: string[];
	/** Consumer-granted command prefixes (config `agent-commands`) — the executor may run these, and only these. */
	allowedCommands?: string[];
	/** The executor's own source-file stop. The plan's own `## File Budget` when it declares one, else `executor-file-limit`, else `defaultExecutorFileLimit`. */
	fileLimit?: number;
	/** The tests that define done for this run: the acceptance-test mapping, each row a test file and the name of the case in it. */
	acceptanceTests?: Pick<AcceptanceTestRecord, 'testFile' | 'testName'>[];
	/** The engine's own self-check, exactly as this spawn may run it. Absent = this spawn gets no self-check and is told nothing about one. */
	selfCheckCommand?: string;
	/** The phase's build mode and the renames or moves it declares; absent means Standard. */
	planBuildMode?: PlanBuildMode;
	/** The `common/` folders visible from the files the plan names, as the tree holds them at this spawn. */
	sharedCode?: SharedCodeFolder[];
}

const modeSection = ({ planBuildMode }: { planBuildMode?: PlanBuildMode }) => {
	let section: string | undefined;

	if (planBuildMode?.buildMode === BuildMode.RenamesOnly) {
		section = renameOnlySection({ renames: planBuildMode.renames });
	} else if (planBuildMode?.buildMode === BuildMode.MoveFoldersAndFiles) {
		section = moveOnlySection({ fileMoves: planBuildMode.fileMoves, folderMoves: planBuildMode.folderMoves });
	}

	return section;
};

/**
 * The engine owns context assembly, so the same inputs always produce the same
 * prompt. Everything stable across a run rides the system prompt the harness
 * caches through, so a fix re-invocation pays only for what changed.
 */
export const buildFeatureExecutorInvocation = ({
	planContent,
	overviewContent,
	standards,
	errorContext,
	changedFiles,
	allowedCommands,
	fileLimit,
	acceptanceTests,
	selfCheckCommand,
	planBuildMode,
	sharedCode,
}: Params): { systemPrompt: string; prompt: string } => {
	const roleSections = [
		applyPromptTokens({ text: featureExecutorPrompt, tokens: { ...sharedPromptSections, fileLimit: fileLimit ?? defaultExecutorFileLimit } }),
	];

	if (overviewContent) {
		roleSections.push(
			`# Overview (high-level context)\n\nThe plan below is one phase of this larger effort. The overview is context only — the plan is authoritative for what to build in this run.\n\n${overviewContent}`,
		);
	}

	roleSections.push(`# Plan\n\n${planContent}`);

	// Rides the system prompt: the renames or moves are stable across the run,
	// so the first spawn and every fix must carry this section byte-identically.
	const mode = modeSection({ planBuildMode });

	if (mode) {
		roleSections.push(mode);
	}

	if (standards) {
		roleSections.push(`# Standards\n\nThese rules are binding for every line you write:\n\n${standards}`);
	}

	if (allowedCommands && allowedCommands.length > 0) {
		roleSections.push(
			`# Granted commands\n\nYou may run these shell commands — and only these (prefix match; arguments after the prefix are allowed). Use them solely to produce plan deliverables that only a command can produce (e.g. a generated migration). Never use them to verify, install, or explore — the engine runs all gates itself, and its own self-check is the one verification command you may run, granted to you in a section of its own rather than listed here. List every file a granted command creates in \`changedFiles\`.\n\n${allowedCommands.map((command) => `- \`${command}\``).join('\n')}`,
		);
	}

	const selfCheck = selfCheckSection({ command: selfCheckCommand });

	if (selfCheck) {
		roleSections.push(selfCheck);
	}

	// The shared code rides the task message, not the system prompt: it is read
	// from the tree at every spawn, so a fix re-invocation sees what its own first
	// attempt added.
	const sections = [
		sharedCodeSection({ sharedCode }),
		changedFilesSection({ changedFiles }),
		acceptanceTestsSection({ acceptanceTests }),
		errorContext
			? `# Verification failure\n\nA previous attempt implemented this plan, but the engine's verification gate failed. Diagnose from the output below, fix the root cause in source, and report as usual — your report must reflect the cumulative set of changed files.\n\n${errorContext}`
			: undefined,
		'Remember: your entire final message must be exactly one JSON report object — nothing else.',
	].filter((section) => section !== undefined);

	return {
		systemPrompt: roleSections.join('\n\n---\n\n'),
		prompt: sections.join('\n\n'),
	};
};
