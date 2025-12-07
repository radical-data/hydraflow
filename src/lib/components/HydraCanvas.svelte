<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import type { GraphValidationResult } from '../engine/graphValidation.js';
	import type { IREdge, IRNode } from '../types.js';

	let {
		nodes = [],
		edges = [],
		onValidationResult
	} = $props<{
		nodes?: IRNode[];
		edges?: IREdge[];
		onValidationResult?: (result: GraphValidationResult) => void;
	}>();

	let canvas: HTMLCanvasElement;
	let engine: import('../engine/HydraEngine.js').HydraEngine;
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
	});

	onDestroy(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (engine) {
			engine.destroy();
		}
	});

	const EXECUTE_DEBOUNCE_MS = 50;

	$effect(() => {
		const ready = isInitialized && !!engine && nodes.length > 0;
		const graphNodes = nodes;
		const graphEdges = edges;

		if (!ready) return;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			if (!engine) return;

			const validation = engine.executeGraph(graphNodes, graphEdges);
			onValidationResult?.(validation);
		}, EXECUTE_DEBOUNCE_MS);
	});
</script>

<canvas bind:this={canvas} class="absolute inset-0 w-full h-full" style="display: block;"></canvas>
