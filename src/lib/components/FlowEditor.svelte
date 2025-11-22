<script lang="ts">
	import type { EdgeTypes } from '@xyflow/svelte';
	import { Background, Controls, MiniMap, Panel, SvelteFlow } from '@xyflow/svelte';
	import { setContext } from 'svelte';

	import type { Issue } from '../engine/HydraEngine.js';
	import { getAllDefinitions } from '../nodes/registry.js';
	import type { InputValue, IREdge, IRNode, NodeDefinition } from '../types.js';
	import { getLayoutedElements } from '../utils/layout.js';
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

	type NodeValidationStatus = {
		hasError: boolean;
		hasWarning: boolean;
		issues: Issue[];
	};

	type EdgeValidationStatus = {
		hasError: boolean;
		hasWarning: boolean;
	};

	const edgeTypes: EdgeTypes = {
		default: CustomEdge
	};

	let nodeDefinitions = $state<NodeDefinition[]>([]);
	let nodeTypes = $state<Record<string, typeof CustomNode>>({});

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

	function onLayout(direction: 'TB' | 'LR') {
		const layouted = getLayoutedElements(nodes, edges, direction);
		nodes = [...layouted.nodes];
		edges = [...layouted.edges];
	}
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
			<SvelteFlow bind:nodes bind:edges {nodeTypes} {edgeTypes} fitView class="flow-container">
				<Background />
				<Controls />
				<MiniMap />
				<Panel position="top-right">
					<div class="layout-buttons">
						<button onclick={() => onLayout('TB')} class="layout-btn"> Vertical </button>
						<button onclick={() => onLayout('LR')} class="layout-btn"> Horizontal </button>
					</div>
				</Panel>
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

	.layout-buttons {
		display: flex;
		gap: 8px;
		background: rgba(255, 255, 255, 0.95);
		padding: 12px;
		border-radius: 8px;
		backdrop-filter: blur(4px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.layout-btn {
		padding: 8px 12px;
		background: #4caf50;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.layout-btn:hover {
		background: #45a049;
		transform: translateY(-1px);
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
