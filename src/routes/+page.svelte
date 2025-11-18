<script lang="ts">
	import { nanoid } from 'nanoid';

	import FlowEditor from '$lib/components/FlowEditor.svelte';
	import HydraCanvas from '$lib/components/HydraCanvas.svelte';
	import type { Issue } from '$lib/engine/HydraEngine.js';
	import type { IREdge, IRNode } from '$lib/types.js';

	let nodes = $state.raw<IRNode[]>([
		{
			id: 'osc-1',
			type: 'osc',
			data: {
				frequency: 5.0,
				sync: 0.5,
				offset: 0.5
			},
			position: { x: 100, y: 50 }
		},
		{
			id: 'noise-1',
			type: 'noise',
			data: {
				scale: 4.0,
				offset: 0
			},
			position: { x: 100, y: 150 }
		},
		{
			id: 'blend-1',
			type: 'blend',
			data: {
				amount: 0.5
			},
			position: { x: 250, y: 100 }
		},
		{
			id: 'rotate-1',
			type: 'rotate',
			data: {
				angle: 0.5,
				speed: 0.1
			},
			position: { x: 400, y: 100 }
		},
		{
			id: 'out-1',
			type: 'out',
			data: {
				outputIndex: 0
			},
			position: { x: 550, y: 100 }
		}
	]);
	let edges = $state.raw<IREdge[]>([
		{
			id: 'edge-1',
			source: 'osc-1',
			target: 'blend-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-0'
		},
		{
			id: 'edge-2',
			source: 'noise-1',
			target: 'blend-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-1'
		},
		{
			id: 'edge-3',
			source: 'blend-1',
			target: 'rotate-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-0'
		},
		{
			id: 'edge-4',
			source: 'rotate-1',
			target: 'out-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-0'
		}
	]);

	function addNode(node: Omit<IRNode, 'id'>): string {
		const id = nanoid();
		const newNode: IRNode = {
			...node,
			id,
			position: node.position || { x: 0, y: 0 }
		};
		nodes = [...nodes, newNode];
		return id;
	}

	function addEdge(edge: Omit<IREdge, 'id'>): string {
		const id = nanoid();
		const newEdge: IREdge = {
			...edge,
			id,
			sourceHandle: edge.sourceHandle,
			targetHandle: edge.targetHandle
		};
		edges = [...edges, newEdge];
		return id;
	}

	let validationIssues = $state.raw<Issue[]>([]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function updateNodeData(nodeId: string, data: Record<string, any>): void {
		nodes = nodes.map((node) =>
			node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
		);
	}
</script>

<div class="w-full h-screen bg-black relative">
	<!-- Fullscreen Canvas Background -->
	<HydraCanvas {nodes} {edges} onValidationIssues={(issues) => (validationIssues = issues)} />

	<!-- Flow Editor Overlay -->
	<FlowEditor bind:nodes bind:edges {addNode} {addEdge} {updateNodeData} {validationIssues} />
</div>
