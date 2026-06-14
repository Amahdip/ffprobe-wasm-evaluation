import type { MediaAnalysisEngine } from './types';
import { buildFailedAnalysisResult } from './types';

/**
 * Placeholder for the internal Aparat WASM/media-analysis package.
 * When the package is available, replace analyze() with the real adapter.
 */
export const internalWasmEngine: MediaAnalysisEngine = {
	id: 'taghi-engine',
	name: 'Taghi Engine',
	description: 'Internal media-analysis package — adapter pending integration',
	available: false,
	capabilities: {
		lazyLoaded: true,
		bundleImpactGzip: 'TBD',
		supportedContainers: ['mp4', 'mov', 'webm', 'mkv'],
		knownUnsupportedContainers: [],
		notes:
			'Register adapter when @aparat/media-analysis (or equivalent) is published',
	},
	async analyze(file) {
		return buildFailedAnalysisResult(
			internalWasmEngine,
			`Internal engine is not yet integrated. File "${file.name}" was not analyzed.`,
		);
	},
};
