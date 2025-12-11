<script lang="ts">
	import type {
		EdgeTypes,
		Node,
		NodeTypes,
		OnBeforeConnect,
		OnBeforeReconnect,
		OnDelete
	} from '@xyflow/svelte';
	import { Background, Controls, MiniMap, SvelteFlow } from '@xyflow/svelte';
	import { onDestroy, setContext } from 'svelte';

	import type {
		EdgeValidationStatus,
		GraphValidationResult,
		Issue,
		NodeValidationStatus
	} from '../engine/graphValidation.js';
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
		validationResult = null,
		nodeDefinitions: nodeDefinitionsProp = []
	} = $props<{
		nodes: IRNode[];
		edges: IREdge[];
		addNode: (node: Omit<IRNode, 'id'>) => string;
		updateNodeData: (nodeId: string, data: Record<string, InputValue>) => void;
		validationResult?: GraphValidationResult | null;
		nodeDefinitions: NodeDefinition[];
	}>();

	let displayNodes = $state.raw<IRNode[]>([]);
	let isInitialized = $state(false);

	const edgeTypes: EdgeTypes = {
		default: CustomEdge
	};

	// Local copies of node definitions and nodeTypes map,
	// derived from the prop but stored as plain state for TS + runtime sanity.
	let nodeDefinitions = $state<NodeDefinition[]>([]);
	let nodeTypes = $state<NodeTypes>({});

	$effect(() => {
		// Keep local state in sync with the prop
		nodeDefinitions = nodeDefinitionsProp;

		// Build the nodeTypes map for SvelteFlow
		nodeTypes = nodeDefinitionsProp.reduce(
			(acc: Record<string, typeof CustomNode>, def: NodeDefinition) => {
				acc[def.id] = CustomNode;
				return acc;
			},
			{} as Record<string, typeof CustomNode>
		);
	});

	const categories: NodeDefinition['category'][] = ['source', 'modifier', 'mixer', 'output'];

	const categoryLabels: Record<NodeDefinition['category'], string> = {
		source: 'Sources',
		modifier: 'Modifiers',
		mixer: 'Mixers',
		output: 'Outputs'
	};

	const tabCategories: NodeDefinition['category'][] = ['source', 'modifier', 'mixer', 'output'];
	let activeCategory = $state<NodeDefinition['category']>('source');

	const nodesByCategory = $derived(() => {
		const groups: Record<NodeDefinition['category'], NodeDefinition[]> = {
			source: [],
			modifier: [],
			mixer: [],
			output: []
		};

		for (const def of nodeDefinitions) {
			groups[def.category].push(def);
		}

		for (const cat of categories) {
			groups[cat].sort((a, b) => a.label.localeCompare(b.label));
		}

		return groups;
	});

	const validationByNodeId = $derived(
		() => validationResult?.nodeStatusById ?? new Map<string, NodeValidationStatus>()
	);

	const edgeValidationById = $derived(
		() => validationResult?.edgeStatusById ?? new Map<string, EdgeValidationStatus>()
	);

	setContext('updateNodeData', updateNodeData);
	setContext('nodeDefinitions', () => nodeDefinitions);
	setContext('validationByNodeId', () => validationByNodeId());
	setContext('edgeValidationById', () => edgeValidationById());
	setContext('edgeById', () => new Map(edges.map((e: IREdge) => [e.id, e])));

	let lastIssueKeys = new Set<string>();

	$effect(() => {
		const issues: Issue[] = validationResult?.issues ?? [];
		const keys = new Set<string>(issues.map((i) => i.key));
		const changed =
			keys.size !== lastIssueKeys.size ||
			Array.from(keys).some((k: string) => !lastIssueKeys.has(k));

		if (changed && issues.length > 0) {
			console.error('Graph issues:', issues);
			lastIssueKeys = keys;
		}
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

	const handleDelete: OnDelete = ({ nodes: deletedNodes, edges: deletedEdges }) => {
		if (!deletedNodes.length && !deletedEdges.length) return;

		const deletedNodeIds = new Set(deletedNodes.map((n) => n.id));
		const deletedEdgeIds = new Set(deletedEdges.map((e) => e.id));

		// SvelteFlow deletes from its own view state only.
		// We must also update our canonical graph (nodes/edges). If not, deleted items
		// will reappear when layout + animation runs next.
		nodes = nodes.filter((node: IRNode) => !deletedNodeIds.has(node.id));

		// Clean up canonical edges:
		//  - remove edges deleted by SvelteFlow
		//  - remove any edges connected to deleted nodes (defensive)
		edges = edges.filter(
			(edge: IREdge) =>
				!deletedEdgeIds.has(edge.id) &&
				!deletedNodeIds.has(edge.source) &&
				!deletedNodeIds.has(edge.target)
		);
	};

	function wouldCreateCycle(
		adjacency: Map<string, string[]>,
		source: string,
		target: string
	): boolean {
		const goal = source;
		const stack = [target];
		/* eslint-disable-next-line svelte/prefer-svelte-reactivity */
		const visited = new Set<string>();

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (current === goal) return true;
			if (visited.has(current)) continue;
			visited.add(current);

			const neighbours = adjacency.get(current) ?? [];
			for (const n of neighbours) {
				if (!visited.has(n)) {
					stack.push(n);
				}
			}
		}

		return false;
	}

	$effect(() => {
		// Recompute delay flags from scratch whenever edges change.
		// Algorithm: build a DAG by marking cycle-closing edges as delay edges.
		// Existing delay edges are ignored when detecting cycles, so cycles that already
		// pass through a delay edge are treated as intentional feedback.
		// Note: Order-dependent - the last edge in insertion order that closes a cycle
		// becomes the delay edge.

		if (edges.length === 0) return;

		/* eslint-disable-next-line svelte/prefer-svelte-reactivity */
		const adjacency = new Map<string, string[]>();
		const desiredDelayFlags: number[] = [];

		for (const edge of edges) {
			// Delay edges are ignored here: they break cycles but don't participate in forward traversal
			if (edge.delayFrames && edge.delayFrames > 0) {
				desiredDelayFlags.push(1);
				continue;
			}

			const makesCycle = wouldCreateCycle(adjacency, edge.source, edge.target);

			if (makesCycle) {
				// Mark this edge as delay to break the cycle
				desiredDelayFlags.push(1);
			} else {
				desiredDelayFlags.push(0);
				const list = adjacency.get(edge.source) ?? [];
				list.push(edge.target);
				adjacency.set(edge.source, list);
			}
		}

		// Check if anything actually changed; if not, bail to avoid infinite reactive loops
		let anyChanged = false;
		for (let i = 0; i < edges.length; i++) {
			const current = edges[i].delayFrames ?? 0;
			if (current !== desiredDelayFlags[i]) {
				anyChanged = true;
				break;
			}
		}
		if (!anyChanged) return;

		// Apply the new delay flags immutably so Svelte change detection still works
		edges = edges.map((edge: IREdge, i: number) => {
			const flag = desiredDelayFlags[i];
			if (flag === 0) {
				// Strip stale delayFrames if present
				if (!edge.delayFrames) return edge;
				/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
				const { delayFrames, ...rest } = edge;
				return rest as IREdge;
			}
			return { ...edge, delayFrames: 1 };
		});
	});
</script>

<div class="flow-editor">
	<div class="toolbar">
		<div class="toolbar-left">
			<div class="category-tabs">
				{#each tabCategories as category (category)}
					{@const groups = nodesByCategory()}
					<button
						class="category-tab"
						class:active={activeCategory === category}
						onclick={() => (activeCategory = category)}
					>
						{categoryLabels[category]}
						<span class="tab-count">
							({groups[category].length})
						</span>
					</button>
				{/each}
			</div>
			<div class="node-buttons">
				{#if nodeDefinitions.length === 0}
					<div class="loading">Loading nodes...</div>
				{:else}
					{@const groups = nodesByCategory()}
					<div class="node-buttons-inner">
						{#each groups[activeCategory] as definition (definition.id)}
							<button
								onclick={() => addNodeToFlow(definition as NodeDefinition)}
								class="add-node-btn"
								class:output-btn={activeCategory === 'output'}
							>
								+ {(definition as NodeDefinition).label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
	<div class="flow-canvas">
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
				ondelete={handleDelete}
				class="flow-container"
			>
				<Background />
				<Controls showLock={false} />
				<MiniMap />
			</SvelteFlow>
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
		padding: 8px 12px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		backdrop-filter: blur(4px);
	}

	.toolbar-left {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		width: 100%;
		min-width: 0;
	}

	.node-buttons {
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.node-buttons::-webkit-scrollbar {
		display: none;
	}

	.node-buttons-inner {
		display: flex;
		flex-wrap: nowrap;
		gap: 6px;
		white-space: nowrap;
		padding-top: 2px;
	}

	.category-tabs {
		display: flex;
		flex-wrap: nowrap;
		gap: 6px;
		margin-top: 2px;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.category-tab {
		padding: 4px 8px;
		border-radius: 9999px;
		border: 1px solid #e5e7eb;
		background: #f9fafb;
		font-size: 11px;
		font-weight: 600;
		color: #4b5563;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.category-tab.active {
		background: #ec4899;
		border-color: #ec4899;
		color: white;
	}

	.tab-count {
		font-weight: 400;
		opacity: 0.8;
	}

	.add-node-btn {
		padding: 4px 10px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 11px;
		font-weight: 600;
		transition: background 0.2s;
	}

	.add-node-btn:hover {
		background: #1976d2;
	}

	.output-btn {
		background: #10b981;
	}

	.output-btn:hover {
		background: #059669;
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
</style>
