import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ffprobe-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/ffprobe' && req.method === 'POST') {
            const tempDir = path.join(process.cwd(), '.tmp')
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true })
            }

            // Use the file name header if provided (preserves extension)
            const fileName = req.headers['x-file-name'] || 'temp_file'
            const ext = path.extname(fileName as string)
            const tempPath = path.join(tempDir, `ffprobe_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`)
            
            const fileStream = fs.createWriteStream(tempPath)
            req.pipe(fileStream)

            fileStream.on('finish', () => {
              // Locate local ffprobe
              const ffprobePaths = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', 'ffprobe']
              let ffprobeCmd = 'ffprobe'
              for (const p of ffprobePaths) {
                if (p.startsWith('/') && fs.existsSync(p)) {
                  ffprobeCmd = p
                  break
                }
              }

              const command = `"${ffprobeCmd}" -v error -show_format -show_streams -print_format json "${tempPath}"`
              exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
                // clean up
                try {
                  if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath)
                  }
                } catch (cleanupErr) {
                  console.error('Failed to clean up temp file:', cleanupErr)
                }

                if (err) {
                  console.error('Local ffprobe execution failed:', stderr || err.message)
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: stderr || err.message || 'ffprobe run failed' }))
                  return
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(stdout)
              })
            })

            fileStream.on('error', (err) => {
              console.error('File write error:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to write temporary file' }))
            })
          } else {
            next()
          }
        })
      }
    }
  ],
  server: {
    headers: crossOriginIsolationHeaders,
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/ffprobe-wasm')) {
            return 'ffprobe-wasm'
          }
        },
      },
    },
  },
})
