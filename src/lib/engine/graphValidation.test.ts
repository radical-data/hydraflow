import { describe, expect, it } from 'vitest';

import type { IREdge, IRNode } from '../types.js';
import type { TransformMeta } from './graphValidation.js';
import { validateGraph } from './graphValidation.js';

function createMeta(): TransformMeta {
	const arityByName = new Map<string, 0 | 1 | 2>();
	const typeByName = new Map<string, 'src' | 'coord' | 'color' | 'combine' | 'combineCoord'>();
	const inputsByName = new Map<string, string[]>();

	arityByName.set('src', 0);
	typeByName.set('src', 'src');
	inputsByName.set('src', []);

	arityByName.set('rotate', 1);
	typeByName.set('rotate', 'coord');
	inputsByName.set('rotate', ['angle', 'speed']);

	arityByName.set('blend', 2);
	typeByName.set('blend', 'combine');
	inputsByName.set('blend', ['amount']);

	arityByName.set('out', 1);
	typeByName.set('out', 'color');
	inputsByName.set('out', []);

	return { arityByName, typeByName, inputsByName };
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
});
