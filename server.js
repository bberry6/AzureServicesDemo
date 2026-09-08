// Static file server for the built Vite SPA.
//
// Deliberately dependency-free: App Service compresses a deployed
// node_modules into node_modules.tar.gz and only extracts it from its own
// Oryx startup path, which a custom startup command bypasses. Using nothing
// but Node built-ins sidesteps that entirely and keeps the deployment
// package to dist/ plus this file.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = process.env.PORT || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

const indexPath = path.join(distDir, 'index.html')

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'

  // Hashed asset filenames are safe to cache hard; index.html must not be.
  const cache = filePath.startsWith(path.join(distDir, 'assets'))
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'

  const stream = fs.createReadStream(filePath)
  stream.on('error', () => send(res, 500, 'Internal Server Error'))
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache })
  stream.pipe(res)
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
  }

  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const resolved = path.join(distDir, pathname)

  // Refuse anything that escapes dist/ via ../ or an absolute path.
  if (resolved !== distDir && !resolved.startsWith(distDir + path.sep)) {
    return send(res, 403, 'Forbidden')
  }

  fs.stat(resolved, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, resolved)
    // SPA fallback: unknown paths are client-side routes.
    fs.access(indexPath, fs.constants.R_OK, (indexErr) => {
      if (indexErr) return send(res, 500, 'Build output missing: dist/index.html')
      sendFile(res, indexPath)
    })
  })
})

server.listen(port, () => {
  console.log(`AzureServicesDemo listening on port ${port}`)
})
