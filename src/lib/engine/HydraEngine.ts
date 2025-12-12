import type { IREdge, IRNode } from '../types.js';
import {
	dedupeIssues,
	type GraphValidationResult,
	isFeedbackEdge,
	type Issue,
	makeIssueKey,
	rebuildGraphValidationResult,
	type TransformMeta,
	validateGraph as validateGraphStatic
} from './graphValidation.js';

export type { Issue, IssueKind, IssueSeverity } from './graphValidation.js';

/**
 * Feedback edges (edge.isFeedback === true) read the previous frame from the current output.
 * - Feedback edges count towards node arity but don't participate in same-frame cycle detection.
 * - At runtime, feedback edges become src(o_k) chains where k is the output index.
 * - Feedback is per output: when building the chain for output k, all feedback edges read from src(o_k).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuildResult = { ok: true; chain: any } | { ok: false; issues: Issue[] };

const trimUndefTail = (xs: unknown[]) => {
	const a = [...xs];
	while (a.length && a[a.length - 1] === undefined) a.pop();
	return a;
};

const CAMERA_SOURCE_INDEX = 0;

export class HydraEngine {
	private readonly meta: TransformMeta;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly generators: any;
	// runtime state
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private hydra: any | null = null;
	private canvas: HTMLCanvasElement | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private regl: any = null;
	private isInitialized = false;
	private onResizeHandler: (() => void) | null = null;

	constructor(meta: TransformMeta, generators: unknown) {
		this.meta = meta;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.generators = generators as any;
	}

	private getTransformMeta(): TransformMeta {
		return this.meta;
	}

	private getNumOutputs(): number {
		return this.hydra?.outputs?.length ?? 4;
	}

	private isCameraInitialised = false;
	private cameraInitError: string | null = null;

	private onWindowResize(): void {
		if (!this.canvas) return;

		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(this.regl as any)?.poll?.();

		if (this.hydra) {
			this.hydra.setResolution(this.canvas.width, this.canvas.height);
		}
	}

	private initCameraSource(): void {
		if (this.isCameraInitialised || this.cameraInitError || !this.hydra) return;

		this.isCameraInitialised = true;

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const hydraAny = this.hydra as any;
			const source = hydraAny.sources?.[CAMERA_SOURCE_INDEX];

			if (!source || typeof source.initCam !== 'function') {
				throw new Error('Hydra camera source not available');
			}

			source.initCam();
		} catch (error) {
			this.cameraInitError =
				error instanceof Error ? error.message : 'Unknown error initialising camera source';
			console.warn('Camera initialisation failed:', error);
		}
	}

	async init(canvas: HTMLCanvasElement): Promise<void> {
		this.canvas = canvas;
		this.canvas.style.backgroundColor = '#000000';

		try {
			// Dynamic imports to avoid SSR issues
			const [{ Hydra }, createREGL] = await Promise.all([import('hydra-ts'), import('regl')]);

			this.regl = createREGL.default({
				canvas,
				attributes: {
					antialias: true,
					preserveDrawingBuffer: true
				}
			});

			this.hydra = new Hydra({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				regl: this.regl as any,
				width: canvas.width,
				height: canvas.height,
				numOutputs: 4,
				numSources: 4
			});

			this.onResizeHandler = () => this.onWindowResize();
			window.addEventListener('resize', this.onResizeHandler);

			this.isInitialized = true;
		} catch (error) {
			console.warn('Failed to initialize HydraEngine:', error);
			throw error;
		}
	}

	private buildFeedbackChainForOutput(outputIndex: number, nodeIdForErrors: string): BuildResult {
		if (!this.hydra) {
			return {
				ok: false,
				issues: [
					{
						key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [nodeIdForErrors, outputIndex]),
						kind: 'RUNTIME_EXECUTION_ERROR',
						severity: 'error',
						message: 'Hydra is not initialised; cannot build feedback chain',
						nodeId: nodeIdForErrors,
						outputIndex
					}
				]
			};
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const gens = this.generators as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const hydraAny = this.hydra as any;

		const output = hydraAny.outputs?.[outputIndex];

		if (!output) {
			return {
				ok: false,
				issues: [
					{
						key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [nodeIdForErrors, outputIndex]),
						kind: 'RUNTIME_EXECUTION_ERROR',
						severity: 'error',
						message: `Output ${outputIndex} not available for feedback`,
						nodeId: nodeIdForErrors,
						outputIndex
					}
				]
			};
		}

		try {
			if (typeof gens.src !== 'function') {
				return {
					ok: false,
					issues: [
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [nodeIdForErrors, outputIndex]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'error',
							message: 'Hydra "src" generator is not available for feedback',
							nodeId: nodeIdForErrors,
							outputIndex
						}
					]
				};
			}

			// hydra-ts's src(oX) = previous frame of that output
			const chain = gens.src(output);
			return { ok: true, chain };
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Unknown error while building feedback chain';
			return {
				ok: false,
				issues: [
					{
						key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [nodeIdForErrors, outputIndex]),
						kind: 'RUNTIME_EXECUTION_ERROR',
						severity: 'error',
						message,
						nodeId: nodeIdForErrors,
						outputIndex
					}
				]
			};
		}
	}

	private buildChainValidated(
		nodes: IRNode[],
		edges: IREdge[],
		nodeId: string,
		outputIndex: number,
		nodeById: Map<string, IRNode>,
		stack = new Set<string>(),
		memo = new Map<string, BuildResult>()
	): BuildResult {
		// Note: Structural validation (arity, cycles, unknown transforms) is handled by
		// validateGraphStatic. This method only reports runtime execution failures.

		if (stack.has(nodeId)) {
			const result: BuildResult = {
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
			return result;
		}

		if (memo.has(nodeId)) {
			return memo.get(nodeId)!;
		}

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
			memo.set(nodeId, result);
			return result;
		}

		if (node.type === 'camera') {
			if (!this.hydra) {
				const result: BuildResult = {
					ok: false,
					issues: [
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'error',
							message: 'Hydra is not initialised; cannot use camera source',
							nodeId: node.id
						}
					]
				};
				memo.set(nodeId, result);
				return result;
			}

			this.initCameraSource();

			if (this.cameraInitError) {
				const result: BuildResult = {
					ok: false,
					issues: [
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'error',
							message: this.cameraInitError,
							nodeId: node.id
						}
					]
				};
				memo.set(nodeId, result);
				return result;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const gens = this.generators as any;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const hydraAny = this.hydra as any;
			const source = hydraAny.sources?.[CAMERA_SOURCE_INDEX];
			const chain = typeof gens.src === 'function' ? gens.src(source) : gens.solid?.(0, 0, 0, 1);

			const result: BuildResult = { ok: true, chain };
			memo.set(nodeId, result);
			return result;
		}

		const tType = this.meta.typeByName.get(node.type);
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
			memo.set(nodeId, result);
			return result;
		}

		// Split inputs into forward vs feedback
		const inputEdges = edges.filter((e) => e.target === nodeId);
		const forwardInputs = inputEdges.filter((e) => !isFeedbackEdge(e));
		const feedbackInputs = inputEdges.filter((e) => isFeedbackEdge(e));

		const issues: Issue[] = [];

		const allNames = this.meta.inputsByName.get(node.type) ?? [];
		const paramNames =
			tType === 'combine' || tType === 'combineCoord'
				? allNames.slice(1) // drop the implicit 'color' chain parameter
				: allNames;

		const rawArgs = paramNames.map((k: string) => (node.data ?? {})[k]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let chain: any = null;

		if (tType === 'src') {
			// Pure source node: no incoming edges
			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (this.generators as any)[node.type](...callArgs);
		} else if (tType === 'coord' || tType === 'color') {
			// Unary operation: either forward input, or purely feedback.
			// Prefer forward input if present; static validation should ensure there is at least one total.
			let baseChainResult: BuildResult;

			if (forwardInputs.length > 0) {
				// Normal case: recurse into the forward input chain
				const forward = forwardInputs[0];
				baseChainResult = this.buildChainValidated(
					nodes,
					edges,
					forward.source,
					outputIndex,
					nodeById,
					new Set([...stack, nodeId]),
					memo
				);
			} else if (feedbackInputs.length > 0) {
				// Feedback-only case: use src(o_outputIndex) as the base chain
				baseChainResult = this.buildFeedbackChainForOutput(outputIndex, node.id);
			} else {
				// Should be impossible if graphValidation is working; treat as runtime error.
				const message = `${node.type} has no input at runtime (expected 1, found 0)`;
				const result: BuildResult = {
					ok: false,
					issues: [
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id, outputIndex]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'error',
							message,
							nodeId: node.id,
							outputIndex
						}
					]
				};
				memo.set(node.id, result);
				return result;
			}

			if (!baseChainResult.ok) {
				const result: BuildResult = {
					ok: false,
					issues: [...issues, ...baseChainResult.issues]
				};
				memo.set(node.id, result);
				return result;
			}

			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (baseChainResult.chain as any)[node.type](...callArgs);
		} else if (tType === 'combine' || tType === 'combineCoord') {
			// Binary operation: each input slot (input-0, input-1) can be forward or feedback.

			const getEdgeForInputIndex = (index: 0 | 1): IREdge | undefined => {
				const handleId = `input-${index}`;
				return inputEdges.find((e) => (e.targetHandle ?? 'input-0') === handleId);
			};

			const edge0 = getEdgeForInputIndex(0);
			const edge1 = getEdgeForInputIndex(1);

			// Defensive: if static validation failed somehow and we don't have two inputs, bail out
			if (!edge0 || !edge1) {
				const have = [edge0, edge1].filter(Boolean).length;
				const message = `${node.type} expects 2 inputs at runtime, found ${have}`;
				const result: BuildResult = {
					ok: false,
					issues: [
						...issues,
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id, outputIndex]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'error',
							message,
							nodeId: node.id,
							outputIndex
						}
					]
				};
				memo.set(node.id, result);
				return result;
			}

			const buildInputChain = (edge: IREdge): BuildResult => {
				if (isFeedbackEdge(edge)) {
					// Feedback for this input
					return this.buildFeedbackChainForOutput(outputIndex, node.id);
				}

				return this.buildChainValidated(
					nodes,
					edges,
					edge.source,
					outputIndex,
					nodeById,
					new Set([...stack, node.id]),
					memo
				);
			};

			const aResult = buildInputChain(edge0);
			const bResult = buildInputChain(edge1);

			if (!aResult.ok || !bResult.ok) {
				const result: BuildResult = {
					ok: false,
					issues: [
						...issues,
						...(aResult.ok ? [] : aResult.issues),
						...(bResult.ok ? [] : bResult.issues)
					]
				};
				memo.set(node.id, result);
				return result;
			}

			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (aResult.chain as any)[node.type](bResult.chain, ...callArgs);
		}

		const result: BuildResult = { ok: true, chain };
		memo.set(nodeId, result);
		return result;
	}

	private getGraphValidation(nodes: IRNode[], edges: IREdge[]): GraphValidationResult {
		return validateGraphStatic({
			nodes,
			edges,
			numOutputs: this.getNumOutputs(),
			meta: this.getTransformMeta()
		});
	}

	private buildAndExecuteChain(
		nodes: IRNode[],
		edges: IREdge[],
		nodeId: string,
		outputIndex: number
	): { ok: true } | { ok: false; issues: Issue[] } {
		// Feedback edges are interpreted as feedback from the relevant Hydra output.
		// Build nodeById once and pass it through to avoid rebuilding on every recursion.
		const nodeById = new Map(nodes.map((n) => [n.id, n]));
		const result = this.buildChainValidated(nodes, edges, nodeId, outputIndex, nodeById);
		if (!result.ok) {
			return result;
		}

		if (!this.hydra) {
			return {
				ok: false,
				issues: [
					{
						key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [nodeId, outputIndex]),
						kind: 'RUNTIME_EXECUTION_ERROR',
						severity: 'error',
						message: 'Hydra is not initialised',
						nodeId,
						outputIndex
					}
				]
			};
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(result.chain as any).out(this.hydra.outputs[outputIndex]);
			return { ok: true };
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Unknown runtime error while executing graph';
			return {
				ok: false,
				issues: [
					{
						key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [nodeId, outputIndex]),
						kind: 'RUNTIME_EXECUTION_ERROR',
						severity: 'error',
						message,
						nodeId,
						outputIndex
					}
				]
			};
		}
	}

	executeGraph(nodes: IRNode[], edges: IREdge[]): GraphValidationResult {
		const baseValidation = this.getGraphValidation(nodes, edges);
		const structuralIssues = [...baseValidation.issues];
		const hasStructuralErrors = structuralIssues.some((i) => i.severity === 'error');

		const runtimeIssues: Issue[] = [];

		if (!this.hydra || !this.isInitialized) {
			console.warn('HydraEngine not initialized');
		} else if (!hasStructuralErrors) {
			const outputNodes = nodes.filter((node) => node.type === 'out');

			for (const outputNode of outputNodes) {
				const outputIndex = Number(outputNode.data?.outputIndex ?? 0);
				const inEdges = edges.filter((e) => e.target === outputNode.id);

				if (inEdges.length !== 1) continue;

				const inputEdge = inEdges[0];
				const result = this.buildAndExecuteChain(nodes, edges, inputEdge.source, outputIndex);
				if (!result.ok) {
					runtimeIssues.push(...result.issues);
				}
			}
		}

		const allIssues = dedupeIssues([...structuralIssues, ...runtimeIssues]);

		return rebuildGraphValidationResult(
			nodes,
			edges,
			allIssues,
			baseValidation.reachableNodes,
			baseValidation.reachableEdges
		);
	}

	start(): void {
		if (this.hydra) {
			this.hydra.loop.start();
		}
	}

	stop(): void {
		if (this.hydra) {
			this.hydra.loop.stop();
		}
	}

	reset(): void {
		if (this.hydra) {
			this.hydra.hush();
		}
	}

	destroy(): void {
		if (this.onResizeHandler) {
			window.removeEventListener('resize', this.onResizeHandler);
			this.onResizeHandler = null;
		}
		if (this.hydra) {
			this.hydra.loop.stop();
			this.hydra = null;
		}
		if (this.regl) {
			this.regl.destroy();
			this.regl = null;
		}
		this.isInitialized = false;
	}

	setResolution(width: number, height: number): void {
		if (this.hydra) {
			this.hydra.setResolution(width, height);
		}
	}
}
