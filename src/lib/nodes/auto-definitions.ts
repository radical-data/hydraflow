import type { TransformDefinition } from 'hydra-ts';

import type { TransformSpec } from '../engine/transformSpec.js';
import type { InputSchema, NodeDefinition } from '../types.js';

// Default ranges for common parameter names
const PARAM_DEFAULTS: Record<
	string,
	{ min?: number; max?: number; step?: number; default?: number }
> = {
	// Common ranges
	amount: { min: 0, max: 2, step: 0.01, default: 0.5 },
	scale: { min: 0.1, max: 20, step: 0.1, default: 1 },
	speed: { min: -5, max: 5, step: 0.01, default: 0 },
	offset: { min: 0, max: 2, step: 0.01, default: 0 },
	angle: { min: -Math.PI * 2, max: Math.PI * 2, step: 0.01, default: 0 },

	// Color ranges
	r: { min: 0, max: 1, step: 0.01, default: 0 },
	g: { min: 0, max: 1, step: 0.01, default: 0 },
	b: { min: 0, max: 1, step: 0.01, default: 0 },
	a: { min: 0, max: 1, step: 0.01, default: 1 },

	// Frequency/oscillation
	frequency: { min: 0, max: 20, step: 0.1, default: 2 },
	sync: { min: 0, max: 2, step: 0.01, default: 0.5 },

	// Geometry
	sides: { min: 3, max: 32, step: 1, default: 4 },
	nSides: { min: 1, max: 32, step: 1, default: 4 },
	radius: { min: 0, max: 2, step: 0.01, default: 0.3 },

	// Texture effects
	threshold: { min: 0, max: 1, step: 0.01, default: 0.5 },
	tolerance: { min: 0, max: 2, step: 0.01, default: 0.1 },
	smoothing: { min: 0, max: 1, step: 0.01, default: 0.01 },

	// Tiling/repeat
	repeatX: { min: 1, max: 20, step: 0.1, default: 3 },
	repeatY: { min: 1, max: 20, step: 0.1, default: 3 },
	offsetX: { min: 0, max: 2, step: 0.01, default: 0 },
	offsetY: { min: 0, max: 2, step: 0.01, default: 0 },

	// Scrolling
	scrollX: { min: -2, max: 2, step: 0.01, default: 0.5 },
	scrollY: { min: -2, max: 2, step: 0.01, default: 0.5 },

	// Modulation
	multiple: { min: 0, max: 4, step: 0.01, default: 1 },

	// Pixel effects
	pixelX: { min: 1, max: 100, step: 1, default: 20 },
	pixelY: { min: 1, max: 100, step: 1, default: 20 },

	// Color effects
	bins: { min: 1, max: 20, step: 1, default: 3 },
	gamma: { min: 0, max: 2, step: 0.01, default: 0.6 },
	blending: { min: 0, max: 1, step: 0.01, default: 0.3 }
};

function hydraMappedInput(input: TransformDefinition['inputs'][0]): InputSchema {
	const defaults = PARAM_DEFAULTS[input.name] || {};
	const defaultValue = input.default ?? defaults.default ?? 0;
	const label = input.name
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim();

	return {
		id: input.name,
		label,
		type: 'number',
		default: defaultValue,
		min: defaults.min ?? 0,
		max: defaults.max ?? 10,
		step: defaults.step ?? 0.01
	};
}

function transformTypeToCategory(type: TransformDefinition['type']): NodeDefinition['category'] {
	if (type === 'src') return 'source';
	if (type === 'coord' || type === 'color') return 'modifier';
	if (type === 'combine' || type === 'combineCoord') return 'mixer';
	return 'modifier';
}

export function autoDefineFromHydra(
	transform: TransformDefinition,
	spec: TransformSpec
): NodeDefinition {
	const category = transformTypeToCategory(transform.type);
	const inputs = transform.inputs.map(hydraMappedInput);
	const label = transform.name
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim();

	return {
		id: transform.name,
		label,
		category,
		inputs,
		outputs: [{ id: 'color', type: 'color' }],
		spec,
		build:
			transform.type === 'src'
				? // Source nodes call generators directly
					(ctx, args) => {
						const { generators } = ctx;
						const callArgs = transform.inputs.map((inp) => args[inp.name]);
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						return (generators as any)[transform.name](...callArgs);
					}
				: // Modifier/mixer nodes return {type, args}
					(_ctx, args) => ({ type: transform.name, args }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
	};
}

export function overrideDefinition(
	base: NodeDefinition,
	overrides: Partial<NodeDefinition>
): NodeDefinition {
	return {
		...base,
		...overrides,
		inputs: overrides.inputs ?? base.inputs,
		outputs: overrides.outputs ?? base.outputs,
		build: overrides.build ?? base.build
	};
}
