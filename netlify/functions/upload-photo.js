const crypto = require('crypto');

exports.handler = async function (event) {
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

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY    = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.error('ENV MISSING:', { CLOUD_NAME: !!CLOUD_NAME, API_KEY: !!API_KEY, API_SECRET: !!API_SECRET });
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Cloudinary env vars belum diset.' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { file } = body;

    if (!file) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'Field "file" tidak ditemukan.' }),
      };
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder    = 'jurnal-guru';

    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', API_SECRET)
      .update(paramsToSign)
      .digest('hex');

    const params = new URLSearchParams();
    params.append('file',      file);
    params.append('api_key',   API_KEY);
    params.append('timestamp', String(timestamp));
    params.append('signature', signature);
    params.append('folder',    folder);

    console.log('Uploading to Cloudinary, cloud:', CLOUD_NAME);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      }
    );

    const data = await response.json();
    console.log('Cloudinary response status:', response.status);

    if (!response.ok) {
      console.error('Cloudinary error:', data);
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: data.error?.message ?? 'Upload gagal.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.secure_url }),
    };

  } catch (err) {
    console.error('Exception:', err.message);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err.message ?? 'Internal server error.' }),
    };
  }
};