// Incorrect: a star publishes whatever renderGreeting.ts happens to export, and
// the call is code in the package's entry.
export * from './feature/renderGreeting';

console.log('entry loaded');
