// Vercel Serverless Function: /api/bill/[id] delegating to unified bill handler
import handler from '../bill.js';

export default function routeHandler(req, res) {
  return handler(req, res);
}
