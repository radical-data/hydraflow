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
