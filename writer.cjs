const fs = require('fs');
const path = require('path');

function writeFile(pth, content) {
  const full = path.join(__dirname, pth);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('Wrote: ' + pth);
}

module.exports = { writeFile };
