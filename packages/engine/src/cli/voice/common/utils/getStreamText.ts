interface Params {
	stream: NodeJS.ReadableStream;
}

export const getStreamText = async ({ stream }: Params): Promise<string> => {
	const chunks: string[] = [];

	for await (const chunk of stream) {
		chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
	}

	return chunks.join('');
};
