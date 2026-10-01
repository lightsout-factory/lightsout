import { z } from 'zod';
import { buildClaudeCodeArgs } from '#src/drivers/buildClaudeCodeArgs.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { isRateLimitMessage } from '#src/drivers/internal/common/utils/isRateLimitMessage.ts';
import { spawnCollect } from '#src/drivers/internal/common/utils/spawnCollect.ts';
import { writeSystemPromptFile } from '#src/drivers/internal/common/utils/writeSystemPromptFile.ts';

const ResultEnvelope = z.object({
	result: z.string().optional(),
	is_error: z.boolean().optional(),
});

const ResultEvent = ResultEnvelope.extend({
	type: z.literal('result'),
	usage: z
		.object({
			input_tokens: z.number().optional(),
			output_tokens: z.number().optional(),
			cache_read_input_tokens: z.number().optional(),
			cache_creation_input_tokens: z.number().optional(),
		})
		.optional(),
	total_cost_usd: z.number().optional(),
});

/**
 * The harness emits the same message once per content block, so `message.id`
 * tells a repeat from a new message. The streamed `output_tokens` is a
 * placeholder, so only the input side is read.
 */
const AssistantEvent = z.object({
	type: z.literal('assistant'),
	message: z.object({
		id: z.string(),
		usage: z
			.object({
				input_tokens: z.number().optional(),
				cache_read_input_tokens: z.number().optional(),
				cache_creation_input_tokens: z.number().optional(),
			})
			.optional(),
	}),
});

const resultUsage = ({ event }: { event: z.infer<typeof ResultEvent> }) =>
	event.usage || event.total_cost_usd !== undefined
		? {
				inputTokens: event.usage?.input_tokens ?? 0,
				outputTokens: event.usage?.output_tokens ?? 0,
				cacheReadTokens: event.usage?.cache_read_input_tokens ?? 0,
				cacheCreationTokens: event.usage?.cache_creation_input_tokens ?? 0,
				costUsd: event.total_cost_usd ?? 0,
			}
		: undefined;

/**
 * Output tokens and cost stay out: the harness knows neither while the message
 * streams, and its placeholder would print a figure far too small.
 */
const createAssistantUsageTally = () => {
	const counted = new Set<string>();
	const total = { inputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

	return ({ event }: { event: unknown }) => {
		const parsed = AssistantEvent.safeParse(event);

		if (!parsed.success || !parsed.data.message.usage || counted.has(parsed.data.message.id)) {
			return undefined;
		}

		counted.add(parsed.data.message.id);
		total.inputTokens += parsed.data.message.usage.input_tokens ?? 0;
		total.cacheReadTokens += parsed.data.message.usage.cache_read_input_tokens ?? 0;
		total.cacheCreationTokens += parsed.data.message.usage.cache_creation_input_tokens ?? 0;

		return { ...total };
	};
};

/** Fallback for non-stream output (`--output-format json`): the whole stdout is one envelope. */
const parseEnvelope = ({ stdout }: { stdout: string }) => {
	try {
		return ResultEnvelope.parse(JSON.parse(stdout));
	} catch {
		return undefined;
	}
};

export const createClaudeCodeDriver = (): Driver => {
	const driver: Driver = {
		name: 'claude-code',
		invoke: async (invocation) => {
			const { prompt, systemPrompt, model, effort, permissions, allowedCommands, environment, foregroundCommandsOnly, cwd, timeoutMs, onEvent, onUsage } =
				invocation;

			let resultEvent: z.infer<typeof ResultEvent> | undefined;
			const tallyAssistantUsage = createAssistantUsageTally();

			const systemPromptFile = systemPrompt ? await writeSystemPromptFile({ systemPrompt }) : undefined;

			// The temp file outlives only the spawn — cleanup runs on the error
			// path too, and never throws.
			const { exitCode, stdout, stderr } = await spawnCollect({
				command: 'claude',
				args: buildClaudeCodeArgs({
					systemPromptPath: systemPromptFile?.path,
					model,
					effort,
					permissions,
					allowedCommands,
					environment,
					foregroundCommandsOnly,
					timeoutMs,
				}),
				cwd,
				stdinText: prompt,
				timeoutMs,
				onStdoutLine: (line) => {
					let event: unknown;

					try {
						event = JSON.parse(line);
					} catch {
						return;
					}

					const parsed = ResultEvent.safeParse(event);

					if (parsed.success) {
						resultEvent = parsed.data;

						// The terminal envelope supersedes the streamed accumulation:
						// it is the only place the harness states output tokens and cost.
						const settled = resultUsage({ event: parsed.data });

						if (settled) {
							onUsage?.(settled);
						}
					}

					const streamed = tallyAssistantUsage({ event });

					if (streamed) {
						onUsage?.(streamed);
					}

					onEvent?.(event);
				},
			}).finally(() => systemPromptFile?.cleanup());

			const envelope = resultEvent ?? parseEnvelope({ stdout });
			const text = envelope?.result ?? stdout;
			const errored = envelope?.is_error === true || exitCode !== 0;
			const usage = resultEvent ? resultUsage({ event: resultEvent }) : undefined;

			return {
				text: text || stderr,
				exitCode,
				rateLimited: errored && isRateLimitMessage({ text: `${text}\n${stderr}` }),
				usage,
			};
		},
	};

	return driver;
};
