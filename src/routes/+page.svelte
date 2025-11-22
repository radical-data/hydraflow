<script lang="ts">
	import { nanoid } from 'nanoid';

	import FlowEditor from '$lib/components/FlowEditor.svelte';
	import HydraCanvas from '$lib/components/HydraCanvas.svelte';
	import type { Issue } from '$lib/engine/HydraEngine.js';
	import { defaultExample } from '$lib/examples/default.js';
	import type { ExamplePatch } from '$lib/examples/types.js';
	import type { IREdge, IRNode } from '$lib/types.js';

	let nodes = $state.raw<IRNode[]>(defaultExample.nodes);
	let edges = $state.raw<IREdge[]>(defaultExample.edges);

	function loadExample(ex: ExamplePatch) {
		// Ensure fresh ids to avoid collisions if user already added stuff
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const idMap = new Map<string, string>();
		const remapId = (oldId: string) => {
			if (!idMap.has(oldId)) idMap.set(oldId, nanoid());
			return idMap.get(oldId)!;
		};

		nodes = ex.nodes.map((n) => ({
			...n,
			id: remapId(n.id)
		}));

		edges = ex.edges.map((e) => ({
			...e,
			id: nanoid(),
			source: remapId(e.source),
			target: remapId(e.target)
		}));
	}

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

	let validationIssues = $state.raw<Issue[]>([]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function updateNodeData(nodeId: string, data: Record<string, any>): void {
		nodes = nodes.map((node) =>
			node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
		);
	}
</script>

<div class="w-full h-screen bg-black relative">
	<HydraCanvas {nodes} {edges} onValidationIssues={(issues) => (validationIssues = issues)} />

	<FlowEditor
		bind:nodes
		bind:edges
		{addNode}
		{updateNodeData}
		{validationIssues}
		onSelectExample={loadExample}
	/>
</div>
