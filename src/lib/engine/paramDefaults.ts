// Default ranges for common parameter names
// This is the canonical source of truth for UI parameter defaults/ranges
//
// NOTE: This is a TypeScript module, not JSON. Math.PI and other expressions
// are intentionally used and must remain as-is.
export const PARAM_DEFAULTS: Record<
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
