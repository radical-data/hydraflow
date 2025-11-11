import type { TransformDefinition } from 'hydra-ts';
import {
	defaultGenerators as generatorTransforms,
	defaultModifiers as modifierTransforms
} from 'hydra-ts';

const ARITY: Record<TransformDefinition['type'], 0 | 1 | 2> = {
	src: 0,
	coord: 1,
	color: 1,
	combine: 2,
	combineCoord: 2
};
const all = [...generatorTransforms, ...modifierTransforms];

const arityByName = new Map(all.map((t) => [t.name, ARITY[t.type]]));
const typeByName = new Map(all.map((t) => [t.name, t.type]));
const inputsByName = new Map(all.map((t) => [t.name, t.inputs.map((i) => i.name)]));

export const typeOf = (name: string): string | undefined => typeByName.get(name as any); // eslint-disable-line @typescript-eslint/no-explicit-any
export const arityOf = (name: string): 0 | 1 | 2 | undefined => arityByName.get(name as any); // eslint-disable-line @typescript-eslint/no-explicit-any
export const orderedInputNames = (name: string): string[] => inputsByName.get(name as any) ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
