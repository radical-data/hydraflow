<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { HydraEngine } from '../engine/HydraEngine.js';
	import type { IREdge, IRNode } from '../types.js';

	let { nodes = [], edges = [] } = $props<{ nodes?: IRNode[]; edges?: IREdge[] }>();

	let canvas: HTMLCanvasElement;
	let engine: HydraEngine;
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

	const nodeData = $derived(
		nodes.map((node: IRNode) => ({ id: node.id, type: node.type, data: node.data }))
	);
	const edgeData = $derived(
		edges.map((edge: IREdge) => ({ id: edge.id, source: edge.source, target: edge.target }))
	);

	$effect(() => {
		void nodeData;
		void edgeData;

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
</script>

<canvas bind:this={canvas} class="absolute inset-0 w-full h-full" style="display: block;"></canvas>
