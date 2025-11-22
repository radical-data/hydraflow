<script lang="ts">
	import type { EdgeTypes, Node, OnBeforeConnect, OnBeforeReconnect } from '@xyflow/svelte';
	import { Background, Controls, MiniMap, SvelteFlow } from '@xyflow/svelte';
	import { onDestroy, onMount, setContext } from 'svelte';

	import type { Issue } from '../engine/HydraEngine.js';
	import { getAllDefinitions } from '../nodes/registry.js';
	import type { InputValue, IREdge, IRNode, NodeDefinition } from '../types.js';
	import { getLayoutedElements } from '../utils/layout.js';
	import { createLayoutAnimator } from '../utils/layoutAnimator.js';
	import CustomEdge from './CustomEdge.svelte';
	import CustomNode from './CustomNode.svelte';
	let {
		nodes = $bindable(),
		edges = $bindable(),
		addNode,
		updateNodeData,
		validationIssues = []
	} = $props<{
		nodes: IRNode[];
		edges: IREdge[];
		addNode: (node: Omit<IRNode, 'id'>) => string;
		updateNodeData: (nodeId: string, data: Record<string, InputValue>) => void;
		validationIssues?: Issue[];
	}>();

	let displayNodes = $state.raw<IRNode[]>([]);
	let isInitialized = $state(false);
	let selectedNodeId = $state<string | null>(null);
	let selectedEdgeId = $state<string | null>(null);
	let deleteButtonPosition = $state<{ x: number; y: number } | null>(null);
	let isMobile = $state(false);
	let lastClickPosition = $state<{ x: number; y: number } | null>(null);

	type NodeValidationStatus = {
		hasError: boolean;
		hasWarning: boolean;
		issues: Issue[];
	};

	type EdgeValidationStatus = {
		hasError: boolean;
		hasWarning: boolean;
	};

	// Types for SvelteFlow nodes/edges with selection state
	type SelectableNode = IRNode & { selected?: boolean };
	type SelectableEdge = IREdge & { selected?: boolean };

	const edgeTypes: EdgeTypes = {
		default: CustomEdge
	};

	let nodeDefinitions = $state<NodeDefinition[]>([]);
	let nodeTypes = $state<Record<string, typeof CustomNode>>({});

	const validationByNodeId = $derived(() => {
		// We intentionally build a fresh Map snapshot from validationIssues each time to avoid
		// mutating reactive containers inside effects, which was causing update-at-update errors.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map<string, NodeValidationStatus>();
		for (const issue of validationIssues) {
			if (!issue.nodeId) continue;
			let status = map.get(issue.nodeId);
			if (!status) {
				status = { hasError: false, hasWarning: false, issues: [] };
				map.set(issue.nodeId, status);
			}
			status.issues.push(issue);
			if (issue.severity === 'error') status.hasError = true;
			if (issue.severity === 'warning') status.hasWarning = true;
		}
		return map;
	});

	const edgeValidationById = $derived(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map<string, EdgeValidationStatus>();
		const nodeMap = validationByNodeId();
		for (const edge of edges) {
			const sourceStatus = nodeMap.get(edge.source);
			const targetStatus = nodeMap.get(edge.target);
			const hasError = !!sourceStatus?.hasError || !!targetStatus?.hasError;
			const hasWarning = !hasError && (!!sourceStatus?.hasWarning || !!targetStatus?.hasWarning);
			if (hasError || hasWarning) {
				map.set(edge.id, { hasError, hasWarning });
			}
		}
		return map;
	});

	setContext('updateNodeData', updateNodeData);
	setContext('nodeDefinitions', () => nodeDefinitions);
	setContext('validationByNodeId', () => validationByNodeId());
	setContext('edgeValidationById', () => edgeValidationById());

	let lastIssueKeys = new Set<string>();

	$effect(() => {
		const issues: Issue[] = validationIssues ?? [];
		const keys = new Set<string>(issues.map((i: Issue) => i.key));
		const changed =
			keys.size !== lastIssueKeys.size ||
			Array.from(keys).some((k: string) => !lastIssueKeys.has(k));

		if (changed && issues.length > 0) {
			console.error('Graph issues:', issues);
			lastIssueKeys = keys;
		}
	});

	$effect(() => {
		getAllDefinitions().then((definitions) => {
			nodeDefinitions = definitions;
			nodeTypes = definitions.reduce(
				(types, def) => {
					types[def.id] = CustomNode;
					return types;
				},
				{} as Record<string, typeof CustomNode>
			);
		});
	});

	function addNodeToFlow(definition: NodeDefinition) {
		const x = Math.random() * 400 + 100;
		const y = Math.random() * 300 + 100;

		addNode({
			type: definition.id,
			data: definition.inputs.reduce(
				(acc, input) => {
					acc[input.id] = input.default;
					return acc;
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as Record<string, any>
			),
			position: { x, y }
		});
	}

	const POSITION_TOLERANCE = 0.5;
	const LAYOUT_DIRECTION = 'TB';

	const animator = createLayoutAnimator(250);

	function shouldApplyAutoLayout(currentNodes: IRNode[], layoutedNodes: IRNode[]): boolean {
		if (currentNodes.length !== layoutedNodes.length) {
			return true;
		}

		const layoutMap = new Map(layoutedNodes.map((node) => [node.id, node]));

		for (const node of currentNodes) {
			const layoutNode = layoutMap.get(node.id);
			if (!layoutNode) {
				return true;
			}

			const deltaX = Math.abs((node.position?.x ?? 0) - layoutNode.position.x);
			const deltaY = Math.abs((node.position?.y ?? 0) - layoutNode.position.y);

			if (deltaX > POSITION_TOLERANCE || deltaY > POSITION_TOLERANCE) {
				return true;
			}

			if (
				node.sourcePosition !== layoutNode.sourcePosition ||
				node.targetPosition !== layoutNode.targetPosition
			) {
				return true;
			}
		}

		return false;
	}

	$effect(() => {
		if (nodes.length === 0) {
			return;
		}

		const layouted = getLayoutedElements(nodes, edges, LAYOUT_DIRECTION);

		if (!shouldApplyAutoLayout(nodes, layouted.nodes)) {
			return;
		}

		nodes = [...layouted.nodes];
		edges = [...layouted.edges];
	});

	$effect(() => {
		if (nodes.length === 0) {
			isInitialized = true;
			animator.handleLayoutChange([], (next) => {
				displayNodes = next;
			});
			return;
		}

		if (!isInitialized) {
			displayNodes = [...nodes];
			isInitialized = true;
			animator.handleLayoutChange(nodes, (next) => {
				displayNodes = next;
			});
			return;
		}

		animator.handleLayoutChange(nodes, (next) => {
			displayNodes = next;
		});
	});

	onDestroy(() => {
		animator.stop();
	});

	function disconnectExistingTarget(
		targetNodeId: string | null | undefined,
		targetHandleId: string | null | undefined
	): void {
		if (!targetNodeId || !targetHandleId) return;

		// Keep every edge that is NOT on this (target, targetHandle)
		edges = edges.filter(
			(e: IREdge) => e.target !== targetNodeId || e.targetHandle !== targetHandleId
		);
	}

	function clearTargetHandle(conn: { target?: string | null; targetHandle?: string | null }) {
		disconnectExistingTarget(conn.target ?? null, conn.targetHandle ?? null);
	}

	const handleBeforeConnect: OnBeforeConnect = (connection) => {
		clearTargetHandle(connection);
		return connection;
	};

	const handleBeforeReconnect: OnBeforeReconnect = (_oldEdge, newConnection) => {
		clearTargetHandle(newConnection);
		return newConnection;
	};

	// Mobile detection
	onMount(() => {
		const checkMobile = () => {
			isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});

	// Track selected nodes and edges reactively
	$effect(() => {
		if (!isMobile) {
			selectedNodeId = null;
			selectedEdgeId = null;
			deleteButtonPosition = null;
			return;
		}

		// Find selected node
		const selectedNode = displayNodes.find((n: IRNode) => (n as SelectableNode).selected);
		const selectedEdge = edges.find((e: IREdge) => (e as SelectableEdge).selected);

		if (selectedNode) {
			selectedNodeId = selectedNode.id;
			selectedEdgeId = null;
			// Use last click position if available, otherwise position near node
			if (lastClickPosition) {
				deleteButtonPosition = { x: lastClickPosition.x, y: lastClickPosition.y - 50 };
			} else {
				// Fallback: position in center of screen
				deleteButtonPosition = { x: window.innerWidth / 2, y: 100 };
			}
		} else if (selectedEdge) {
			selectedEdgeId = selectedEdge.id;
			selectedNodeId = null;
			// Use last click position if available
			if (lastClickPosition) {
				deleteButtonPosition = { x: lastClickPosition.x, y: lastClickPosition.y - 50 };
			} else {
				// Fallback: position in center of screen
				deleteButtonPosition = { x: window.innerWidth / 2, y: 100 };
			}
		} else {
			selectedNodeId = null;
			selectedEdgeId = null;
			deleteButtonPosition = null;
			lastClickPosition = null;
		}
	});

	// Capture click position for button placement
	// Use a small delay to capture position after SvelteFlow processes the click
	function handleFlowClick(event: MouseEvent | TouchEvent) {
		if (!isMobile) return;
		// Use setTimeout to capture position after SvelteFlow processes selection
		setTimeout(() => {
			const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
			const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
			if (clientX !== undefined && clientY !== undefined) {
				lastClickPosition = { x: clientX, y: clientY };
			}
		}, 10);
	}

	// Delete selected node
	function deleteSelectedNode() {
		if (selectedNodeId) {
			// Remove the node
			nodes = nodes.filter((n) => n.id !== selectedNodeId);
			// Remove all edges connected to this node
			edges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
			selectedNodeId = null;
			deleteButtonPosition = null;
		}
	}

	// Delete selected edge
	function deleteSelectedEdge() {
		if (selectedEdgeId) {
			edges = edges.filter((e) => e.id !== selectedEdgeId);
			selectedEdgeId = null;
			deleteButtonPosition = null;
		}
	}

	// Handle delete button click
	function handleDelete(event: MouseEvent | TouchEvent) {
		event.stopPropagation();
		if (selectedNodeId) {
			deleteSelectedNode();
		} else if (selectedEdgeId) {
			deleteSelectedEdge();
		}
	}
</script>

<div class="flow-editor">
	<div class="toolbar">
		<h2>Hydra Flow</h2>
		<div class="debug-info">
			Nodes: {nodes.length} | Edges: {edges.length}
		</div>
		<div class="node-buttons">
			{#if nodeDefinitions.length === 0}
				<div class="loading">Loading nodes...</div>
			{:else}
				{#each nodeDefinitions as definition (definition.id)}
					<button onclick={() => addNodeToFlow(definition as NodeDefinition)} class="add-node-btn">
						+ {(definition as NodeDefinition).label}
					</button>
				{/each}
			{/if}
		</div>
	</div>
	<div class="flow-canvas" onclick={handleFlowClick} ontouchstart={handleFlowClick}>
		{#if Object.keys(nodeTypes).length > 0}
			<SvelteFlow
				bind:nodes={displayNodes as Node[]}
				bind:edges
				{nodeTypes}
				{edgeTypes}
				fitView
				nodesDraggable={false}
				onbeforeconnect={handleBeforeConnect}
				onbeforereconnect={handleBeforeReconnect}
				class="flow-container"
			>
				<Background />
				<Controls showLock={false} />
				<MiniMap />
			</SvelteFlow>
			{#if isMobile && deleteButtonPosition && (selectedNodeId || selectedEdgeId)}
				<button
					class="mobile-delete-btn"
					style="left: {deleteButtonPosition.x}px; top: {deleteButtonPosition.y}px;"
					onclick={handleDelete}
					onmousedown={(e) => e.stopPropagation()}
					ontouchstart={(e) => e.stopPropagation()}
					role="button"
					aria-label="Delete {selectedNodeId ? 'node' : 'edge'}"
				>
					Delete
				</button>
			{/if}
		{:else}
			<div class="loading-canvas">
				<div class="loading-message">Initializing Hydra Flow...</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.flow-editor {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(2px);
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		background: rgba(255, 255, 255, 0.9);
		padding: 12px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		gap: 16px;
		backdrop-filter: blur(4px);
	}

	.toolbar h2 {
		margin: 0;
		font-size: 18px;
		color: #333;
	}

	.debug-info {
		font-size: 12px;
		color: #666;
		margin: 4px 0;
	}

	.node-buttons {
		display: flex;
		gap: 8px;
		overflow-x: auto;
	}

	.add-node-btn {
		padding: 6px 12px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.2s;
	}

	.add-node-btn:hover {
		background: #1976d2;
	}

	.loading {
		font-size: 12px;
		color: #666;
		padding: 6px 12px;
	}

	.flow-canvas {
		flex: 1;
		position: relative;
	}

	.loading-canvas {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.05);
	}

	.loading-message {
		font-size: 18px;
		color: #666;
		background: rgba(255, 255, 255, 0.9);
		padding: 20px 40px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	/* SvelteFlow overrides for transparency and smaller nodes */
	:global(.svelte-flow) {
		background: transparent !important;
	}

	:global(.svelte-flow__background) {
		opacity: 0.3;
	}

	:global(.svelte-flow__controls) {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(4px);
	}

	:global(.svelte-flow__minimap) {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(4px);
	}

	.mobile-delete-btn {
		position: fixed;
		z-index: 1000;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 10px 20px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transform: translate(-50%, -100%);
		transition: all 0.2s ease;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		pointer-events: auto;
	}

	.mobile-delete-btn:active {
		background: #dc2626;
		transform: translate(-50%, -100%) scale(0.95);
	}

	@media (min-width: 769px) {
		.mobile-delete-btn {
			display: none;
		}
	}
</style>
