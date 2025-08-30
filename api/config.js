export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Return the configuration
    const apiKey = process.env.GEMINI_API_KEY;
    
    res.status(200).json({
      geminiApiKey: apiKey || 'fallback-key',
      hasApiKey: !!apiKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Config API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
