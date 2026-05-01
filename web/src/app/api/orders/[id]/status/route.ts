import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { status, pickupPhotoUrl, pickupSignatureUrl, deliveryPhotoUrl, deliverySignatureUrl, adminNotes } = await req.json();

    const updateData: Record<string, unknown> = { status };
    if (pickupPhotoUrl) updateData.pickup_photo_url = pickupPhotoUrl;
    if (pickupSignatureUrl) updateData.pickup_signature_url = pickupSignatureUrl;
    if (deliveryPhotoUrl) updateData.delivery_photo_url = deliveryPhotoUrl;
    if (deliverySignatureUrl) updateData.delivery_signature_url = deliverySignatureUrl;
    if (adminNotes) updateData.admin_notes = adminNotes;
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();

    const adminClient = await createAdminClient();
    const { data: order, error } = await adminClient
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('tracking_code, courier_id')
      .single();

    if (error) throw error;

    // Free courier if done
    if (['delivered', 'cancelled', 'failed'].includes(status) && order.courier_id) {
      await adminClient.from('couriers').update({ status: 'online' }).eq('id', order.courier_id);
    }

    // Notify via socket
    try {
      await fetch(`${process.env.SOCKET_INTERNAL_URL}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'order:status:changed',
          room: `order:${order.tracking_code}`,
          data: { trackingCode: order.tracking_code, status, orderId: id },
        }),
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[orders status PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
