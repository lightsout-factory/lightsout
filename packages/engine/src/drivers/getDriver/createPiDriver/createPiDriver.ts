import { z } from 'zod';
import type { Driver } from '#src/common/types/Driver.ts';
import type { DriverResult } from '#src/common/types/DriverResult.ts';
import { isRateLimitMessage } from '#src/drivers/getDriver/common/isRateLimitMessage.ts';
import { spawnCollect } from '#src/drivers/getDriver/common/spawnCollect.ts';
import { writeSystemPromptFile } from '#src/drivers/getDriver/common/writeSystemPromptFile.ts';
import { buildPiArgs } from '#src/drivers/getDriver/createPiDriver/buildPiArgs.ts';
import { PiVariant } from '#src/drivers/getDriver/createPiDriver/common/constants/PiVariant.ts';

const Usage = z.object({
	input: z.number().optional(),
	output: z.number().optional(),
	cacheRead: z.number().optional(),
	cacheWrite: z.number().optional(),
	cost: z
		.object({
			total: z.number().optional(),
		})
		.optional(),
});

// Loose, so a parsed message keeps every field the stream gave it: the whole
// message is what tells one assistant turn from another when the tally has to
// decide whether it has already counted this one.
const ContentBlock = z.looseObject({
	type: z.string(),
	text: z.string().optional(),
});

const Message = z.looseObject({
	role: z.string(),
	content: z.array(ContentBlock).optional(),
	usage: Usage.optional(),
});

const MessageEndEvent = z.object({
	type: z.literal('message_end'),
	message: Message,
});

const AgentEndEvent = z.object({
	type: z.literal('agent_end'),
	messages: z.array(Message),
});

/**
 * This harness states its counts per message, not per session, so the last
 * message alone would under-report a multi-turn agent. Each message arrives
 * twice, as its own `message_end` and inside `agent_end`, so the message as the
 * stream gave it is the key that counts it once.
 */
const createSessionUsageTally = () => {
	const counted = new Set<string>();
	const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 };

	return ({ messages }: { messages: z.infer<typeof Message>[] }) => {
		let added = false;

		for (const message of messages) {
			const key = JSON.stringify(message);

			if (message.role !== 'assistant' || !message.usage || counted.has(key)) {
				continue;
			}

			counted.add(key);
			added = true;
			total.inputTokens += message.usage.input ?? 0;
			total.outputTokens += message.usage.output ?? 0;
			total.cacheReadTokens += message.usage.cacheRead ?? 0;
			total.cacheCreationTokens += message.usage.cacheWrite ?? 0;
			total.costUsd += message.usage.cost?.total ?? 0;
		}

		return added ? { ...total } : undefined;
	};
};

/**
 * `agent_end`'s last assistant message is the answer even when tool-call rounds
 * came after the last full `message_end`; that `message_end` is the fallback
 * when the stream never reaches `agent_end`.
 */
const readFinalText = ({ agentEnd, lastAssistant }: { agentEnd?: z.infer<typeof AgentEndEvent>; lastAssistant?: z.infer<typeof Message> }) => {
	const finalMessage = agentEnd ? [...agentEnd.messages].reverse().find((message) => message.role === 'assistant') : lastAssistant;

	return (finalMessage?.content ?? [])
		.filter((block) => block.type === 'text')
		.map((block) => block.text ?? '')
		.join('\n');
};

interface PiFamilyParams {
	name: string;
	variant: PiVariant;
	command: string;
}

/** omp is a fork of pi that shares its print-mode flags and json event stream, so one implementation serves both. */
const createPiFamilyDriver = ({ name, variant, command }: PiFamilyParams): Driver => {
	const driver: Driver = {
		name,
		invoke: async (invocation) => {
			// foregroundCommandsOnly is deliberately unused: neither pi nor omp
			// exposes a mechanism to forbid background commands or lift a
			// per-command ceiling, so the request is ignored rather than refused.
			// The queue auto-plan worker's prompt rule and its post-session check
			// of the planning-progress record cover these harnesses.
			const { prompt, systemPrompt, model, effort, permissions, writableDirs, cwd, timeoutMs, onEvent, onUsage } = invocation;

			let agentEnd: z.infer<typeof AgentEndEvent> | undefined;
			let lastAssistant: z.infer<typeof Message> | undefined;
			let usage: DriverResult['usage'];
			const tallySessionUsage = createSessionUsageTally();

			const systemPromptFile = systemPrompt ? await writeSystemPromptFile({ systemPrompt }) : undefined;

			// The temp file outlives only the spawn — cleanup runs on the error
			// path too, and never throws.
			const { exitCode, stdout, stderr } = await spawnCollect({
				command,
				args: buildPiArgs({ variant, systemPromptPath: systemPromptFile?.path, model, effort, permissions, writableDirs }),
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

					const messageEnd = MessageEndEvent.safeParse(event);

					if (messageEnd.success) {
						lastAssistant = messageEnd.data.message;
					}

					const end = AgentEndEvent.safeParse(event);

					if (end.success) {
						agentEnd = end.data;
					}

					// Per message as each one closes, so a process killed before
					// agent_end still accounts for what it spent.
					const streamed = tallySessionUsage({ messages: messageEnd.success ? [messageEnd.data.message] : end.success ? end.data.messages : [] });

					if (streamed) {
						usage = streamed;
						onUsage?.(streamed);
					}

					onEvent?.(event);
				},
			}).finally(() => systemPromptFile?.cleanup());

			const text = readFinalText({ agentEnd, lastAssistant });
			const errored = exitCode !== 0 || text === '';

			return {
				text: text || stdout || stderr,
				exitCode,
				rateLimited: errored && isRateLimitMessage({ text: `${stdout}\n${stderr}` }),
				usage,
			};
		},
	};

	return driver;
};

export const createPiDriver = (): Driver => createPiFamilyDriver({ name: 'pi', variant: PiVariant.Pi, command: 'pi' });

export const createOmpDriver = (): Driver => createPiFamilyDriver({ name: 'omp', variant: PiVariant.Omp, command: 'omp' });
