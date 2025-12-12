import { describe, expect, it } from 'vitest';

import type { IREdge, IRNode } from '../types.js';
import type { TransformMeta } from './graphValidation.js';
import { validateGraph } from './graphValidation.js';

function createMeta(): TransformMeta {
	const arityByName = new Map<string, 0 | 1 | 2>();
	const kindByName = new Map<string, 'src' | 'coord' | 'color' | 'combine' | 'combineCoord'>();
	const paramIdsByName = new Map<string, string[]>();
	const paramDefaultsByName = new Map<string, unknown[]>();

	arityByName.set('src', 0);
	kindByName.set('src', 'src');
	paramIdsByName.set('src', []);
	paramDefaultsByName.set('src', []);

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

describe('validateGraph', () => {
	it('single linear graph: no issues, all live', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'src-1', target: 'rotate-1' },
			{ id: 'e2', source: 'rotate-1', target: 'out-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		expect(result.issues.length).toBe(0);
		expect(result.nodeStatusById.get('src-1')?.isDead).toBe(false);
		expect(result.nodeStatusById.get('rotate-1')?.isDead).toBe(false);
		expect(result.nodeStatusById.get('out-1')?.isDead).toBe(false);
		expect(result.edgeStatusById.get('e1')?.isDead).toBe(false);
		expect(result.edgeStatusById.get('e2')?.isDead).toBe(false);
	});

	it('unreachable node and edge are marked dead', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } },
			{ id: 'noise-1', type: 'src', data: {}, position: { x: 0, y: 100 } },
			{ id: 'other-1', type: 'src', data: {}, position: { x: 100, y: 100 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'src-1', target: 'rotate-1' },
			{ id: 'e2', source: 'rotate-1', target: 'out-1' },
			{ id: 'e3', source: 'noise-1', target: 'other-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		expect(result.nodeStatusById.get('src-1')?.isDead).toBe(false);
		expect(result.nodeStatusById.get('rotate-1')?.isDead).toBe(false);
		expect(result.nodeStatusById.get('out-1')?.isDead).toBe(false);
		expect(result.nodeStatusById.get('noise-1')?.isDead).toBe(true);
		expect(result.nodeStatusById.get('other-1')?.isDead).toBe(true);
		expect(result.edgeStatusById.get('e3')?.isDead).toBe(true);
		expect(result.nodeStatusById.get('noise-1')?.hasError).toBe(false);
	});

	it('missing input error', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'blend-1', type: 'blend', data: { amount: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'src-1', target: 'blend-1' },
			{ id: 'e2', source: 'blend-1', target: 'out-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const blendIssues = result.issues.filter((i) => i.nodeId === 'blend-1');
		expect(blendIssues.length).toBeGreaterThan(0);
		expect(blendIssues.some((i) => i.kind === 'NODE_MISSING_INPUTS')).toBe(true);
		expect(result.nodeStatusById.get('blend-1')?.hasError).toBe(true);
	});

	it('extra input warning', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'src-2', type: 'src', data: {}, position: { x: 0, y: 50 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'src-1', target: 'rotate-1' },
			{ id: 'e2', source: 'src-2', target: 'rotate-1' },
			{ id: 'e3', source: 'rotate-1', target: 'out-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const rotateIssues = result.issues.filter((i) => i.nodeId === 'rotate-1');
		expect(rotateIssues.some((i) => i.kind === 'NODE_EXTRA_INPUTS')).toBe(true);
		expect(result.nodeStatusById.get('rotate-1')?.hasWarning).toBe(true);
		expect(result.nodeStatusById.get('rotate-1')?.hasError).toBe(false);
	});

	it('cycle detection', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'rotate-2', type: 'rotate', data: { angle: 0.5 }, position: { x: 200, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 300, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'src-1', target: 'rotate-1' },
			{ id: 'e2', source: 'rotate-1', target: 'rotate-2' },
			{ id: 'e3', source: 'rotate-2', target: 'rotate-1' },
			{ id: 'e4', source: 'rotate-1', target: 'out-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const cycleIssues = result.issues.filter((i) => i.kind === 'CYCLE');
		expect(cycleIssues.length).toBeGreaterThan(0);
		expect(cycleIssues.some((i) => i.nodeId === 'rotate-1' || i.nodeId === 'rotate-2')).toBe(true);
	});

	it('feedback edge cycle should not be reported as CYCLE error', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'rotate-2', type: 'rotate', data: { angle: 0.5 }, position: { x: 200, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 300, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'src-1', target: 'rotate-1' },
			{ id: 'e2', source: 'rotate-1', target: 'rotate-2' },
			{ id: 'e3', source: 'rotate-2', target: 'rotate-1', isFeedback: true },
			{ id: 'e4', source: 'rotate-1', target: 'out-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const cycleIssues = result.issues.filter((i) => i.kind === 'CYCLE');
		expect(cycleIssues.length).toBe(0);
		expect(result.nodeStatusById.get('rotate-1')?.isDead).toBe(false);
		expect(result.nodeStatusById.get('rotate-2')?.isDead).toBe(false);
		// Arity should still be correct (rotate expects 1 input, has 1 input)
		expect(result.nodeStatusById.get('rotate-1')?.hasError).toBe(false);
		expect(result.nodeStatusById.get('rotate-2')?.hasError).toBe(false);
	});

	it('unary node with only a feedback input is structurally valid', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'rotate-1', type: 'rotate', data: { angle: 0.5 }, position: { x: 100, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 200, y: 0 } }
		];

		const edges: IREdge[] = [
			{ id: 'e1', source: 'rotate-1', target: 'rotate-1', isFeedback: true }, // purely feedback
			{ id: 'e2', source: 'rotate-1', target: 'out-1' }
		];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const rotateIssues = result.issues.filter((i) => i.nodeId === 'rotate-1');
		expect(rotateIssues.some((i) => i.kind === 'NODE_MISSING_INPUTS')).toBe(false);
		expect(result.nodeStatusById.get('rotate-1')?.hasError).toBe(false);
	});

	it('output index out of range', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 99 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [{ id: 'e1', source: 'src-1', target: 'out-1' }];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const outIssues = result.issues.filter((i) => i.nodeId === 'out-1');
		expect(outIssues.some((i) => i.kind === 'OUTPUT_INDEX_OUT_OF_RANGE')).toBe(true);
		const issue = outIssues.find((i) => i.kind === 'OUTPUT_INDEX_OUT_OF_RANGE');
		expect(issue?.message).toBe('Output index 99 out of range (0…3)');
		expect(issue?.outputIndex).toBe(99);
	});

	it('output arity error', () => {
		const nodes: IRNode[] = [
			{ id: 'src-1', type: 'src', data: {}, position: { x: 0, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const outIssues = result.issues.filter((i) => i.nodeId === 'out-1');
		expect(outIssues.some((i) => i.kind === 'OUTPUT_ARITY')).toBe(true);
		const issue = outIssues.find((i) => i.kind === 'OUTPUT_ARITY');
		expect(issue?.message).toContain('exactly 1 input');
		expect(issue?.message).toContain('found 0');
	});

	it('unknown node.data key emits validation warning', () => {
		const nodes: IRNode[] = [
			{ id: 'osc-1', type: 'osc', data: { freq: 2 }, position: { x: 0, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [{ id: 'e1', source: 'osc-1', target: 'out-1' }];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const unknownKeyIssues = result.issues.filter(
			(i) => i.kind === 'UNKNOWN_NODE_DATA_KEY' && i.nodeId === 'osc-1'
		);
		expect(unknownKeyIssues.length).toBeGreaterThan(0);
		expect(unknownKeyIssues[0].severity).toBe('warning');
		expect(unknownKeyIssues[0].message).toContain('osc-1');
		expect(unknownKeyIssues[0].message).toContain('freq');
	});

	it('UNKNOWN_NODE_DATA_KEY expected list is stable (sorted)', () => {
		const nodes: IRNode[] = [
			{ id: 'osc-1', type: 'osc', data: { freq: 2 }, position: { x: 0, y: 0 } },
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [{ id: 'e1', source: 'osc-1', target: 'out-1' }];

		const meta = createMeta();
		const result1 = validateGraph({ nodes, edges, numOutputs: 4, meta });
		const result2 = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const issue1 = result1.issues.find(
			(i) => i.kind === 'UNKNOWN_NODE_DATA_KEY' && i.nodeId === 'osc-1'
		);
		const issue2 = result2.issues.find(
			(i) => i.kind === 'UNKNOWN_NODE_DATA_KEY' && i.nodeId === 'osc-1'
		);

		expect(issue1).toBeDefined();
		expect(issue2).toBeDefined();
		// Expected list should be stable (sorted alphabetically)
		expect(issue1?.message).toBe(issue2?.message);
		// Should contain sorted param names
		expect(issue1?.message).toContain('frequency, offset, sync');
	});

	it('outputIndex is allowed for out nodes', () => {
		const nodes: IRNode[] = [
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		const unknownKeyIssues = result.issues.filter(
			(i) => i.kind === 'UNKNOWN_NODE_DATA_KEY' && i.nodeId === 'out-1'
		);
		expect(unknownKeyIssues.length).toBe(0);
	});

	it('unknown node type does not emit UNKNOWN_NODE_DATA_KEY warnings', () => {
		const nodes: IRNode[] = [
			{
				id: 'unknown-1',
				type: 'nonexistent',
				data: { someKey: 123 },
				position: { x: 0, y: 0 }
			},
			{ id: 'out-1', type: 'out', data: { outputIndex: 0 }, position: { x: 100, y: 0 } }
		];

		const edges: IREdge[] = [{ id: 'e1', source: 'unknown-1', target: 'out-1' }];

		const meta = createMeta();
		const result = validateGraph({ nodes, edges, numOutputs: 4, meta });

		// Should have UNKNOWN_TRANSFORM error, not UNKNOWN_NODE_DATA_KEY warnings
		const unknownTransformIssues = result.issues.filter(
			(i) => i.kind === 'UNKNOWN_TRANSFORM' && i.nodeId === 'unknown-1'
		);
		expect(unknownTransformIssues.length).toBeGreaterThan(0);

		const unknownKeyIssues = result.issues.filter(
			(i) => i.kind === 'UNKNOWN_NODE_DATA_KEY' && i.nodeId === 'unknown-1'
		);
		expect(unknownKeyIssues.length).toBe(0);
	});
});
