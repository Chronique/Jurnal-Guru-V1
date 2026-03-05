import crypto from 'crypto';

const CLOUD_NAME  = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY     = process.env.CLOUDINARY_API_KEY!;
const API_SECRET  = process.env.CLOUDINARY_API_SECRET!;

export const handler = async (event: any) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Cloudinary env vars belum diset.' }),
    };
  }

  try {
    const { file } = JSON.parse(event.body || '{}');
    if (!file) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'File tidak ditemukan.' }) };
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder    = 'jurnal-guru';

    // Generate signed upload
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(paramsToSign)
      .digest('hex');

    const formData = new FormData();
    formData.append('file',      file);
    formData.append('api_key',   API_KEY);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder',    folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json() as any;

    if (!response.ok) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: data.error?.message ?? 'Upload gagal' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.secure_url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
