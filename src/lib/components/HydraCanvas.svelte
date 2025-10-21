<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { IRNode, IREdge } from '../types.js';

	let { nodes = [], edges = [] } = $props<{ nodes?: IRNode[]; edges?: IREdge[] }>();

	let canvas: HTMLCanvasElement;
	let engine: any; // HydraEngine - using any to avoid SSR issues
	let isInitialized = $state(false);

	onMount(async () => {
		const { HydraEngine } = await import('../engine/HydraEngine.js');
		engine = new HydraEngine();
		await engine.init(canvas);
		engine.start();
		isInitialized = true;
		
		if (nodes.length > 0) {
			execute();
		}
	});

	onDestroy(() => {
		if (engine) {
			engine.destroy();
		}
	});

	const nodeData = $derived(nodes.map((node: IRNode) => ({ id: node.id, type: node.type, data: node.data })));
	const edgeData = $derived(edges.map((edge: IREdge) => ({ id: edge.id, source: edge.source, target: edge.target })));

	$effect(() => {
		nodeData;
		edgeData;
		
		if (isInitialized && nodes.length > 0) {
			execute();
		}
	});

	function execute() {
		if (engine && isInitialized) {
			engine.executeGraph(nodes, edges);
		}
	}

	function handleResize() {
		if (engine && canvas) {
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width;
			canvas.height = rect.height;
			engine.setResolution(rect.width, rect.height);
		}
	}

	let resizeObserver = $state<ResizeObserver>();
	
	onMount(() => {
		if (canvas) {
			resizeObserver = new ResizeObserver(handleResize);
			resizeObserver.observe(canvas);
		}
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});
</script>

<canvas
	bind:this={canvas}
	class="w-full h-full"
	style="display: block;"
></canvas>
