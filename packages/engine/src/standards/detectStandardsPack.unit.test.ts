import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { detectStandardsPack } from '#src/standards/detectStandardsPack.ts';

interface ManifestDependencies {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

const setupManifest = ({ name = '@acme/app', ...dependencies }: ManifestDependencies & { name?: string } = {}) => {
	const manifestPath = join(mkdtempSync(join(tmpdir(), 'lightsout-detect-pack-')), 'package.json');

	writeFileSync(manifestPath, JSON.stringify({ name, ...dependencies }));

	return { manifestPath };
};

test('detectStandardsPack: TanStack Start wins over React, so a TanStack app gets the tanstack-start-app pack', async () => {
	const { manifestPath } = setupManifest({ dependencies: { '@tanstack/react-start': '^1.0.0', react: '^19.0.0' } });

	const address = await detectStandardsPack({ manifestPath });

	expect(address).toBe('lightsout/tanstack-start-app');
});

test('detectStandardsPack: the older @tanstack/start name is still a TanStack Start signal', async () => {
	const { manifestPath } = setupManifest({ dependencies: { '@tanstack/start': '^1.0.0' } });

	const address = await detectStandardsPack({ manifestPath });

	expect(address).toBe('lightsout/tanstack-start-app');
});

test('detectStandardsPack: a NestJS package gets the nestjs-app pack', async () => {
	const { manifestPath } = setupManifest({ dependencies: { '@nestjs/core': '^11.0.0', zod: '^4.0.0' } });

	const address = await detectStandardsPack({ manifestPath });

	expect(address).toBe('lightsout/nestjs-app');
});

test('detectStandardsPack: when two frameworks match, the earlier one in the order wins', async () => {
	const { manifestPath } = setupManifest({ dependencies: { '@nestjs/core': '^11.0.0', '@tanstack/react-start': '^1.0.0' } });

	const address = await detectStandardsPack({ manifestPath });

	expect(address).toBe('lightsout/tanstack-start-app');
});

test('detectStandardsPack: React with no other framework gets the react-app pack, whichever dependency kind declares it', async () => {
	const manifestPaths = [
		setupManifest({ dependencies: { react: '^19.0.0' } }).manifestPath,
		setupManifest({ devDependencies: { preact: '^10.0.0' } }).manifestPath,
		setupManifest({ peerDependencies: { 'react-dom': '^19.0.0' } }).manifestPath,
	];

	const addresses = await Promise.all(manifestPaths.map((manifestPath) => detectStandardsPack({ manifestPath })));

	expect(addresses).toStrictEqual(['lightsout/react-app', 'lightsout/react-app', 'lightsout/react-app']);
});

test('detectStandardsPack: no framework signal, or no package.json at all, falls back to the node pack', async () => {
	const manifestPaths = [
		setupManifest({ name: 'react', dependencies: { zod: '^4.0.0' }, devDependencies: { '@acme/react-utils': '^1.0.0' } }).manifestPath,
		join(mkdtempSync(join(tmpdir(), 'lightsout-detect-pack-')), 'package.json'),
	];

	const addresses = await Promise.all(manifestPaths.map((manifestPath) => detectStandardsPack({ manifestPath })));

	expect(addresses).toStrictEqual(['lightsout/node', 'lightsout/node']);
});
