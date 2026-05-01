'use client';

/**
 * Compress an image file to max ~250KB
 */
export async function compressImage(
  file: File,
  maxSizeKB = 250,
  maxWidth = 1200,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('Compression failed')); return; }
              if (blob.size / 1024 > maxSizeKB && q > 0.3) {
                tryCompress(q - 0.1);
              } else {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              }
            },
            'image/jpeg',
            q
          );
        };

        tryCompress(quality);
      };
    };
    reader.onerror = reject;
  });
}

export async function uploadFile(
  file: File,
  folder: 'cargo' | 'proof' | 'signature'
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.url as string;
}
