import { successResponse, setCorsHeaders } from './_utils.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return setCorsHeaders(res).status(200).end();
  }

  if (req.method !== 'GET') {
    return setCorsHeaders(res).status(405).json({ error: 'Method not allowed' });
  }

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: '2.1.0',
    platform: 'vercel'
  };

  return successResponse(res, healthData);
}
