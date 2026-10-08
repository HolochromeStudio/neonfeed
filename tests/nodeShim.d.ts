// Minimal typings for the few Node APIs used by asset tests (the project does not load @types/node).
declare module 'node:fs' {
  export function existsSync(p: string): boolean;
  export function readFileSync(p: string, enc: 'utf8'): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
