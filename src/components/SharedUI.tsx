import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Printer,
  ShieldAlert,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { Pesanan, StatusPesanan, StatusRetur, Toko } from '../types';
import { formatRupiah, formatTanggalWaktu } from '../utils/format';

export const APP_UI = {
  buyerWide: 'max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5',
  buyerFocused: 'max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5',
  sellerSection: 'w-full space-y-5',
  sellerFocused: 'max-w-4xl w-full space-y-5',
  card: 'bg-white border border-zinc-200 rounded-xl p-4 sm:p-5',
  cardSubtle: 'bg-stone-50 border border-zinc-200 rounded-lg p-3.5 sm:p-4',
  tabBar: 'flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg overflow-x-auto',
  btnPrimary:
    'inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap',
  btnSecondary:
    'inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold bg-white border border-zinc-300 text-zinc-800 rounded-lg hover:bg-stone-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap',
  btnDanger:
    'inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold bg-rose-700 text-white rounded-lg hover:bg-rose-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap',
};

export function PageHeader({
  title,
  subtitle,
  backLabel,
  onBack,
  rightSlot,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 rounded-lg transition-colors shrink-0"
            aria-label={backLabel || 'Kembali'}
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {backLabel && <span>{backLabel}</span>}
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <div className="text-xs sm:text-sm text-zinc-500 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      {rightSlot && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{rightSlot}</div>}
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 text-zinc-400 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-8 h-8 stroke-[1.5] mb-1.5 text-zinc-400" />
        <span className="text-xs font-medium px-3 text-center line-clamp-1 text-zinc-500">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function OrderStatusLabel({
  status,
  subStatus,
  perspective = 'buyer',
}: {
  status: StatusPesanan;
  subStatus?: string | null;
  perspective?: 'buyer' | 'seller';
}) {
  let label: string = status;
  let colorClass = 'text-zinc-700';
  let Icon = Clock;

  if (status === 'Baru') {
    label = perspective === 'buyer' ? 'Menunggu Konfirmasi' : 'Baru';
    colorClass = 'text-amber-700';
    Icon = Clock;
  } else if (status === 'Diproses') {
    label = subStatus ? `Diproses · ${subStatus}` : 'Diproses';
    colorClass = 'text-sky-700';
    Icon = Package;
  } else if (status === 'Siap Diantar') {
    label = perspective === 'buyer' ? 'Diproses · Siap Diantar' : 'Siap Diantar';
    colorClass = 'text-teal-700';
    Icon = CheckCircle2;
  } else if (status === 'Diantar') {
    label = 'Diantar';
    colorClass = 'text-indigo-700';
    Icon = Truck;
  } else if (status === 'Selesai') {
    label = 'Selesai';
    colorClass = 'text-emerald-700';
    Icon = CheckCircle2;
  } else if (status === 'Dibatalkan') {
    label = 'Dibatalkan';
    colorClass = 'text-rose-700';
    Icon = XCircle;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function ReturnStatusLabel({ status }: { status: StatusRetur }) {
  const map: Record<StatusRetur, { color: string; Icon: React.ElementType }> = {
    Menunggu: { color: 'text-amber-700', Icon: Clock },
    Disetujui: { color: 'text-teal-700', Icon: CheckCircle2 },
    Ditolak: { color: 'text-rose-700', Icon: XCircle },
    Dibatalkan: { color: 'text-zinc-500', Icon: XCircle },
    Selesai: { color: 'text-emerald-700', Icon: CheckCircle2 },
  };
  const { color, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function ToastBanner({
  toast,
  onClose,
}: {
  toast: { type: 'success' | 'error' | 'info'; message: string } | null;
  onClose: () => void;
}) {
  if (!toast) return null;
  const styles =
    toast.type === 'error'
      ? 'bg-rose-950 text-white border-rose-800'
      : toast.type === 'success'
      ? 'bg-teal-900 text-white border-teal-700'
      : 'bg-zinc-900 text-white border-zinc-700';

  return (
    <div className="fixed bottom-[calc(74px+env(safe-area-inset-bottom,0px))] lg:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 sm:max-w-md no-print">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm ${styles}`}
        role="status"
      >
        {toast.type === 'error' ? (
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal-300" />
        )}
        <p className="leading-snug flex-1">{toast.message}</p>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-1 -m-1"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Tidak',
  danger = false,
  requireReason = false,
  reasonLabel = 'Alasan',
  reasonPlaceholder = 'Tuliskan alasan yang jelas...',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('Alasan wajib diisi sebelum mengirim.');
      return;
    }
    const val = reason.trim();
    setReason('');
    setError('');
    onConfirm(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 no-print">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-xl border border-zinc-200 shadow-xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button
            onClick={() => {
              setReason('');
              setError('');
              onCancel();
            }}
            className="text-zinc-400 hover:text-zinc-700 p-1.5 -mr-1.5 rounded-lg"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-zinc-600 leading-relaxed mb-4">{description}</p>
        {requireReason && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              {reasonLabel}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder={reasonPlaceholder}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>
        )}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setReason('');
              setError('');
              onCancel();
            }}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap ${
              danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-teal-800 hover:bg-teal-900'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GoogleAuthModal({
  open,
  roleIntent,
  pendingProfile,
  authError,
  onSelectGoogleAccount,
  onCancelAuth,
  onSubmitProfile,
  onCancelProfile,
}: {
  open: boolean;
  roleIntent: 'buyer' | 'seller';
  pendingProfile: { email: string; name: string } | null;
  authError: string | null;
  onSelectGoogleAccount: (email: string, name: string) => void;
  onCancelAuth: () => void;
  onSubmitProfile: (nama: string, noWhatsapp: string) => void;
  onCancelProfile: () => void;
}) {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const [nama, setNama] = useState(pendingProfile?.name || '');
  const [wa, setWa] = useState('');

  React.useEffect(() => {
    if (pendingProfile) {
      setNama(pendingProfile.name);
      setWa('');
    }
  }, [pendingProfile]);

  if (!open) return null;

  if (pendingProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 sm:p-4 no-print">
        <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-xl border border-zinc-200 shadow-xl p-5 sm:p-6 max-h-[92dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
          <h3 className="text-lg font-semibold text-zinc-900 mb-1">Lengkapi Data Diri</h3>
          <p className="text-sm text-zinc-600 mb-4">
            Akun Google <span className="font-medium text-zinc-900">{pendingProfile.email}</span>{' '}
            belum terdaftar. Isi nama dan nomor WhatsApp aktif Anda sebelum melanjutkan.
          </p>
          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {authError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitProfile(nama, wa);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Email Akun Google
              </label>
              <input
                type="email"
                value={pendingProfile.email}
                disabled
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Nama Lengkap <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Rina Wijaya"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Nomor WhatsApp (Format 628xxx) <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                placeholder="6281234567890"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Diisi langsung tanpa verifikasi OTP. Digunakan untuk koordinasi pengantaran COD.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancelProfile}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
              >
                Batal / Keluar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg"
              >
                Simpan &amp; Lanjutkan
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const presetBuyerAccounts = [
    { email: 'siti.rahma@gmail.com', name: 'Siti Rahma', note: 'Pembeli Terdaftar · 2 alamat & riwayat pesanan' },
    { email: 'budi.santoso@gmail.com', name: 'Budi Santoso', note: 'Pembeli Terdaftar · 1 pesanan Baru' },
  ];

  const presetSellerAccounts = [
    { email: 'pemilik@rmstore.id', name: 'Pemilik RMStore', note: 'Akun Pemilik Toko (Akses Penjual)' },
    { email: 'n04671426@gmail.com', name: 'Pemilik RMStore (Google)', note: 'Akun Google Terdaftar Pemilik' },
    { email: 'siti.rahma@gmail.com', name: 'Siti Rahma', note: 'Bukan pemilik toko (uji penolakan akses)' },
  ];

  const accounts = roleIntent === 'seller' ? presetSellerAccounts : presetBuyerAccounts;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 sm:p-4 no-print">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-xl border border-zinc-200 shadow-xl p-5 sm:p-6 max-h-[92dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {roleIntent === 'seller' ? 'Masuk Dashboard Penjual' : 'Masuk / Daftar Pembeli'}
            </h3>
            <p className="text-sm text-zinc-600 mt-0.5">
              {roleIntent === 'seller'
                ? 'Hanya akun Google pemilik toko yang diizinkan mengakses dashboard penjual.'
                : 'Masuk cepat menggunakan akun Google Anda. Tidak ada OTP WhatsApp.'}
            </p>
          </div>
          <button
            onClick={onCancelAuth}
            className="text-zinc-400 hover:text-zinc-700"
            aria-label="Tutup login"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {authError && (
          <div className="my-3 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-zinc-500 mb-1">Pilih Akun Google</div>
          {accounts.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => onSelectGoogleAccount(acc.email, acc.name)}
              className="w-full text-left px-3.5 py-3 rounded-lg border border-zinc-200 hover:border-teal-700 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 truncate">{acc.name}</div>
                <div className="text-xs text-zinc-600 truncate">{acc.email}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{acc.note}</div>
              </div>
              <span className="text-xs font-medium text-teal-800 shrink-0">Lanjutkan</span>
            </button>
          ))}

          {roleIntent === 'buyer' && !showCustom && (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="w-full text-left px-3.5 py-2.5 rounded-lg border border-dashed border-zinc-300 hover:border-teal-700 text-sm font-medium text-zinc-700 hover:text-teal-800 transition-colors"
            >
              + Gunakan Akun Google Baru (uji Lengkapi Data Diri)
            </button>
          )}

          {showCustom && (
            <div className="p-3.5 rounded-lg border border-zinc-200 bg-stone-50 space-y-2.5">
              <div className="text-xs font-semibold text-zinc-800">Akun Google Baru</div>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nama akun Google (mis. Dewi Lestari)"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              />
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="Email Google (mis. dewi@gmail.com)"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customEmail.trim()) {
                      onSelectGoogleAccount(customEmail.trim(), customName.trim() || 'Pengguna Baru');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-teal-800 text-white rounded-md hover:bg-teal-900"
                >
                  Lanjutkan dengan Google
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-100 flex justify-between items-center">
          <button
            type="button"
            onClick={onCancelAuth}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            Batal / Lanjutkan sebagai Tamu
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotaPrintView({
  order,
  toko,
  onBack,
}: {
  order: Pesanan;
  toko: Toko;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-stone-100 py-8 px-4">
      <div className="max-w-xl mx-auto mb-4 flex items-center justify-between no-print">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
        >
          Kembali ke Detail Pesanan
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-800 text-white rounded-lg hover:bg-teal-900"
        >
          <Printer className="w-4 h-4" />
          Cetak Nota
        </button>
      </div>

      <div className="max-w-xl mx-auto bg-white border border-zinc-300 rounded-xl p-8 shadow-sm">
        <div className="flex items-start justify-between border-b border-zinc-200 pb-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{toko.nama_toko}</h1>
            <p className="text-xs text-zinc-600 mt-1">{toko.alamat_kios}</p>
            <p className="text-xs text-zinc-600 font-mono">WA: {toko.no_whatsapp}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Nomor Pesanan</div>
            <div className="text-sm font-mono font-semibold text-zinc-900">
              {order.nomor_pesanan}
            </div>
            <div className="text-xs text-zinc-500 mt-1">{formatTanggalWaktu(order.dibuat_pada)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-6 pb-5 border-b border-zinc-200">
          <div>
            <div className="text-zinc-500 mb-1">Penerima &amp; Alamat Antar</div>
            <div className="font-semibold text-zinc-900 text-sm">{order.nama_penerima}</div>
            <div className="font-mono text-zinc-700 mt-0.5">{order.no_telepon_penerima}</div>
            <div className="text-zinc-700 mt-1 leading-relaxed">
              {order.alamat_lengkap} · {order.nama_wilayah}
              {order.jarak_km ? ` (${order.jarak_km.toFixed(1)} km)` : ''}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Jadwal Pengantaran</div>
            <div className="font-semibold text-zinc-900">{order.tanggal_antar}</div>
            <div className="text-zinc-700 font-mono">{order.jam_antar}</div>
            {order.catatan_pembeli && (
              <div className="mt-2 p-2 bg-stone-50 border border-zinc-200 rounded text-zinc-700">
                Catatan: {order.catatan_pembeli}
              </div>
            )}
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 text-left">
              <th className="py-2 font-medium">Produk</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Harga</th>
              <th className="py-2 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2.5 pr-3">
                  <div className="font-medium text-zinc-900">{item.nama_produk}</div>
                  {item.nama_varian && (
                    <div className="text-xs text-zinc-500">{item.nama_varian}</div>
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums">{item.jumlah}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatRupiah(item.harga_satuan)}
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium">
                  {formatRupiah(item.harga_satuan * item.jumlah)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-zinc-200 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <span>Subtotal Produk</span>
            <span className="tabular-nums">{formatRupiah(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>Ongkir ({order.jarak_km ? `${order.jarak_km.toFixed(1)} km` : order.nama_wilayah})</span>
            <span className="tabular-nums">
              {order.ongkir === 0 ? 'Gratis (Rp0)' : formatRupiah(order.ongkir)}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200">
            <span>Total Tagihan COD</span>
            <span className="tabular-nums">{formatRupiah(order.total_cod)}</span>
          </div>
          <div className="text-xs text-zinc-500 pt-1">
            Status Pembayaran: <span className="font-semibold text-zinc-800">{order.status_pembayaran}</span> (Tunai saat barang diterima)
          </div>
        </div>
      </div>
    </div>
  );
}
