import type { Issue, IssueKind } from '../../engine/HydraEngine.js';
import type { IREdge, IRNode, NodeDefinition } from '../../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuildResult = { ok: true; chain: any } | { ok: false; issues: Issue[] };

function makeIssueKey(kind: IssueKind, parts: Array<string | number | undefined>): string {
	return [kind, ...parts.map((p) => (p ?? '').toString())].join(':');
}

/**
 * Request camera permissions with less restrictive constraints to avoid OverconstrainedError
 * Uses 'ideal' instead of 'exact' for deviceId to be more flexible
 */
export async function requestCameraPermission(deviceId: number): Promise<void> {
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

interface CamBuildContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	hydra: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	generators: any;
	executeGraph: (nodes: IRNode[], edges: IREdge[]) => void;
}

/**
 * Builds a camera node chain, handling camera initialization and state management
 */
export function validateAndBuildCamNode(
	node: IRNode,
	nodes: IRNode[],
	edges: IREdge[],
	nodeId: string,
	memo: Map<string, BuildResult>,
	ctx: CamBuildContext
): BuildResult | null {
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
		const source = ctx.hydra.sources[sourceIndex];
		const cameraIndex = Number(node.data?.source_camera ?? 0);

		if (source && source.src) {
			// Checks that src is ready and video is ready (source.src)
			node.state = 'active';
			const chain = ctx.generators.src(source);
			const result = { ok: true, chain } as BuildResult;
			memo.set(nodeId, result);

			return result;
		} else {
			// Trigger camera initialization if not already loading
			if (node.state === 'inactive' && source && typeof source.initCam === 'function') {
				// Request camera permissions first with less restrictive constraints
				// This helps avoid OverconstrainedError by using 'ideal' instead of 'exact'
				requestCameraPermission(cameraIndex)
					.then(() => {
						source.initCam(cameraIndex);
						//TODO: Ideally node build should be called here;

						// Poll for source.src to be defined, then execute graph
						const maxAttempts = 30;
						const pollInterval = 200; // Check every 200ms
						let attempts = 0;

						const checkInterval = setInterval(() => {
							attempts++;

							if (source.src) {
								clearInterval(checkInterval);
								ctx.executeGraph(nodes, edges);
							} else if (attempts >= maxAttempts) {
								clearInterval(checkInterval);
								console.warn('Timeout waiting for camera source to be ready');
								node.state = 'inactive';
							}
						}, pollInterval);
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

export const camDefinition: NodeDefinition = {
	id: 'cam',
	label: 'Camera',
	category: 'source',
	state: 'inactive',
	inputs: [
		{
			id: 'source_camera',
			label: 'Source Camera',
			type: 'select',
			default: 0,
			options: [{ value: 0, label: 'cam 0' }]
			//TODO: this should be a list of all browsers availables cameras L92. Hydra Engine
		}
	],
	outputs: [],
	build: () => {
		//TODO: Move build definition here, currently in Hydra Engine
	}
};

/**
 * we need:
 *  init -> initialize node with 'inactive', initialize camera
 *  update -> check weather camera and source are correctly initialized.
 *  build -> creates the node once camera and source as correctly initialize
 *
 */
