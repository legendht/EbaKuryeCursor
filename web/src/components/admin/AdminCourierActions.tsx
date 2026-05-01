'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Courier } from '@/types/database';
import Image from 'next/image';

type FullCourier = Courier & {
  tc_no?: string;
  home_address?: string;
  license_number?: string;
  profile_photo_url?: string;
  profile?: { full_name: string; phone: string; email: string };
};

export default function AdminCourierActions({ courier }: { courier: FullCourier }) {
  const [open, setOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState(courier.profile?.full_name || '');
  const [phone, setPhone] = useState(courier.profile?.phone || '');
  const [tcNo, setTcNo] = useState(courier.tc_no || '');
  const [homeAddress, setHomeAddress] = useState(courier.home_address || '');
  const [vehicleType, setVehicleType] = useState(courier.vehicle_type || 'motorcycle');
  const [plate, setPlate] = useState(courier.vehicle_plate || '');
  const [licenseNumber, setLicenseNumber] = useState(courier.license_number || '');
  const [isApproved, setIsApproved] = useState(courier.is_approved ?? false);

  const supabase = createClient();

  const handleSave = async () => {
    setLoading(true);
    try {
      const [profileRes, courierRes] = await Promise.all([
        supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', courier.id),
        supabase.from('couriers').update({
          tc_no: tcNo,
          home_address: homeAddress,
          vehicle_type: vehicleType as Courier['vehicle_type'],
          vehicle_plate: plate,
          license_number: licenseNumber,
          is_approved: isApproved,
        }).eq('id', courier.id),
      ]);

      if (profileRes.error || courierRes.error) {
        toast.error('Güncelleme başarısız: ' + (profileRes.error?.message || courierRes.error?.message));
      } else {
        toast.success('Kurye güncellendi');
        setOpen(false);
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/delete-courier', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierId: courier.id }),
    });
    if (res.ok) {
      toast.success('Kurye silindi');
      setDelOpen(false);
      window.location.reload();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Silme başarısız');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span className="text-xs text-slate-400 hover:text-orange-400 cursor-pointer px-2 py-1">Düzenle</span>
        </DialogTrigger>
        <DialogContent className="bg-[#0f2340] border-[#1e4976]/60 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kurye Düzenle</DialogTitle>
          </DialogHeader>

          {/* Profile Photo */}
          {courier.profile_photo_url && (
            <div className="flex justify-center pb-2">
              <Image
                src={courier.profile_photo_url}
                alt={fullName}
                width={80} height={80}
                className="rounded-full object-cover border-2 border-orange-500/50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Ad Soyad</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">TC Kimlik No</Label>
              <Input value={tcNo} onChange={(e) => setTcNo(e.target.value)}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" maxLength={11} />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Araç Tipi</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger className="bg-[#0a1628] border-[#1e4976]/60 text-white h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f2340] border-[#1e4976]/60">
                  <SelectItem value="motorcycle" className="text-slate-300 focus:bg-[#1e4976]/40">🏍️ Motosiklet</SelectItem>
                  <SelectItem value="car" className="text-slate-300 focus:bg-[#1e4976]/40">🚗 Otomobil</SelectItem>
                  <SelectItem value="van" className="text-slate-300 focus:bg-[#1e4976]/40">🚐 Kamyonet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Araç Plakası</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value)}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" placeholder="34 ABC 123" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Ruhsat No</Label>
              <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-slate-300 text-xs">Ev Adresi</Label>
              <Input value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)}
                className="bg-[#0a1628] border-[#1e4976]/60 text-white text-sm h-9" />
            </div>
            <div className="col-span-2 flex items-center gap-3 py-1">
              <Label className="text-slate-300 text-sm">Onay Durumu:</Label>
              <button
                type="button"
                onClick={() => setIsApproved(!isApproved)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isApproved ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30'
                             : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                }`}
              >
                {isApproved ? '✓ Onaylı' : '✗ Beklemede'}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => setOpen(false)} variant="outline"
              className="flex-1 border-[#1e4976]/60 text-slate-300 hover:bg-[#1e4976]/20 h-9">
              İptal
            </Button>
            <Button onClick={handleSave} disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-9">
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogTrigger asChild>
          <span className="text-xs text-red-500 hover:text-red-400 cursor-pointer px-1 py-1">Sil</span>
        </DialogTrigger>
        <DialogContent className="bg-[#0f2340] border-red-500/40 text-white">
          <DialogHeader>
            <DialogTitle>Kuryeyi Sil</DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm py-2">
            <span className="text-white font-semibold">{courier.profile?.full_name}</span> adlı kurye kalıcı olarak silinecek.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setDelOpen(false)} variant="outline"
              className="flex-1 border-[#1e4976]/60 text-slate-300 hover:bg-[#1e4976]/20">İptal</Button>
            <Button onClick={handleDelete} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              {loading ? 'Siliniyor...' : 'Evet, Sil'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
