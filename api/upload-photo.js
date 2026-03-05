import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY    = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return res.status(500).json({ error: 'Cloudinary env vars not configured' });
  }

  const { file, fileName } = req.body ?? {};
  if (!file) return res.status(400).json({ error: 'No file provided' });

  try {
    const timestamp    = Math.round(Date.now() / 1000);
    const folder       = 'jurnal-guru';
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature    = crypto
      .createHash('sha1')
      .update(paramsToSign + API_SECRET)
      .digest('hex');

    const formData = new URLSearchParams();
    formData.append('file',      file);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key',   API_KEY);
    formData.append('signature', signature);
    formData.append('folder',    folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudinary error:', data);
      return res.status(500).json({ error: data.error?.message ?? 'Upload failed' });
    }

    return res.status(200).json({
      url:      data.secure_url,
      publicId: data.public_id,
    });

  } catch (err) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}