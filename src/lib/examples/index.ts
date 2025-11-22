import { defaultExample } from './default.js';
import type { ExamplePatch } from './types.js';

export const examples: ExamplePatch[] = [defaultExample];

export function getExample(id: string): ExamplePatch | undefined {
	return examples.find((e) => e.id === id);
}
