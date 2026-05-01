'use client';

import { MessageCircle } from 'lucide-react';

interface WhatsAppButtonProps {
  phoneNumber: string;
}

export default function WhatsAppButton({ phoneNumber }: WhatsAppButtonProps) {
  const clean = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/${clean}?text=${encodeURIComponent('Merhaba, kurye hizmetiniz hakkında bilgi almak istiyorum.')}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 btn-orange-glow group"
      style={{ boxShadow: '0 0 24px rgba(34,197,94,0.5)' }}
    >
      <MessageCircle className="w-6 h-6 flex-shrink-0" />
      <span className="hidden sm:block text-sm whitespace-nowrap">
        Hemen Kurye Çağır
      </span>
    </a>
  );
}
