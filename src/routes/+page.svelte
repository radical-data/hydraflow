<script lang="ts">
	import { onMount } from 'svelte';
	import { nanoid } from 'nanoid';
	import HydraCanvas from '$lib/components/HydraCanvas.svelte';
	import FlowEditor from '$lib/components/FlowEditor.svelte';
	import type { IRNode, IREdge } from '$lib/types.js';
	
	let nodes = $state.raw<IRNode[]>([
		{
			id: 'osc-1',
			type: 'osc',
			data: {
				frequency: 5.0,
				sync: 0.5,
				offset: 0.5
			},
			position: { x: 100, y: 100 }
		},
		{
			id: 'out-1',
			type: 'out',
			data: {
				outputIndex: 0
			},
			position: { x: 300, y: 100 }
		}
	]);
	let edges = $state.raw<IREdge[]>([
		{
			id: 'edge-1',
			source: 'osc-1',
			target: 'out-1'
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
		const newEdge: IREdge = { ...edge, id };
		edges = [...edges, newEdge];
		return id;
	}
	
	function updateNodeData(nodeId: string, data: Record<string, any>): void {
		nodes = nodes.map(node => 
			node.id === nodeId 
				? { ...node, data: { ...node.data, ...data } }
				: node
		);
	}

</script>

<div class="w-full h-screen bg-black relative">
	<!-- Fullscreen Canvas Background -->
	<HydraCanvas {nodes} {edges} />
	
	<!-- Flow Editor Overlay -->
	<FlowEditor {nodes} {edges} {addNode} {addEdge} {updateNodeData} />
</div>
