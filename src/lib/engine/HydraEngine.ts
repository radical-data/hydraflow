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
	| 'RUNTIME_EXECUTION_ERROR';

export type Issue = {
	key: string;
	severity: IssueSeverity;
	kind: IssueKind;
	message: string;
	nodeId?: string;
	edgeId?: string;
	outputIndex?: number;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuildResult = { ok: true; chain: any } | { ok: false; issues: Issue[] };

type TransformType = 'src' | 'coord' | 'color' | 'combine' | 'combineCoord';

const ARITY: Record<TransformType, 0 | 1 | 2> = {
	src: 0,
	coord: 1,
	color: 1,
	combine: 2,
	combineCoord: 2
};

const trimUndefTail = (xs: unknown[]) => {
	const a = [...xs];
	while (a.length && a[a.length - 1] === undefined) a.pop();
	return a;
};

function makeIssueKey(kind: IssueKind, parts: Array<string | number | undefined>): string {
	return [kind, ...parts.map((p) => (p ?? '').toString())].join(':');
}

function dedupeIssues(issues: Issue[]): Issue[] {
	const byKey = new Map<string, Issue>();
	for (const issue of issues) {
		if (!byKey.has(issue.key)) {
			byKey.set(issue.key, issue);
		}
	}
	return Array.from(byKey.values());
}

export class HydraEngine {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private hydra: any | null = null;
	private canvas: HTMLCanvasElement | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private regl: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private generators: any | null = null;
	private isInitialized = false;
	private onResizeHandler: (() => void) | null = null;

	// Metadata caches for synchronous access
	private arityByName = new Map<string, 0 | 1 | 2>();
	private typeByName = new Map<string, TransformType>();
	private inputsByName = new Map<string, string[]>();

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

	/**
	 * Request camera permissions with less restrictive constraints to avoid OverconstrainedError
	 * Uses 'ideal' instead of 'exact' for deviceId to be more flexible
	 */
	private async requestCameraPermission(deviceId: number): Promise<void> {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			throw new Error('Camera API not available');
		}

		// First, enumerate devices to get available cameras
		const devices = await navigator.mediaDevices.enumerateDevices();
		const cameras = devices.filter((device) => device.kind === 'videoinput');

		// Build constraints with 'ideal' instead of 'exact' to avoid OverconstrainedError
		const constraints: MediaStreamConstraints = {
			audio: false,
			video: cameras[deviceId]
				? {
						deviceId: {
							ideal: cameras[deviceId].deviceId
						},
						width: { ideal: 1280 / 2 },
						height: { ideal: 720 / 2 }
					}
				: {
						width: { ideal: 1280 / 2 },
						height: { ideal: 720 / 2 }
					}
		};

		// Request permission with less restrictive constraints
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		// Stop the stream immediately - we just needed permission
		stream.getTracks().forEach((track) => track.stop());
	}

	async init(canvas: HTMLCanvasElement): Promise<void> {
		this.canvas = canvas;

		try {
			// Dynamic imports to avoid SSR issues
			const [{ Hydra, generators, defaultGenerators, defaultModifiers }, createREGL] =
				await Promise.all([import('hydra-ts'), import('regl')]);

			this.generators = generators;

			// Build metadata maps from Hydra's transform definitions
			const allTransforms = [...defaultGenerators, ...defaultModifiers];
			for (const transform of allTransforms) {
				this.arityByName.set(transform.name, ARITY[transform.type]);
				this.typeByName.set(transform.name, transform.type);
				this.inputsByName.set(
					transform.name,
					transform.inputs.map((i) => i.name)
				);
			}

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
				numOutputs: 1,
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
		const want = this.arityByName.get(node.type);
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

		/**
		 * SKETCHY VERSION OF HANDLING CAMERA AS SPECIAL CASE
		 * Current status:
		 * - node is being created
		 * - need to reload the graph to make it work (click on edge/validate the graph again)
		 */
		if (node.type === 'cam') {
			// Check node state - skip if inactive
			if (node.state === 'inactive') {
				const result: BuildResult = {
					ok: false,
					issues: [
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'warning',
							message: 'Camera node is inactive',
							nodeId: node.id
						}
					]
				};
				memo.set(nodeId, result);
				return result;
			}

			// Initialize node state if not set
			if (!node.state) {
				node.state = 'inactive';
			}

			try {
				//TODO: this is basically the build of the node definition
				const sourceIndex = 0;
				const source = this.hydra.sources[sourceIndex];
				const cameraIndex = Number(node.data?.source_camera ?? 0);

				if (source && source.src) {
					// Checks that src is ready and video is ready (source.src)
					node.state = 'active';
					const chain = this.generators.src(source);
					const result = { ok: true, chain } as BuildResult;
					memo.set(nodeId, result);

					return result;
				} else {
					// Trigger camera initialization if not already loading
					if (node.state === 'inactive' && source && typeof source.initCam === 'function') {
						// Request camera permissions first with less restrictive constraints
						// This helps avoid OverconstrainedError by using 'ideal' instead of 'exact'
						this.requestCameraPermission(cameraIndex)
							.then(() => {
								source.initCam(cameraIndex);
								//TODO: Ideally node build should be called here;
								//TODO: should be forcing node chain execution
							})
							.catch((err) => {
								console.error('Camera permission denied or error:', err);
								node.state = 'inactive';
							});
						node.state = 'loading';
					}

					// Still loading
					const result: BuildResult = {
						ok: false,
						issues: [
							{
								key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id]),
								kind: 'RUNTIME_EXECUTION_ERROR',
								severity: 'warning',
								message: 'Camera is loading...',
								nodeId: node.id
							}
						]
					};
					memo.set(nodeId, result);
					return result;
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Unknown error building cam node';
				const result: BuildResult = {
					ok: false,
					issues: [
						{
							key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [node.id]),
							kind: 'RUNTIME_EXECUTION_ERROR',
							severity: 'error',
							message: `Error building cam: ${message}`,
							nodeId: node.id
						}
					]
				};
				memo.set(nodeId, result);
				return result;
			}
		}

		// Validate transform exists
		const tType = this.typeByName.get(node.type);
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

		const want = this.arityByName.get(node.type);
		if (want != null && inputEdges.length < want) {
			const result: BuildResult = { ok: false, issues };
			memo.set(nodeId, result);
			return result;
		}

		// Gather arguments
		const allNames = this.inputsByName.get(node.type) ?? [];
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
			console.log('chain', chain);
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

	validateGraph(nodes: IRNode[], edges: IREdge[]): Issue[] {
		const issues: Issue[] = [];
		const memo = new Map<string, BuildResult>();

		const outputNodes = nodes.filter((node) => node.type === 'out');
		for (const outputNode of outputNodes) {
			// Skip validation for inactive nodes
			if (outputNode.state === 'inactive') {
				continue;
			}
			const outputIndex = Number(outputNode.data?.outputIndex ?? 0);

			// Validate output index range
			if (
				!Number.isInteger(outputIndex) ||
				outputIndex < 0 ||
				!this.hydra ||
				outputIndex >= this.hydra.outputs.length
			) {
				issues.push({
					key: makeIssueKey('OUTPUT_INDEX_OUT_OF_RANGE', [outputNode.id, outputIndex]),
					kind: 'OUTPUT_INDEX_OUT_OF_RANGE',
					severity: 'error',
					message: `Output index ${outputIndex} out of range (0…${
						this.hydra ? this.hydra.outputs.length - 1 : -1
					})`,
					nodeId: outputNode.id,
					outputIndex
				});
				continue;
			}

			// Validate exactly one input
			const inEdges = edges.filter((e) => e.target === outputNode.id);
			if (inEdges.length !== 1) {
				issues.push({
					key: makeIssueKey('OUTPUT_ARITY', [outputNode.id]),
					kind: 'OUTPUT_ARITY',
					severity: 'error',
					message: `Output expects exactly 1 input, found ${inEdges.length}`,
					nodeId: outputNode.id,
					outputIndex
				});
				continue;
			}

			const inputEdge = inEdges[0];
			// Skip validation if source node is inactive
			const sourceNode = nodes.find((n) => n.id === inputEdge.source);
			if (sourceNode?.state === 'inactive') {
				continue;
			}

			const result = this.buildChainValidated(nodes, edges, inputEdge.source, new Set(), memo);
			if (!result.ok) {
				// Only add errors, not warnings for loading nodes
				const errorIssues = (result as { ok: false; issues: Issue[] }).issues.filter(
					(i) => i.severity === 'error'
				);
				if (errorIssues.length > 0) {
					issues.push(...errorIssues);
				}
			}
		}

		return dedupeIssues(issues);
	}

	executeGraph(nodes: IRNode[], edges: IREdge[]): Issue[] {
		if (!this.hydra || !this.isInitialized) {
			console.warn('HydraEngine not initialized');
			return [];
		}

		const validationIssues = this.validateGraph(nodes, edges);
		const hasErrors = validationIssues.some((i) => i.severity === 'error');

		if (hasErrors) {
			return validationIssues;
		}

		const issues: Issue[] = [...validationIssues];
		const outputNodes = nodes.filter((node) => node.type === 'out');

		for (const outputNode of outputNodes) {
			const outputIndex = Number(outputNode.data?.outputIndex ?? 0);
			const inEdges = edges.filter((e) => e.target === outputNode.id);

			if (inEdges.length !== 1) continue;

			const inputEdge = inEdges[0];
			// Skip execution if source node is inactive
			const sourceNode = nodes.find((n) => n.id === inputEdge.source);
			if (sourceNode?.state === 'inactive') {
				continue;
			}

			const result = this.buildChainValidated(nodes, edges, inputEdge.source);
			if (!result.ok) {
				// Only add errors, not warnings for loading nodes
				const errorIssues = (result as { ok: false; issues: Issue[] }).issues.filter(
					(i) => i.severity === 'error'
				);
				if (errorIssues.length > 0) {
					issues.push(...errorIssues);
				}
				continue;
			}

			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(result.chain as any).out(this.hydra.outputs[outputIndex]);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Unknown runtime error while executing graph';
				issues.push({
					key: makeIssueKey('RUNTIME_EXECUTION_ERROR', [outputNode.id, outputIndex]),
					kind: 'RUNTIME_EXECUTION_ERROR',
					severity: 'error',
					message,
					nodeId: outputNode.id,
					outputIndex
				});
			}
		}

		return dedupeIssues(issues);
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
