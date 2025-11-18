<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import type { Issue } from '../engine/HydraEngine.js';
	import type { IREdge, IRNode } from '../types.js';

	let {
		nodes = [],
		edges = [],
		onValidationIssues
	} = $props<{
		nodes?: IRNode[];
		edges?: IREdge[];
		onValidationIssues?: (issues: Issue[]) => void;
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

			const issues = engine.executeGraph(graphNodes, graphEdges);

			if (issues.length > 0) {
				console.error('Graph issues:', issues);
			}

			onValidationIssues?.(issues);
		}, EXECUTE_DEBOUNCE_MS);
	});
</script>

<canvas bind:this={canvas} class="absolute inset-0 w-full h-full" style="display: block;"></canvas>
