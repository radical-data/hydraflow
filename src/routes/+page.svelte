<script lang="ts">
	import { onMount } from 'svelte';
	import HydraCanvas from '$lib/components/HydraCanvas.svelte';
	import FlowEditor from '$lib/components/FlowEditor.svelte';
	import { getNodes, getEdges, setNodes, addNode, addEdge } from '$lib/stores/editor.svelte.js';
	import type { IRNode, IREdge } from '$lib/types.js';
	
	onMount(() => {
		const nodes = getNodes();
		const edges = getEdges();
		
		// Only initialize if empty
		if (nodes.length === 0) {
			// Add initial osc node
			const oscId = addNode({
				type: 'osc',
				data: {
					frequency: 5.0,
					sync: 0.5,
					offset: 0.5
				}
			});
			
			// Add initial output node
			const outId = addNode({
				type: 'out',
				data: {
					outputIndex: 0
				}
			});
			
			// Position the nodes
			const updatedNodes = getNodes();
			const oscNode = updatedNodes.find(n => n.id === oscId);
			const outNode = updatedNodes.find(n => n.id === outId);
			
			if (oscNode) (oscNode as any).position = { x: 100, y: 100 };
			if (outNode) (outNode as any).position = { x: 300, y: 100 };
			
			setNodes([...updatedNodes]);
			
			// Connect them
			addEdge({
				source: oscId,
				target: outId
			});
		}
	});

</script>

<div class="w-full h-screen bg-black relative">
	<!-- Fullscreen Canvas Background -->
	<HydraCanvas nodes={getNodes()} edges={getEdges()} />
	
	<!-- Flow Editor Overlay -->
	<FlowEditor />
</div>
