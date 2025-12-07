import type { IREdge, IRNode } from '../types.js';
import {
	dedupeIssues,
	type GraphValidationResult,
	type Issue,
	makeIssueKey,
	rebuildGraphValidationResult,
	type TransformMeta,
	type TransformType,
	validateGraph as validateGraphStatic
} from './graphValidation.js';

export type { Issue, IssueKind, IssueSeverity } from './graphValidation.js';

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

	private validateNodeArity(node: IRNode, tType: TransformType, inputEdges: IREdge[]): Issue[] {
		const issues: Issue[] = [];
		void tType;
		const want = this.meta.arityByName.get(node.type);
		const have = inputEdges.length;

		if (want == null || have === want) return issues;

		if (have < want) {
			issues.push({
				key: makeIssueKey('NODE_MISSING_INPUTS', [node.id, node.type, want, have]),
				kind: 'NODE_MISSING_INPUTS',
				severity: 'error',
				message: `${node.type} expects ${want} input(s), found ${have}`,
				nodeId: node.id
			});
		} else {
			issues.push({
				key: makeIssueKey('NODE_EXTRA_INPUTS', [node.id, node.type, want, have]),
				kind: 'NODE_EXTRA_INPUTS',
				severity: 'warning',
				message: `${node.type} expects ${want} input(s), found ${have}`,
				nodeId: node.id
			});
		}

		return issues;
	}

	private buildChainValidated(
		nodes: IRNode[],
		edges: IREdge[],
		nodeId: string,
		stack = new Set<string>(),
		memo = new Map<string, BuildResult>()
	): BuildResult {
		// Check for cycles
		if (stack.has(nodeId)) {
			const result: BuildResult = {
				ok: false,
				issues: [
					{
						key: makeIssueKey('CYCLE', [nodeId]),
						kind: 'CYCLE',
						severity: 'error',
						message: `Cycle detected involving node ${nodeId}`,
						nodeId
					}
				]
			};
			return result;
		}

		// Check memo cache
		if (memo.has(nodeId)) {
			return memo.get(nodeId)!;
		}

		// Find node
		const byId = new Map(nodes.map((n) => [n.id, n]));
		const node = byId.get(nodeId);
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

		// Validate transform exists
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

		// Validate arity
		const inputEdges = edges.filter((e) => e.target === nodeId);
		const issues: Issue[] = this.validateNodeArity(node, tType, inputEdges);

		const want = this.meta.arityByName.get(node.type);
		if (want != null && inputEdges.length < want) {
			const result: BuildResult = { ok: false, issues };
			memo.set(nodeId, result);
			return result;
		}

		// Gather arguments
		const allNames = this.meta.inputsByName.get(node.type) ?? [];
		const paramNames =
			tType === 'combine' || tType === 'combineCoord'
				? allNames.slice(1) // drop the implicit 'color' (the second chain)
				: allNames;

		const rawArgs = paramNames.map((k: string) => (node.data ?? {})[k]);

		// Build chain based on type
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let chain: any = null;

		if (tType === 'src') {
			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (this.generators as any)[node.type](...callArgs);
		} else if (tType === 'coord' || tType === 'color') {
			// Unary operation
			const inputResult = this.buildChainValidated(
				nodes,
				edges,
				inputEdges[0].source,
				new Set([...stack, nodeId]),
				memo
			);
			if (!inputResult.ok) {
				const result: BuildResult = {
					ok: false,
					issues: [...issues, ...(inputResult as { ok: false; issues: Issue[] }).issues]
				};
				memo.set(nodeId, result);
				return result;
			}

			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (inputResult.chain as any)[node.type](...callArgs);
		} else if (tType === 'combine' || tType === 'combineCoord') {
			// Binary operation
			const sorted = inputEdges.sort((a, b) =>
				(a.targetHandle ?? 'input-0').localeCompare(b.targetHandle ?? 'input-0')
			);

			const aResult = this.buildChainValidated(
				nodes,
				edges,
				sorted[0].source,
				new Set([...stack, nodeId]),
				memo
			);
			const bResult = this.buildChainValidated(
				nodes,
				edges,
				sorted[1].source,
				new Set([...stack, nodeId]),
				memo
			);

			if (!aResult.ok || !bResult.ok) {
				const result: BuildResult = {
					ok: false,
					issues: [
						...issues,
						...(aResult.ok ? [] : (aResult as { ok: false; issues: Issue[] }).issues),
						...(bResult.ok ? [] : (bResult as { ok: false; issues: Issue[] }).issues)
					]
				};
				memo.set(nodeId, result);
				return result;
			}

			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (aResult.chain as any)[node.type](bResult.chain, ...callArgs);
		}

		const result = { ok: true, chain } as BuildResult;
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
		const result = this.buildChainValidated(nodes, edges, nodeId);
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
