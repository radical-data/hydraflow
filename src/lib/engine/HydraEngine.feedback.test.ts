import { describe, expect, it } from 'vitest';

import type { IREdge, IRNode } from '../types.js';
import type { TransformMeta } from './graphValidation.js';
import { HydraEngine } from './HydraEngine.js';

function createMeta(): TransformMeta {
	const arityByName = new Map<string, 0 | 1 | 2>();
	const kindByName = new Map<string, 'src' | 'coord' | 'color' | 'combine' | 'combineCoord'>();
	const paramIdsByName = new Map<string, string[]>();
	const paramDefaultsByName = new Map<string, unknown[]>();

	arityByName.set('osc', 0);
	kindByName.set('osc', 'src');
	paramIdsByName.set('osc', ['frequency', 'sync', 'offset']);
	paramDefaultsByName.set('osc', [2, 0.5, 0]);

	arityByName.set('rotate', 1);
	kindByName.set('rotate', 'coord');
	paramIdsByName.set('rotate', ['angle', 'speed']);
	paramDefaultsByName.set('rotate', [0, 0]);

	arityByName.set('blend', 2);
	kindByName.set('blend', 'combine');
	paramIdsByName.set('blend', ['amount']);
	paramDefaultsByName.set('blend', [0.5]);

	arityByName.set('out', 1);
	kindByName.set('out', 'color');
	paramIdsByName.set('out', []);
	paramDefaultsByName.set('out', []);

	return { arityByName, kindByName, paramIdsByName, paramDefaultsByName };
}

// Fake chain objects for testing
type FakeChain = {
	kind: string;
	transforms: Array<{ op: string; otherChain?: FakeChain; args: unknown[] }>;
	outputIndex?: number;
	input?: FakeChain;
	input0?: FakeChain;
	input1?: FakeChain;
	rotate: (this: FakeChain, ...args: unknown[]) => FakeChain;
	blend: (this: FakeChain, other: FakeChain, ...args: unknown[]) => FakeChain;
	[key: string]: unknown;
};

function createFakeGenerators() {
	const chains: FakeChain[] = [];

	const makeChain = (kind: string): FakeChain => {
		const chain: FakeChain = {
			kind,
			transforms: [],
			rotate: function (this: FakeChain, ...args: unknown[]) {
				this.transforms.push({ op: 'rotate', args });
				return this;
			},
			blend: function (this: FakeChain, other: FakeChain, ...args: unknown[]) {
				this.input0 = this;
				this.input1 = other;
				// Record the full call signature: other chain + user args
				this.transforms.push({ op: 'blend', otherChain: other, args });
				return this;
			},
			out: function () {
				// Mock out method to avoid execution errors
				return this;
			}
		};
		chains.push(chain);
		return chain;
	};

	const generators = {
		osc: (...args: unknown[]) => {
			const chain = makeChain('osc');
			chain.transforms.push({ op: 'osc', args });
			return chain;
		},
		src: (output: { index?: number }) => {
			const chain = makeChain('src');
			chain.outputIndex = output.index ?? 0;
			chain.transforms.push({ op: 'src', args: [output] });
			return chain;
		}
	};

	return { generators, chains };
}

function createFakeHydra(outputCount = 4) {
	const outputs = Array.from({ length: outputCount }, (_, i) => ({ index: i }));
	return {
		outputs,
		loop: {
			start: () => {},
			stop: () => {}
		},
		hush: () => {},
		setResolution: () => {}
	};
}

describe('HydraEngine feedback', () => {
	it('unary forward + feedback cycle', async () => {
		const meta = createMeta();
		const { generators, chains } = createFakeGenerators();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydra();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'osc-1', type: 'osc', data: { frequency: 2 }, position: { x: 0, y: 0 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'osc-1', target: 'rotate-1' },
			{ id: 'e2', source: 'rotate-1', target: 'rotate-1', isFeedback: true }, // feedback cycle
			{ id: 'e3', source: 'rotate-1', target: 'out-1' }
		];

		const result = engine.executeGraph(nodes, edges);

		const cycleIssues = result.issues.filter((i) => i.kind === 'CYCLE');
		expect(cycleIssues.length).toBe(0);

		const runtimeErrors = result.issues.filter((i) => i.kind === 'RUNTIME_EXECUTION_ERROR');
		expect(runtimeErrors.length).toBe(0);

		// The rotate node should use forward input (osc), not feedback
		// This is verified by the chain structure - if feedback was used, we'd see a src chain
		const srcChains = chains.filter((c) => c.kind === 'src');
		expect(srcChains.length).toBe(0);
	});

	it('unary feedback-only node', async () => {
		const meta = createMeta();
		const { generators, chains } = createFakeGenerators();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydra();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'rotate-1', target: 'rotate-1', isFeedback: true }, // purely feedback
			{ id: 'e2', source: 'rotate-1', target: 'out-1' }
		];

		const result = engine.executeGraph(nodes, edges);

		const missingInputIssues = result.issues.filter((i) => i.kind === 'NODE_MISSING_INPUTS');
		expect(missingInputIssues.length).toBe(0);

		const runtimeErrors = result.issues.filter((i) => i.kind === 'RUNTIME_EXECUTION_ERROR');
		expect(runtimeErrors.length).toBe(0);

		// Should have created a feedback chain (src)
		const srcChains = chains.filter((c) => c.kind === 'src');
		expect(srcChains.length).toBeGreaterThan(0);
		expect(srcChains[0].outputIndex).toBe(0);
	});

	it('binary node mixed inputs', async () => {
		const meta = createMeta();
		const { generators, chains } = createFakeGenerators();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydra();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'osc-1', type: 'osc', data: { frequency: 2 }, position: { x: 0, y: 0 } },
			{ id: 'blend-1', type: 'blend', data: { amount: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'osc-1', target: 'blend-1', targetHandle: 'input-0' },
			{
				id: 'e2',
				source: 'blend-1',
				target: 'blend-1',
				targetHandle: 'input-1',
				isFeedback: true
			}, // feedback on second input
			{ id: 'e3', source: 'blend-1', target: 'out-1' }
		];

		const result = engine.executeGraph(nodes, edges);

		expect(result.issues.length).toBe(0);

		// Should have created a feedback chain for input-1
		const srcChains = chains.filter((c) => c.kind === 'src');
		expect(srcChains.length).toBe(1);
		expect(srcChains[0].outputIndex).toBe(0);
	});

	it('binary node pure feedback', async () => {
		const meta = createMeta();
		const { generators, chains } = createFakeGenerators();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydra();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'blend-1', type: 'blend', data: { amount: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{
				id: 'e1',
				source: 'blend-1',
				target: 'blend-1',
				targetHandle: 'input-0',
				isFeedback: true
			},
			{
				id: 'e2',
				source: 'blend-1',
				target: 'blend-1',
				targetHandle: 'input-1',
				isFeedback: true
			},
			{ id: 'e3', source: 'blend-1', target: 'out-1' }
		];

		const result = engine.executeGraph(nodes, edges);

		const structuralErrors = result.issues.filter(
			(i) => i.kind === 'NODE_MISSING_INPUTS' || i.kind === 'CYCLE'
		);
		expect(structuralErrors.length).toBe(0);

		const runtimeErrors = result.issues.filter((i) => i.kind === 'RUNTIME_EXECUTION_ERROR');
		expect(runtimeErrors.length).toBe(0);

		// Should have created two feedback chains (one per input)
		const srcChains = chains.filter((c) => c.kind === 'src');
		expect(srcChains.length).toBe(2);
		expect(srcChains[0].outputIndex).toBe(0);
		expect(srcChains[1].outputIndex).toBe(0);
	});

	it('runtime error when src generator unavailable', async () => {
		const meta = createMeta();
		const generators = {
			osc: () => ({ transforms: [] }),
			rotate: function () {
				return this;
			},
			blend: function () {
				return this;
			}
			// src is missing
		};
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydra();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'rotate-1', target: 'rotate-1', isFeedback: true },
			{ id: 'e2', source: 'rotate-1', target: 'out-1' }
		];

		const result = engine.executeGraph(nodes, edges);

		// Should have a runtime error about src not being available
		const runtimeErrors = result.issues.filter(
			(i) => i.kind === 'RUNTIME_EXECUTION_ERROR' && i.nodeId === 'rotate-1'
		);
		expect(runtimeErrors.length).toBeGreaterThan(0);
		expect(runtimeErrors[0].message).toContain('src');
	});

	it('mixer params are not dropped and implicit chain param is not in args', async () => {
		const meta = createMeta();
		const { generators, chains } = createFakeGenerators();
		const engine = new HydraEngine(meta, generators);

		const fakeHydra = createFakeHydra();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).hydra = fakeHydra;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(engine as any).isInitialized = true;

		const nodes: IRNode[] = [
			{ id: 'osc-1', type: 'osc', data: { frequency: 2 }, position: { x: 0, y: 0 } },
			{ id: 'osc-2', type: 'osc', data: { frequency: 3 }, position: { x: 0, y: 50 } },
			{ id: 'blend-1', type: 'blend', data: { amount: 0.25 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'osc-1', target: 'blend-1', targetHandle: 'input-0' },
			{ id: 'e2', source: 'osc-2', target: 'blend-1', targetHandle: 'input-1' },
			{ id: 'e3', source: 'blend-1', target: 'out-1' }
		];

		const result = engine.executeGraph(nodes, edges);

		expect(result.issues.length).toBe(0);

		// Find the blend transform call
		const blendCalls = chains.flatMap((c) => c.transforms).filter((t) => t.op === 'blend');

		expect(blendCalls.length).toBeGreaterThan(0);
		const blendCall = blendCalls[0];

		// Verify the call signature: blend(otherChain, amount)
		// 1. The first argument must be the "other chain" (input-1, which is osc-2)
		expect(blendCall.otherChain).toBeDefined();
		expect(blendCall.otherChain?.kind).toBe('osc');

		// 2. The args array must contain ONLY user params: [0.25]
		// This test would fail if the implicit chain param leaked into args
		expect(blendCall.args.length).toBe(1);
		expect(blendCall.args[0]).toBe(0.25);

		// 3. Verify the args array does NOT contain the implicit chain param
		// (If it did, args.length would be > 1 or args[0] would be a chain object)
		expect(typeof blendCall.args[0]).toBe('number');
	});
});
