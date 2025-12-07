import type { TransformMeta, TransformType } from './graphValidation.js';

export interface TransformSpec {
	id: string; // e.g. 'osc', 'blend', 'camera'
	type: TransformType; // 'src' | 'coord' | 'color' | 'combine' | 'combineCoord'
	arity: 0 | 1 | 2;
	inputNames: string[]; // hydra param names in order
}

export function buildTransformMetaFromSpecs(specs: TransformSpec[]): TransformMeta {
	const arityByName = new Map<string, 0 | 1 | 2>();
	const typeByName = new Map<string, TransformType>();
	const inputsByName = new Map<string, string[]>();

	for (const spec of specs) {
		arityByName.set(spec.id, spec.arity);
		typeByName.set(spec.id, spec.type);
		inputsByName.set(spec.id, spec.inputNames);
	}

	return { arityByName, typeByName, inputsByName };
}
