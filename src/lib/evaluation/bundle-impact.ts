export interface EngineBundleProfile {
	id: string;
	name: string;
	lazyChunkGzip: string;
	lazyChunkBrotli: string;
	lazyLoaded: boolean;
	wasmDelivery: string;
	firstLoadRisk: string;
	coopCoepRequired: boolean;
	technicalLines: string[];
}

export interface BundleImpactView {
	mode: 'single' | 'compare';
	subtitle: string;
	mainBundleImpact: string;
	engines: EngineBundleProfile[];
	userImpact: string;
	firstAnalysisRisk: string;
	technicalDetails: string;
}

const MAIN_BUNDLE_IMPACT = 'Low (~63 KiB gzip)';
const MAIN_BUNDLE_DETAIL = '~199 KiB raw / ~63 KiB gzip';

export const ENGINE_BUNDLE_PROFILES: Record<string, EngineBundleProfile> = {
	'ffprobe-wasm': {
		id: 'ffprobe-wasm',
		name: 'ffprobe-wasm',
		lazyChunkGzip: '~2.9 MiB gzip',
		lazyChunkBrotli: '~2.03 MiB brotli',
		lazyLoaded: true,
		wasmDelivery: 'Embedded in lazy JS chunk (npm package)',
		firstLoadRisk: '~8.5 MB raw on first analyze',
		coopCoepRequired: true,
		technicalLines: [
			'npm ffprobe-wasm lazy chunk: ~8.5 MB raw / ~2.9 MiB gzip / ~2.0 MiB brotli',
			'Requires COOP/COEP + SharedArrayBuffer (pthreads)',
		],
	},
	'minimal-metadata-ffprobe': {
		id: 'minimal-metadata-ffprobe',
		name: 'minimal-metadata-ffprobe',
		lazyChunkGzip: '~480 KiB gzip',
		lazyChunkBrotli: '~401 KiB brotli',
		lazyLoaded: true,
		wasmDelivery: 'Standalone .wasm + lazy loader script',
		firstLoadRisk: '~920 KB raw on first analyze',
		coopCoepRequired: false,
		technicalLines: [
			'minimal-metadata: ~921 KB raw / ~480 KB gzip / ~401 KB brotli',
			'Single-threaded; served from /engines/minimal-metadata/',
			'No SharedArrayBuffer or cross-origin isolation required',
		],
	},
};

function profileForEngine(engineId: string): EngineBundleProfile {
	return (
		ENGINE_BUNDLE_PROFILES[engineId] ?? {
			id: engineId,
			name: engineId,
			lazyChunkGzip: 'Unknown',
			lazyChunkBrotli: 'Unknown',
			lazyLoaded: true,
			wasmDelivery: 'Unknown',
			firstLoadRisk: 'Unknown',
			coopCoepRequired: false,
			technicalLines: [`No bundle profile for engine "${engineId}"`],
		}
	);
}

export function buildBundleImpactView(
	engineIds: string[],
	mode: 'single' | 'compare',
): BundleImpactView {
	const uniqueIds = [...new Set(engineIds)];
	const engines = uniqueIds.map((id) => profileForEngine(id));

	const subtitle =
		mode === 'compare'
			? `Compare mode — ${engines.length} engine${engines.length === 1 ? '' : 's'} (${engines.map((e) => e.name).join(' + ')})`
			: `Single engine — ${engines[0]?.name ?? 'none selected'}`;

	const userImpact =
		mode === 'compare'
			? `Each engine lazy-loads on first use (${engines.length} separate download${engines.length === 1 ? '' : 's'} if all run)`
			: engines[0]?.lazyLoaded
				? 'Engine loads on first analyze only'
				: 'Engine included in main bundle';

	const firstAnalysisRisk =
		mode === 'compare'
			? engines
					.map((engine) => `${engine.name}: ${engine.firstLoadRisk}`)
					.join(' · ')
			: (engines[0]?.firstLoadRisk ?? 'Unknown');

	const technicalDetails = [
		`- Main entry chunk: ${MAIN_BUNDLE_DETAIL}`,
		...engines.flatMap((engine) =>
			engine.technicalLines.map((line) => `- ${engine.name}: ${line}`),
		),
		'- Run `npm run build:analyze` to refresh npm chunk sizes',
	].join('\n');

	return {
		mode,
		subtitle,
		mainBundleImpact: MAIN_BUNDLE_IMPACT,
		engines,
		userImpact,
		firstAnalysisRisk,
		technicalDetails,
	};
}

/** @deprecated Use buildBundleImpactView — kept for exports that still reference static copy */
export const BUNDLE_IMPACT = {
	mainBundleImpact: MAIN_BUNDLE_IMPACT,
	mainBundleDetail: MAIN_BUNDLE_DETAIL,
	lazyChunkGzip: ENGINE_BUNDLE_PROFILES['ffprobe-wasm'].lazyChunkGzip,
	lazyChunkBrotli: ENGINE_BUNDLE_PROFILES['ffprobe-wasm'].lazyChunkBrotli,
	lazyLoaded: true,
	standaloneWasm: ENGINE_BUNDLE_PROFILES['ffprobe-wasm'].wasmDelivery,
	userImpact: 'Each engine loads on first use only',
	firstAnalysisRisk: ENGINE_BUNDLE_PROFILES['ffprobe-wasm'].firstLoadRisk,
};

export const BUNDLE_TECHNICAL_DETAILS = buildBundleImpactView(
	['ffprobe-wasm'],
	'single',
).technicalDetails;
