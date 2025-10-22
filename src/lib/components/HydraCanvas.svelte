<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { IRNode, IREdge } from '../types.js';

	let { nodes = [], edges = [] } = $props<{ nodes?: IRNode[]; edges?: IREdge[] }>();

	let canvas: HTMLCanvasElement;
	let engine: any; // HydraEngine - using any to avoid SSR issues
	let isInitialized = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		
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
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
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
			debouncedExecute();
		}
	});

	function debouncedExecute() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		
		debounceTimer = setTimeout(() => {
			execute();
		}, 50);
	}

	function execute() {
		if (engine && isInitialized) {
			engine.executeGraph(nodes, edges);
		}
	}

	function handleResize() {
		if (engine && canvas) {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			engine.setResolution(window.innerWidth, window.innerHeight);
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
	class="absolute inset-0 w-full h-full"
	style="display: block;"
></canvas>
