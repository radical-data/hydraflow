import type { TransformDefinition } from 'hydra-ts';
import { describe, expect, it } from 'vitest';

import { assertSpecsValid, buildHydraTransformSpecs, type Overrides } from './transformRegistry.js';

describe('transformRegistry', () => {
	describe('buildHydraTransformSpecs', () => {
		it('override typo throws during spec build', () => {
			const hydraTransforms: TransformDefinition[] = [
				{
					name: 'osc',
					type: 'src',
					glsl: '',
					inputs: [
						{ name: 'frequency', type: 'float', default: 2 },
						{ name: 'sync', type: 'float', default: 0.5 },
						{ name: 'offset', type: 'float', default: 0 }
					]
				}
			];

			const overrides: Overrides = {
				osc: {
					params: {
						freq: { label: 'Frequency', default: 2 } // typo: should be 'frequency'
					}
				}
			};

			expect(() => {
				buildHydraTransformSpecs(hydraTransforms, overrides);
			}).toThrow();

			try {
				buildHydraTransformSpecs(hydraTransforms, overrides);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				expect(message).toContain('osc');
				expect(message).toContain('freq');
				expect(message).toContain('frequency');
				expect(message).toContain('sync');
				expect(message).toContain('offset');
			}
		});

		it('builds specs with correct param order', () => {
			const hydraTransforms: TransformDefinition[] = [
				{
					name: 'osc',
					type: 'src',
					glsl: '',
					inputs: [
						{ name: 'frequency', type: 'float', default: 2 },
						{ name: 'sync', type: 'float', default: 0.5 },
						{ name: 'offset', type: 'float', default: 0 }
					]
				}
			];

			const specs = buildHydraTransformSpecs(hydraTransforms);
			const oscSpec = specs.find((s) => s.id === 'osc');

			expect(oscSpec).toBeDefined();
			expect(oscSpec?.params.map((p) => p.id)).toEqual(['frequency', 'sync', 'offset']);
		});

		it('applies overrides correctly', () => {
			const hydraTransforms: TransformDefinition[] = [
				{
					name: 'osc',
					type: 'src',
					glsl: '',
					inputs: [
						{ name: 'frequency', type: 'float', default: 2 },
						{ name: 'sync', type: 'float', default: 0.5 },
						{ name: 'offset', type: 'float', default: 0 }
					]
				}
			];

			const overrides: Overrides = {
				osc: {
					label: 'Oscillator',
					params: {
						frequency: { label: 'Frequency', default: 3, min: 0, max: 20 }
					}
				}
			};

			const specs = buildHydraTransformSpecs(hydraTransforms, overrides);
			const oscSpec = specs.find((s) => s.id === 'osc');

			expect(oscSpec?.label).toBe('Oscillator');
			expect(oscSpec?.params[0].input.label).toBe('Frequency');
			expect(oscSpec?.params[0].input.default).toBe(3);
		});

		it('mixer transforms exclude implicit chain param from user params', () => {
			const hydraTransforms: TransformDefinition[] = [
				{
					name: 'blend',
					type: 'combine',
					glsl: '',
					inputs: [
						{ name: 'other', type: 'sampler2D', default: undefined }, // implicit chain param
						{ name: 'amount', type: 'float', default: 0.5 } // user param
					]
				}
			];

			const specs = buildHydraTransformSpecs(hydraTransforms);
			const blendSpec = specs.find((s) => s.id === 'blend');

			expect(blendSpec).toBeDefined();
			// Should have implicitChainParam
			expect(blendSpec?.implicitChainParam).toBeDefined();
			expect(blendSpec?.implicitChainParam?.hydraName).toBe('other');
			// Should only have user params (excludes 'other')
			expect(blendSpec?.params.length).toBe(1);
			expect(blendSpec?.params[0].id).toBe('amount');
		});

		it('override for mixer cannot reference implicit chain param', () => {
			const hydraTransforms: TransformDefinition[] = [
				{
					name: 'blend',
					type: 'combine',
					glsl: '',
					inputs: [
						{ name: 'other', type: 'sampler2D', default: undefined }, // implicit chain param
						{ name: 'amount', type: 'float', default: 0.5 } // user param
					]
				}
			];

			const overrides: Overrides = {
				blend: {
					params: {
						other: { label: 'Other', default: 0 } // Should fail - 'other' is not a user param
					}
				}
			};

			expect(() => {
				buildHydraTransformSpecs(hydraTransforms, overrides);
			}).toThrow();

			try {
				buildHydraTransformSpecs(hydraTransforms, overrides);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				expect(message).toContain('blend');
				expect(message).toContain('other');
				expect(message).toContain('amount'); // Should list 'amount' as the only valid param
			}
		});
	});

	describe('assertSpecsValid', () => {
		it('chainArity drift check fails if arity does not match Hydra type', () => {
			const hydraTransforms: TransformDefinition[] = [
				{
					name: 'osc',
					type: 'src',
					glsl: '',
					inputs: [
						{ name: 'frequency', type: 'float', default: 2 },
						{ name: 'sync', type: 'float', default: 0.5 },
						{ name: 'offset', type: 'float', default: 0 }
					]
				}
			];

			const specs = buildHydraTransformSpecs(hydraTransforms);
			const oscSpec = specs.find((s) => s.id === 'osc');
			expect(oscSpec).toBeDefined();

			// Mutate the spec to have wrong arity (src should be 0, not 1)
			oscSpec!.chainArity = 1;

			expect(() => {
				assertSpecsValid(specs, hydraTransforms);
			}).toThrow();

			try {
				assertSpecsValid(specs, hydraTransforms);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				expect(message).toContain('osc');
				expect(message).toContain('chainArity');
				expect(message).toContain('1'); // wrong arity
				expect(message).toContain('0'); // expected arity
				expect(message).toContain('src'); // Hydra type
			}
		});
	});
});
