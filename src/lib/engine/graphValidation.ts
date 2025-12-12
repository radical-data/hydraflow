import type { IREdge, IRNode } from '../types.js';

export type IssueSeverity = 'error' | 'warning';

export type IssueKind =
	| 'CYCLE'
	| 'NODE_NOT_FOUND'
	| 'UNKNOWN_TRANSFORM'
	| 'NODE_MISSING_INPUTS'
	| 'NODE_EXTRA_INPUTS'
	| 'OUTPUT_INDEX_OUT_OF_RANGE'
	| 'OUTPUT_ARITY'
	| 'RUNTIME_EXECUTION_ERROR'
	| 'UNKNOWN_NODE_DATA_KEY';

export type Issue = {
	key: string;
	severity: IssueSeverity;
	kind: IssueKind;
	message: string;
	nodeId?: string;
	edgeId?: string;
	outputIndex?: number;
};

export interface NodeValidationStatus {
	hasError: boolean;
	hasWarning: boolean;
	isDead: boolean;
	issues: Issue[];
}

export interface EdgeValidationStatus {
	hasError: boolean;
	hasWarning: boolean;
	isDead: boolean;
	issues: Issue[];
}

export interface GraphValidationResult {
	issues: Issue[];
	nodeStatusById: Map<string, NodeValidationStatus>;
	edgeStatusById: Map<string, EdgeValidationStatus>;
	reachableNodes: Set<string>;
	reachableEdges: Set<string>;
}

export type TransformKind = 'src' | 'coord' | 'color' | 'combine' | 'combineCoord';

export interface TransformMeta {
	arityByName: Map<string, 0 | 1 | 2>;
	kindByName: Map<string, TransformKind>;
	paramIdsByName: Map<string, string[]>;
	paramDefaultsByName: Map<string, unknown[]>;
}

export interface GraphValidationParams {
	nodes: IRNode[];
	edges: IREdge[];
	numOutputs: number;
	meta: TransformMeta;
}

export function makeIssueKey(kind: IssueKind, parts: Array<string | number | undefined>): string {
	return [kind, ...parts.map((p) => (p ?? '').toString())].join(':');
}

export function dedupeIssues(all: Issue[]): Issue[] {
	const byKey = new Map<string, Issue>();
	for (const issue of all) {
		if (!byKey.has(issue.key)) {
			byKey.set(issue.key, issue);
		}
	}
	return Array.from(byKey.values());
}

export function isFeedbackEdge(edge: IREdge): boolean {
	return edge.isFeedback === true;
}

export interface ReachabilityResult {
	reachableNodes: Set<string>;
	reachableEdges: Set<string>;
}

export function computeReachability(nodes: IRNode[], edges: IREdge[]): ReachabilityResult {
	const incomingByNodeId = new Map<string, IREdge[]>();

	for (const edge of edges) {
		if (!incomingByNodeId.has(edge.target)) incomingByNodeId.set(edge.target, []);
		incomingByNodeId.get(edge.target)!.push(edge);
	}

	const outputNodes = nodes.filter((n) => n.type === 'out');
	const reachableNodes = new Set<string>();
	const reachableEdges = new Set<string>();
	const queue: string[] = [];

	for (const outNode of outputNodes) {
		reachableNodes.add(outNode.id);
		queue.push(outNode.id);
	}

	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		const incoming = incomingByNodeId.get(nodeId) ?? [];
		for (const edge of incoming) {
			reachableEdges.add(edge.id);
			if (!reachableNodes.has(edge.source)) {
				reachableNodes.add(edge.source);
				queue.push(edge.source);
			}
		}
	}

	return { reachableNodes, reachableEdges };
}

export function rebuildGraphValidationResult(
	nodes: IRNode[],
	edges: IREdge[],
	issues: Issue[],
	reachableNodes: Set<string>,
	reachableEdges: Set<string>
): GraphValidationResult {
	const nodeStatusById = new Map<string, NodeValidationStatus>();
	for (const node of nodes) {
		const nodeIssues = issues.filter((i) => i.nodeId === node.id);
		const hasError = nodeIssues.some((i) => i.severity === 'error');
		const hasWarning = nodeIssues.some((i) => i.severity === 'warning');
		nodeStatusById.set(node.id, {
			hasError,
			hasWarning,
			isDead: !reachableNodes.has(node.id),
			issues: nodeIssues
		});
	}

	const edgeStatusById = new Map<string, EdgeValidationStatus>();
	for (const edge of edges) {
		const edgeIssues = issues.filter((i) => i.edgeId === edge.id);
		const sourceStatus = nodeStatusById.get(edge.source);
		const targetStatus = nodeStatusById.get(edge.target);
		const hasError =
			edgeIssues.some((i) => i.severity === 'error') ||
			!!sourceStatus?.hasError ||
			!!targetStatus?.hasError;
		const hasWarning =
			!hasError &&
			(edgeIssues.some((i) => i.severity === 'warning') ||
				!!sourceStatus?.hasWarning ||
				!!targetStatus?.hasWarning);

		edgeStatusById.set(edge.id, {
			hasError,
			hasWarning,
			isDead: !reachableEdges.has(edge.id),
			issues: edgeIssues
		});
	}

	return {
		issues,
		nodeStatusById,
		edgeStatusById,
		reachableNodes,
		reachableEdges
	};
}

export function validateGraph(params: GraphValidationParams): GraphValidationResult {
	const { nodes, edges, numOutputs, meta } = params;

	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	const incomingByNodeId = new Map<string, IREdge[]>();

	for (const edge of edges) {
		if (!incomingByNodeId.has(edge.target)) incomingByNodeId.set(edge.target, []);
		incomingByNodeId.get(edge.target)!.push(edge);
	}

	const issues: Issue[] = [];

	function addIssue(issue: Issue) {
		issues.push(issue);
	}

	const { reachableNodes, reachableEdges } = computeReachability(nodes, edges);
	const outputNodes = nodes.filter((n) => n.type === 'out');

	for (const outNode of outputNodes) {
		const outputIndexRaw = (outNode.data?.outputIndex ?? 0) as number;
		const outputIndex = Number(outputIndexRaw);

		if (!Number.isInteger(outputIndex) || outputIndex < 0 || outputIndex >= numOutputs) {
			addIssue({
				key: makeIssueKey('OUTPUT_INDEX_OUT_OF_RANGE', [outNode.id, outputIndex]),
				kind: 'OUTPUT_INDEX_OUT_OF_RANGE',
				severity: 'error',
				message: `Output index ${outputIndex} out of range (0…${numOutputs - 1})`,
				nodeId: outNode.id,
				outputIndex
			});
		}

		const inEdges = incomingByNodeId.get(outNode.id) ?? [];
		if (inEdges.length !== 1) {
			addIssue({
				key: makeIssueKey('OUTPUT_ARITY', [outNode.id]),
				kind: 'OUTPUT_ARITY',
				severity: 'error',
				message: `Output expects exactly 1 input, found ${inEdges.length}`,
				nodeId: outNode.id,
				outputIndex
			});
		}
	}

	const { arityByName, kindByName, paramIdsByName } = meta;

	// Validate unknown node.data keys
	for (const node of nodes) {
		// Skip unknown node types - let the "unknown transform" error be the primary signal
		if (!kindByName.has(node.type)) continue;

		const allowedKeys = new Set(paramIdsByName.get(node.type) ?? []);
		// UI-only keys (not in paramIdsByName, but valid for node.data):
		// - out.outputIndex: selects which Hydra output to write to
		// Add additional UI-only keys here if they exist in the future
		if (node.type === 'out') {
			allowedKeys.add('outputIndex');
		}

		const nodeData = node.data ?? {};
		for (const key of Object.keys(nodeData)) {
			if (!allowedKeys.has(key)) {
				// Sort for stable output
				const expectedList = Array.from(allowedKeys).sort().join(', ');
				addIssue({
					key: makeIssueKey('UNKNOWN_NODE_DATA_KEY', [node.id, key]),
					kind: 'UNKNOWN_NODE_DATA_KEY',
					severity: 'warning',
					message: `Node ${node.id} has unknown parameter "${key}" (expected: ${expectedList})`,
					nodeId: node.id
				});
			}
		}
	}

	function validateNodeInputArity(
		node: IRNode,
		tType: TransformKind,
		inputEdges: IREdge[]
	): Issue[] {
		const want = arityByName.get(node.type);
		const have = inputEdges.length;

		if (want == null || have === want) return [];

		const issueKind: IssueKind = have < want ? 'NODE_MISSING_INPUTS' : 'NODE_EXTRA_INPUTS';

		return [
			{
				key: makeIssueKey(issueKind, [node.id, node.type, want, have]),
				kind: issueKind,
				severity: have < want ? 'error' : 'warning',
				message: `${node.type} expects ${want} input(s), found ${have}`,
				nodeId: node.id
			}
		];
	}

	type BuildResult = { ok: true } | { ok: false; issues: Issue[] };

	const buildMemo = new Map<string, BuildResult>();

	function validateNodeChain(nodeId: string, stack: Set<string>): BuildResult {
		if (stack.has(nodeId)) {
			return {
				ok: false,
				issues: [
					{
						key: makeIssueKey('CYCLE', [nodeId]),
						kind: 'CYCLE',
						severity: 'error',
						message: `Same-frame cycle detected involving node ${nodeId} (feedback edges break cycles)`,
						nodeId
					}
				]
			};
		}

		if (buildMemo.has(nodeId)) return buildMemo.get(nodeId)!;

		const node = nodeById.get(nodeId);
		if (!node) {
			const result: BuildResult = {
				ok: false,
				issues: [
					{
						key: makeIssueKey('NODE_NOT_FOUND', [nodeId]),
						kind: 'NODE_NOT_FOUND',
						severity: 'error',
						message: `Node ${nodeId} not found`,
						nodeId
					}
				]
			};
			buildMemo.set(nodeId, result);
			return result;
		}

		if (!reachableNodes.has(nodeId)) {
			const result: BuildResult = { ok: true };
			buildMemo.set(nodeId, result);
			return result;
		}

		const tType = kindByName.get(node.type);
		if (!tType) {
			const result: BuildResult = {
				ok: false,
				issues: [
					{
						key: makeIssueKey('UNKNOWN_TRANSFORM', [node.id, node.type]),
						kind: 'UNKNOWN_TRANSFORM',
						severity: 'error',
						message: `Unknown transform "${node.type}"`,
						nodeId: node.id
					}
				]
			};
			buildMemo.set(nodeId, result);
			return result;
		}

		const inputEdges = incomingByNodeId.get(node.id) ?? [];
		const arityIssues = validateNodeInputArity(node, tType, inputEdges);

		const want = arityByName.get(node.type);
		if (want != null && inputEdges.length < want) {
			const result: BuildResult = { ok: false, issues: arityIssues };
			buildMemo.set(node.id, result);
			return result;
		}

		const newStack = new Set(stack);
		newStack.add(node.id);

		const sortedInputs =
			tType === 'combine' || tType === 'combineCoord'
				? [...inputEdges].sort((a, b) =>
						(a.targetHandle ?? 'input-0').localeCompare(b.targetHandle ?? 'input-0')
					)
				: inputEdges;

		const childIssues: Issue[] = [];

		if (tType === 'coord' || tType === 'color') {
			for (const inputEdge of sortedInputs) {
				if (isFeedbackEdge(inputEdge)) continue; // feedback edges break cycles
				const res = validateNodeChain(inputEdge.source, newStack);
				if (!res.ok) childIssues.push(...res.issues);
			}
		} else if (tType === 'combine' || tType === 'combineCoord') {
			const nonFeedbackSortedInputs = sortedInputs.filter((e) => !isFeedbackEdge(e));
			for (let i = 0; i < Math.min(2, nonFeedbackSortedInputs.length); i++) {
				const res = validateNodeChain(nonFeedbackSortedInputs[i].source, newStack);
				if (!res.ok) childIssues.push(...res.issues);
			}
		}

		const allIssues = [...arityIssues, ...childIssues];
		const ok = allIssues.length === 0;
		const result: BuildResult = ok ? { ok: true } : { ok: false, issues: allIssues };

		buildMemo.set(node.id, result);
		return result;
	}

	for (const outNode of outputNodes) {
		const inEdges = incomingByNodeId.get(outNode.id) ?? [];
		if (inEdges.length !== 1) continue;

		const inputNodeId = inEdges[0].source;
		const res = validateNodeChain(inputNodeId, new Set());
		if (!res.ok) {
			for (const issue of res.issues) {
				addIssue(issue);
			}
		}
	}

	const allIssues = dedupeIssues(issues);
	return rebuildGraphValidationResult(nodes, edges, allIssues, reachableNodes, reachableEdges);
}
