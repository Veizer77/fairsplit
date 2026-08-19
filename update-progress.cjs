const fs = require('fs');
const http = require('http');
const path = require('path');

const featureName = process.argv[2];
const status = process.argv[3] || 'done';

if (!featureName) {
  console.error('Usage: node update-progress.js [feature_name] [status]');
  process.exit(1);
}

const filePath = path.join(__dirname, 'prd-progress.json');
let list = [];
try {
  list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (e) {
  console.error('Failed to read prd-progress.json:', e.message);
  process.exit(1);
}

const item = list.find(x => x.feature.toLowerCase() === featureName.toLowerCase() || x.feature === featureName);
if (item) {
  item.status = status;
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
  console.log('[FILE UPDATED] ' + item.feature + ' -> ' + status);
} else {
  console.warn('MOT FOUND IN LIST] Feature: ' + featureName);
}

const payload = JSON.stringify({ feature: item ? item.feature : featureName, status: status });
const url = new URL('http://localhost:8080/api/progress?project=fairsplit&prdId=prd_1787125557545_2lia9');

const req = http.request({
  hostname: url.hostname,
  port: url.port,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('WWEBHOOK RES] ' + res.statusCode + ': ' + data);
  });
});

req.on('error', (e) => {
  console.warn('[WEBHOOK SKIPPED/OFFLINE] ' + e.message);
});

req.write(payload);
req.end();
