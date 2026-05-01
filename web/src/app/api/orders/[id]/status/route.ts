import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { status, courierId, pickupPhotoUrl, pickupSignatureUrl, deliveryPhotoUrl, deliverySignatureUrl, adminNotes } = await req.json();

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (courierId !== undefined) updateData.courier_id = courierId;
    if (pickupPhotoUrl) updateData.pickup_photo_url = pickupPhotoUrl;
    if (pickupSignatureUrl) updateData.pickup_signature_url = pickupSignatureUrl;
    if (deliveryPhotoUrl) updateData.delivery_photo_url = deliveryPhotoUrl;
    if (deliverySignatureUrl) updateData.delivery_signature_url = deliverySignatureUrl;
    if (adminNotes) updateData.admin_notes = adminNotes;
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('tracking_code, courier_id, status')
      .single();

    if (error) throw error;

    // If courier is being assigned manually, set them as busy
    if (courierId && status === 'assigned') {
      await supabase.from('couriers').update({ status: 'busy' }).eq('id', courierId);
      // Notify the courier
      await supabase.from('notifications').insert({
        user_id: courierId,
        title: 'Yeni İş Talebi',
        body: `Sipariş #${order.tracking_code} size atandı.`,
        type: 'new_job',
        order_id: id,
      });
    }

    // Free courier if order is done/cancelled
    if (['delivered', 'cancelled', 'failed'].includes(status) && order.courier_id) {
      await supabase.from('couriers').update({ status: 'online' }).eq('id', order.courier_id);
    }

    try {
      await fetch(`${process.env.SOCKET_INTERNAL_URL}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'order:status:changed', room: `order:${order.tracking_code}`, data: { status, orderId: id } }),
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[orders status PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
