import http from 'http'
import fs from 'fs'
import path from 'path'

const PORT = process.env.PORT || 3000
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url
  const ext = path.extname(urlPath)
  const filePath = path.join(__dirname, urlPath)
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' })
    res.end(data)
  })
}).listen(PORT, () => console.log(`🚀 New Bae Watch running at https://localhost:${PORT}`))
