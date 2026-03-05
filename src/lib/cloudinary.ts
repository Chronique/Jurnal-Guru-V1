/**
 * Upload foto ke Cloudinary melalui Netlify serverless function.
 * API secret tetap aman di server — tidak pernah exposed ke browser.
 */
export async function uploadPhoto(file: File): Promise<string> {
  // Validasi ukuran file (max 5MB sebelum encode)
  const MAX_MB = 5;
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`Ukuran foto maksimal ${MAX_MB}MB.`);
  }

  // Convert ke base64 DataURL
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });

  // Kirim ke Netlify function
  const response = await fetch('/.netlify/functions/upload-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64 }),
  });

  const data = await response.json() as { url?: string; error?: string };

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? 'Upload gagal. Coba lagi.');
  }

  return data.url;
}
