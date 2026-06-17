import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5173;
const DIST_DIR = path.join(__dirname, 'dist');

const server = http.createServer((req, res) => {
  // Add Cross-Origin isolation headers for WASM
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  if (req.url === '/api/ffprobe' && req.method === 'POST') {
    const tempDir = path.join(__dirname, '.tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = req.headers['x-file-name'] || 'temp_file';
    const ext = path.extname(fileName);
    const tempPath = path.join(tempDir, `ffprobe_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    
    const fileStream = fs.createWriteStream(tempPath);
    req.pipe(fileStream);

    fileStream.on('finish', () => {
      // Try local paths or fallback to PATH
      const ffprobePaths = ['/usr/bin/ffprobe', '/opt/homebrew/bin/ffprobe', 'ffprobe'];
      let ffprobeCmd = 'ffprobe';
      for (const p of ffprobePaths) {
        if (p.startsWith('/') && fs.existsSync(p)) {
          ffprobeCmd = p;
          break;
        }
      }

      const command = `"${ffprobeCmd}" -v error -show_format -show_streams -print_format json "${tempPath}"`;
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (e) {}

        if (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: stderr || err.message }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(stdout);
      });
    });

    fileStream.on('error', (err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to write temporary file' }));
    });
    return;
  }

  // Serve static files from 'dist'
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  
  // Guard against path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      filePath = path.join(DIST_DIR, 'index.html');
    }

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.wasm': 'application/wasm',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});
