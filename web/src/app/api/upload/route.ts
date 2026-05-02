import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

async function resolveUser(req: NextRequest) {
  // 1) Bearer token (mobile app)
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) return user;
  }
  // 2) Cookie session (web app)
  const { data: { user } } = await (await createServerClient()).auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string)
      || (formData.get('phase') as string)
      || 'misc';

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    if (file.size > 800 * 1024) {
      return NextResponse.json({ error: 'File too large (max 800KB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));

    // Mutlak URL döndür – admin panelde tıklanabilir olsun
    const host = req.headers.get('host') || 'localhost:3000';
    const isLocal = host.startsWith('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(host.split(':')[0]);
    const proto = isLocal ? 'http' : 'https';
    const url = `${proto}://${host}/uploads/${folder}/${fileName}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
