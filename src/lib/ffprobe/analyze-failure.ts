import type { FileInfo } from 'ffprobe-wasm'
import type { FileContext, UploaderPolicy } from './types'
import { DEFAULT_UPLOADER_POLICY } from './types'
import { evaluateUploaderValidation } from './uploader-validation'

export function buildAnalyzeFailureResult(
  analyzeError: string,
  context: FileContext,
  policy: UploaderPolicy = DEFAULT_UPLOADER_POLICY,
) {
  const emptyFileInfo: FileInfo = {
    streams: [],
    chapters: [],
    format: {
      filename: context.fileName ?? '',
      nb_streams: 0,
      nb_programs: 0,
      format_name: '',
      format_long_name: '',
      start_time: '0',
      duration: '',
      size: context.fileSizeBytes != null ? String(context.fileSizeBytes) : '',
      bit_rate: '',
      probe_score: 0,
      tags: {},
    },
  }

  return evaluateUploaderValidation(emptyFileInfo, context, policy, analyzeError)
}
