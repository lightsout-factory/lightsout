// The bundled authored library arrives as data, not as a type. Declared a bare
// `object` on purpose: `resolveJsonModule` would have TypeScript infer a
// literal type for the whole library's prose and fixture text, which costs
// seconds on every `tsc` run and buys nothing — `getDefaultPackBundle` parses it
// against `StandardsPackBundle` on the way in, which is the contract that holds.
// The file is always one JSON object, so a test may still ask which keys it holds.
declare module '#assets/default-pack.json' {
	const bundle: object;
	export default bundle;
}
