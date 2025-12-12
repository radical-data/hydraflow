import type { TransformDefinition } from 'hydra-ts';

import type { NodeDefinition } from '../types.js';
import { PARAM_DEFAULTS } from './paramDefaults.js';

export type TransformKind = 'src' | 'coord' | 'color' | 'combine' | 'combineCoord';

export type ParamSpec = {
	id: string; // canonical key in node.data and UI input id (stable)
	hydraName: string; // hydra-ts arg name (usually same as id); used for ordering and validation
	input: {
		type: 'number' | 'boolean' | 'select';
		label: string;
		default: unknown;
		min?: number;
		max?: number;
		step?: number;
		options?: Array<{ value: string | number | boolean; label: string }>;
	};
};

export type TransformSpec = {
	id: string; // 'osc', 'rotate', etc
	kind: TransformKind; // hydra transform kind/type
	chainArity: 0 | 1 | 2; // graph wiring arity (NOT param count)
	label: string; // UI label
	category: 'source' | 'modifier' | 'mixer' | 'output';
	implicitChainParam?: { hydraName: string }; // Only for mixer kinds (combine/combineCoord)
	params: ParamSpec[]; // user-controlled params only (excludes implicit chain param), in hydra argument order
};

export type Overrides = {
	[transformId: string]: {
		label?: string;
		category?: 'source' | 'modifier' | 'mixer' | 'output';
		params?: {
			[paramId: string]: Partial<ParamSpec['input']>;
		};
	};
};

function arityForType(type: TransformDefinition['type']): 0 | 1 | 2 {
	if (type === 'src') return 0;
	if (type === 'coord' || type === 'color') return 1;
	return 2; // 'combine' | 'combineCoord'
}

function transformTypeToKind(type: TransformDefinition['type']): TransformKind {
	return type as TransformKind;
}

function transformTypeToCategory(
	type: TransformDefinition['type']
): 'source' | 'modifier' | 'mixer' | 'output' {
	if (type === 'src') return 'source';
	if (type === 'coord' || type === 'color') return 'modifier';
	if (type === 'combine' || type === 'combineCoord') return 'mixer';
	return 'modifier';
}

function defaultLabel(name: string): string {
	return name
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

function buildParamSpecFromHydraInput(input: TransformDefinition['inputs'][0]): ParamSpec {
	const defaults = PARAM_DEFAULTS[input.name] || {};
	const defaultValue = input.default ?? defaults.default ?? 0;
	const label = input.name
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim();

	return {
		id: input.name,
		hydraName: input.name,
		input: {
			type: 'number',
			label,
			default: defaultValue,
			min: defaults.min ?? 0,
			max: defaults.max ?? 10,
			step: defaults.step ?? 0.01
		}
	};
}

/**
 * Builds TransformSpecs from Hydra TransformDefinitions.
 * Filters out special transforms that should be handled separately (src, out, render, shift).
 */
export function buildHydraTransformSpecs(
	hydraTransforms: TransformDefinition[],
	overrides: Overrides = {}
): TransformSpec[] {
	const specs: TransformSpec[] = [];

	// Filter out special transforms
	const filtered = hydraTransforms.filter(
		(t) => !['src', 'out', 'render', 'shift'].includes(t.name)
	);

	for (const transform of filtered) {
		const override = overrides[transform.name] || {};
		const isMixer = transform.type === 'combine' || transform.type === 'combineCoord';

		// Separate implicit chain param from user params
		let implicitChainParam: { hydraName: string } | undefined;
		let userInputs: TransformDefinition['inputs'];

		if (isMixer) {
			// For mixers: inputs[0] is the implicit chain param, rest are user params
			if (transform.inputs.length === 0) {
				throw new Error(
					`Mixer transform "${transform.name}" must have at least one input (implicit chain param)`
				);
			}
			implicitChainParam = { hydraName: transform.inputs[0].name };
			userInputs = transform.inputs.slice(1);
		} else {
			// For non-mixers: all inputs are user params
			userInputs = transform.inputs;
		}

		const baseUserParams = userInputs.map(buildParamSpecFromHydraInput);

		// Validate override params before applying (only against user params)
		if (override.params) {
			const baseUserParamIds = new Set(baseUserParams.map((p) => p.id));
			const overrideParamIds = Object.keys(override.params);

			for (const paramId of overrideParamIds) {
				if (!baseUserParamIds.has(paramId)) {
					const expectedList = Array.from(baseUserParamIds).sort().join(', ');
					throw new Error(
						`Override for "${transform.name}" references unknown param "${paramId}". Expected one of: ${expectedList}`
					);
				}
			}
		}

		// Apply param overrides
		const params = baseUserParams.map((param) => {
			const paramOverride = override.params?.[param.id];
			if (!paramOverride) return param;

			return {
				...param,
				input: {
					...param.input,
					...paramOverride
				}
			};
		});

		specs.push({
			id: transform.name,
			kind: transformTypeToKind(transform.type),
			chainArity: arityForType(transform.type),
			label: override.label ?? defaultLabel(transform.name),
			category: override.category ?? transformTypeToCategory(transform.type),
			implicitChainParam,
			params
		});
	}

	return specs;
}

/**
 * Adds custom transform specs (camera, out) to populate meta for validation/runtime.
 * Note: These specs exist to populate meta (kindByName, paramIdsByName, etc.) so the
 * engine/validator can reason about them. UI node definitions come from separate
 * sources (makeCameraDefinition, outDefinition) and are not generated from these specs.
 */
export function addCustomSpecsForMeta(specs: TransformSpec[]): TransformSpec[] {
	// Pure function: returns new array, never mutates input
	// Camera: exists in meta for validation; UI definition comes from makeCameraDefinition()
	// Out: exists in meta for validation; UI definition comes from outDefinition
	return [
		...specs,
		{
			id: 'camera',
			kind: 'src',
			chainArity: 0,
			label: 'Camera',
			category: 'source',
			params: []
		},
		{
			id: 'out',
			kind: 'color',
			chainArity: 1,
			label: 'Output',
			category: 'output',
			params: []
		}
	];
}

/**
 * Validates specs for correctness and drift from Hydra definitions.
 * Throws with helpful error messages if validation fails.
 */
export function assertSpecsValid(
	specs: TransformSpec[],
	hydraTransforms: TransformDefinition[]
): void {
	// Check for duplicate transform ids
	const transformIds = new Set<string>();
	for (const spec of specs) {
		if (transformIds.has(spec.id)) {
			throw new Error(`Duplicate transform id: ${spec.id}`);
		}
		transformIds.add(spec.id);
	}

	// Check for duplicate param ids within each transform
	for (const spec of specs) {
		const paramIds = new Set<string>();
		for (const param of spec.params) {
			if (paramIds.has(param.id)) {
				throw new Error(`Duplicate param id "${param.id}" in transform "${spec.id}"`);
			}
			paramIds.add(param.id);
		}
	}

	// Validate Hydra-backed transforms for drift
	const hydraTransformByName = new Map(hydraTransforms.map((t) => [t.name, t]));
	for (const spec of specs) {
		// Skip custom transforms (camera, out)
		if (spec.id === 'camera' || spec.id === 'out') continue;

		const hydraTransform = hydraTransformByName.get(spec.id);
		if (!hydraTransform) {
			throw new Error(`Transform "${spec.id}" is in registry but not found in Hydra transforms`);
		}

		// For mixers, compare against user params only (exclude implicit chain param)
		const isMixer = spec.kind === 'combine' || spec.kind === 'combineCoord';
		const hydraUserInputs = isMixer ? hydraTransform.inputs.slice(1) : hydraTransform.inputs;

		// Validate param ids match Hydra user input names (same set)
		const specParamIds = new Set(spec.params.map((p) => p.id));
		const hydraUserInputNames = new Set(hydraUserInputs.map((i) => i.name));

		if (specParamIds.size !== hydraUserInputNames.size) {
			const specList = Array.from(specParamIds).sort().join(', ');
			const hydraList = Array.from(hydraUserInputNames).sort().join(', ');
			throw new Error(
				`Transform "${spec.id}" param count mismatch: spec has [${specList}], Hydra user params: [${hydraList}]`
			);
		}

		for (const specParamId of specParamIds) {
			if (!hydraUserInputNames.has(specParamId)) {
				const hydraList = Array.from(hydraUserInputNames).sort().join(', ');
				throw new Error(
					`Transform "${spec.id}" has param "${specParamId}" not in Hydra user params. Hydra user params: [${hydraList}]`
				);
			}
		}

		// Validate param order matches Hydra user input order
		const specParamIdsOrdered = spec.params.map((p) => p.id);
		const hydraUserInputNamesOrdered = hydraUserInputs.map((i) => i.name);

		if (JSON.stringify(specParamIdsOrdered) !== JSON.stringify(hydraUserInputNamesOrdered)) {
			const specList = specParamIdsOrdered.join(', ');
			const hydraList = hydraUserInputNamesOrdered.join(', ');
			throw new Error(
				`Transform "${spec.id}" param order mismatch: spec order [${specList}], Hydra user param order [${hydraList}]`
			);
		}

		// Validate implicit chain param for mixers
		if (isMixer) {
			if (!spec.implicitChainParam) {
				throw new Error(`Mixer transform "${spec.id}" must have implicitChainParam defined`);
			}
			if (hydraTransform.inputs.length === 0) {
				throw new Error(
					`Mixer transform "${spec.id}" must have at least one Hydra input (implicit chain param)`
				);
			}
			if (spec.implicitChainParam.hydraName !== hydraTransform.inputs[0].name) {
				throw new Error(
					`Mixer transform "${spec.id}" implicitChainParam.hydraName "${spec.implicitChainParam.hydraName}" does not match Hydra inputs[0].name "${hydraTransform.inputs[0].name}"`
				);
			}
		} else {
			if (spec.implicitChainParam) {
				throw new Error(`Non-mixer transform "${spec.id}" must not have implicitChainParam`);
			}
		}

		// Validate kind matches Hydra type (unless intentionally overridden)
		const expectedKind = transformTypeToKind(hydraTransform.type);
		if (spec.kind !== expectedKind) {
			throw new Error(
				`Transform "${spec.id}" kind mismatch: spec has "${spec.kind}", Hydra type "${hydraTransform.type}" expects "${expectedKind}"`
			);
		}

		// Validate chainArity matches Hydra type-derived arity
		const expectedArity = arityForType(hydraTransform.type);
		if (spec.chainArity !== expectedArity) {
			throw new Error(
				`Transform "${spec.id}" chainArity mismatch: spec has ${spec.chainArity}, Hydra type "${hydraTransform.type}" expects ${expectedArity}`
			);
		}
	}
}

import type { TransformMeta } from './graphValidation.js';

/**
 * Builds TransformMeta from TransformSpecs.
 */
export function buildMetaFromSpecs(specs: TransformSpec[]): TransformMeta {
	const arityByName = new Map<string, 0 | 1 | 2>();
	const kindByName = new Map<string, TransformKind>();
	const paramIdsByName = new Map<string, string[]>();
	const paramDefaultsByName = new Map<string, unknown[]>();

	for (const spec of specs) {
		arityByName.set(spec.id, spec.chainArity);
		kindByName.set(spec.id, spec.kind);

		const ids = spec.params.map((p) => p.id);
		const defaults = spec.params.map((p) => p.input.default);

		// Assert: paramIds and paramDefaults must stay aligned forever
		if (ids.length !== defaults.length) {
			throw new Error(
				`Meta defaults mismatch for "${spec.id}": paramIds length ${ids.length} != paramDefaults length ${defaults.length}`
			);
		}

		paramIdsByName.set(spec.id, ids);
		paramDefaultsByName.set(spec.id, defaults);
	}

	return {
		arityByName,
		kindByName,
		paramIdsByName,
		paramDefaultsByName
	};
}

/**
 * Builds NodeDefinitions from TransformSpecs.
 * Special nodes (camera, out) are handled separately and should be added manually.
 */
export function buildNodeDefinitionsFromSpecs(specs: TransformSpec[]): NodeDefinition[] {
	const nodeDefs: NodeDefinition[] = [];

	for (const spec of specs) {
		// Skip special nodes - they should be handled separately
		if (spec.id === 'camera' || spec.id === 'out') continue;

		const inputs = spec.params.map((param) => ({
			id: param.id,
			label: param.input.label,
			type: param.input.type as 'number' | 'boolean' | 'select',
			default: param.input.default,
			min: param.input.min,
			max: param.input.max,
			step: param.input.step,
			options: param.input.options
		}));

		nodeDefs.push({
			id: spec.id,
			label: spec.label,
			category: spec.category,
			inputs,
			outputs: [{ id: 'color', type: 'color' }]
		});
	}

	return nodeDefs;
}
