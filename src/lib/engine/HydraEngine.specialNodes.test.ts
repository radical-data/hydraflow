import { describe, expect, it } from 'vitest';

import type { IREdge, IRNode } from '../types.js';
import {
	createFakeGeneratorsForSpecialNodes,
	createFakeHydraWithCamera
} from './__testutils__/fakeHydra.js';
import { HydraEngine } from './HydraEngine.js';
import {
	addCustomSpecsForMeta,
	buildHydraTransformSpecs,
	buildMetaFromSpecs
} from './transformRegistry.js';

describe('HydraEngine special nodes', () => {
	it('camera → out calls src(source0) and .out(output0)', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const hydraTransforms: any[] = [];
		const hydraSpecs = buildHydraTransformSpecs(hydraTransforms);
		const metaSpecs = addCustomSpecsForMeta(hydraSpecs);
		const meta = buildMetaFromSpecs(metaSpecs);

		const { generators, chains } = createFakeGeneratorsForSpecialNodes();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydraWithCamera();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'camera-1', type: 'camera', data: {}, position: { x: 0, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [{ id: 'e1', source: 'camera-1', target: 'out-1' }];

		const result = engine.executeGraph(nodes, edges);

		// Should have no structural errors
		const structuralErrors = result.issues.filter((i) => i.severity === 'error');
		expect(structuralErrors.length).toBe(0);

		// Verify camera source was initialized
		expect(fakeHydra.sources[0].initCam).toHaveBeenCalled();

		// Verify generators.src was called with sources[0]
		expect(generators.src).toHaveBeenCalledWith(fakeHydra.sources[0]);

		// Verify .out was called with outputs[0]
		expect(chains.srcChain.out).toHaveBeenCalledWith(fakeHydra.outputs[0]);
	});

	it('osc → out(outputIndex=1) routes to outputs[1]', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const hydraTransforms: any[] = [
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

		const hydraSpecs = buildHydraTransformSpecs(hydraTransforms);
		const metaSpecs = addCustomSpecsForMeta(hydraSpecs);
		const meta = buildMetaFromSpecs(metaSpecs);

		const { generators, chains } = createFakeGeneratorsForSpecialNodes();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydraWithCamera();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'osc-1', type: 'osc', data: { frequency: 2 }, position: { x: 0, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 1 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [{ id: 'e1', source: 'osc-1', target: 'out-1' }];

		const result = engine.executeGraph(nodes, edges);

		// Should have no structural errors
		const structuralErrors = result.issues.filter((i) => i.severity === 'error');
		expect(structuralErrors.length).toBe(0);

		// Verify generators.osc was called
		expect(generators.osc).toHaveBeenCalled();

		// Verify .out was called with outputs[1]
		expect(chains.oscChain.out).toHaveBeenCalledTimes(1);
		expect(chains.oscChain.out).toHaveBeenCalledWith(fakeHydra.outputs[1]);
	});
});
