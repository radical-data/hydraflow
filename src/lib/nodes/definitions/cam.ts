import type { NodeDefinition } from '../../types.js';

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
			options: [{ value: 0, label: 'cam 0' }] //TODO: this should be a list of all browsers availables cameras
		}
	],
	outputs: [],
	build: (ctx, args) => {
		const { sources } = ctx;
		const cameraIndex = Number(args.source_camera) || 0;
		const sourceIndex = 0; // Use source 0 for camera

		// Step 1: Initialize camera on the source (async, fire and forget)
		const source = sources[sourceIndex];

		if (source && typeof source.initCam === 'function') {
			// Trigger camera initialization asynchronously
			// The node state will be updated when the camera is ready
			// initCam doesn't return a promise, it handles errors internally
			source.initCam(cameraIndex);
		}
	}
};
