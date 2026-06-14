export interface WasmEnvironmentStatus {
  canRunFfprobeWasm: boolean
  crossOriginIsolated: boolean
  sharedArrayBufferAvailable: boolean
  isSecureContext: boolean
  issue: string | null
  recommendation: string | null
}

export function getWasmEnvironmentStatus(): WasmEnvironmentStatus {
  if (typeof window === 'undefined') {
    return {
      canRunFfprobeWasm: false,
      crossOriginIsolated: false,
      sharedArrayBufferAvailable: false,
      isSecureContext: false,
      issue: 'Browser environment is not available.',
      recommendation: null,
    }
  }

  const crossOriginIsolated = window.crossOriginIsolated
  const sharedArrayBufferAvailable = typeof SharedArrayBuffer !== 'undefined'
  const isSecureContext = window.isSecureContext
  const canRunFfprobeWasm = crossOriginIsolated && sharedArrayBufferAvailable

  if (canRunFfprobeWasm) {
    return {
      canRunFfprobeWasm: true,
      crossOriginIsolated,
      sharedArrayBufferAvailable,
      isSecureContext,
      issue: null,
      recommendation: null,
    }
  }

  if (!isSecureContext) {
    return {
      canRunFfprobeWasm: false,
      crossOriginIsolated,
      sharedArrayBufferAvailable,
      isSecureContext,
      issue: 'This page is not in a secure context.',
      recommendation:
        'ffprobe-wasm needs HTTPS and cross-origin isolation. Deploy on Netlify (or use localhost for dev). Open the site via https://…',
    }
  }

  if (!crossOriginIsolated) {
    return {
      canRunFfprobeWasm: false,
      crossOriginIsolated,
      sharedArrayBufferAvailable,
      isSecureContext,
      issue: 'Cross-origin isolation is not active.',
      recommendation:
        'The server must send Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp over HTTPS.',
    }
  }

  return {
    canRunFfprobeWasm: false,
    crossOriginIsolated,
    sharedArrayBufferAvailable,
    isSecureContext,
    issue: 'SharedArrayBuffer is unavailable in this browser.',
    recommendation: 'Use a current Chrome, Firefox, or Safari with cross-origin isolation enabled.',
  }
}

export function assertFfprobeWasmEnvironment(): void {
  const status = getWasmEnvironmentStatus()
  if (!status.canRunFfprobeWasm) {
    throw new Error([status.issue, status.recommendation].filter(Boolean).join(' '))
  }
}
