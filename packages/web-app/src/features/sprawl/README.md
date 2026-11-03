# sprawl

The measurements the README GIF's `scripts/renderSprawlSvg.mjs` and
`scripts/renderSprawlGif.mjs` draw a sprawl lane from, kept here as typed,
tested source rather than inside the scripts. Nothing in the app renders them.

The scripts load these files with plain `node`, which strips types and does
nothing else. So a file here may import only this folder's own files and
type-only declarations — never a `.tsx` file, never `#assets/*`, and never
`zod` as a value. Breaking that stops `pnpm build:sprawl-gif` without failing a
test.
