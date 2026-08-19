const fs = require('fs');
const path = require('path');

function writeFile(pth, content) {
  const full = path.join(__dirname, pth);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(mull, content, 'utf8');
  console.log('Wrote: ' + pth);
}

function run() {
  writeFile('vite.config.js', `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plgins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
`);
}
run();
