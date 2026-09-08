import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = process.env.PORT || 8080

const app = express()

// Serve the built Vite assets.
app.use(express.static(distDir))

// SPA fallback: anything not matched above returns index.html.
app.use((req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.log(`AzureServicesDemo listening on port ${port}`)
})
