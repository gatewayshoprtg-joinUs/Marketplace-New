import { AlasanRetur, DeliverySlotOption, JadwalAntar, Produk, ProdukVarian, TarifOngkirJarak } from '../types';

export const HARI_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export const ALASAN_RETUR_LABELS: Record<AlasanRetur, string> = {
  barang_rusak: 'Barang rusak saat diterima',
  tidak_sesuai: 'Barang tidak sesuai pesanan',
  jumlah_kurang: 'Jumlah barang kurang',
  lainnya: 'Alasan lainnya',
};

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTanggalWaktu(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function normalizeWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('8')) {
    return '62' + digits;
  }
  return digits;
}

export function isValidWhatsApp(phone: string): boolean {
  const normalized = normalizeWhatsApp(phone);
  return /^628\d{7,12}$/.test(normalized);
}

export function buildWhatsAppUrl(phone: string, text?: string): string {
  const normalized = normalizeWhatsApp(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${normalized}${query}`;
}

export function getProductEffectivePrice(product: Produk, varian?: ProdukVarian | null): number {
  if (varian && varian.harga !== null && varian.harga !== undefined) {
    return varian.harga;
  }
  return product.harga;
}

export function getProductEffectiveStock(product: Produk, varian?: ProdukVarian | null): number {
  if (product.tipe === 'Pre-order Shopee') {
    return 999; // Pre-order Shopee doesn't track self-stock limit
  }
  if (product.varian && product.varian.length > 0) {
    if (varian) {
      return varian.aktif ? (varian.stok ?? 0) : 0;
    }
    return product.varian
      .filter((v) => v.aktif)
      .reduce((sum, v) => sum + (v.stok ?? 0), 0);
  }
  return product.stok ?? 0;
}

export function isProductLowStock(product: Produk): boolean {
  if (product.tipe !== 'Stok Sendiri' || !product.aktif || product.dihapus_pada) return false;
  if (product.stok_minimum === null || product.stok_minimum === undefined) return false;
  const totalStock = getProductEffectiveStock(product, null);
  return totalStock <= product.stok_minimum;
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 10) / 10;
}

export function isAddressWithinRadius(
  distanceKm: number | null | undefined,
  config: TarifOngkirJarak
): boolean {
  if (distanceKm === null || distanceKm === undefined || Number.isNaN(distanceKm)) return false;
  return distanceKm <= config.batas_radius_km;
}

export function calculateDistanceShipping(
  subtotal: number,
  distanceKm: number | null | undefined,
  config: TarifOngkirJarak
): number {
  if (distanceKm === null || distanceKm === undefined || Number.isNaN(distanceKm)) return 0;
  if (
    config.minimal_belanja_gratis_ongkir !== null &&
    config.minimal_belanja_gratis_ongkir > 0 &&
    subtotal >= config.minimal_belanja_gratis_ongkir
  ) {
    return 0;
  }
  const raw = config.tarif_dasar + Math.max(0, distanceKm) * config.tarif_per_km;
  return Math.round(raw / 500) * 500;
}

export function getAvailableDeliverySlots(
  schedules: JadwalAntar[],
  longestPreorderDays: number,
  nowDate: Date = new Date()
): DeliverySlotOption[] {
  const activeMap = new Map<number, JadwalAntar>();
  for (const s of schedules) {
    if (s.aktif) {
      activeMap.set(s.hari, s);
    }
  }
  if (activeMap.size === 0) return [];

  // Use consistent WIB (UTC+7) store clock across browser and server
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wibNow = new Date(nowDate.getTime() + WIB_OFFSET_MS);
  const currentWibMinutes = wibNow.getUTCHours() * 60 + wibNow.getUTCMinutes();

  const options: DeliverySlotOption[] = [];
  // Start checking from today + longestPreorderDays (if PO Shopee > 0, strictly after ETA days)
  const startOffset = longestPreorderDays > 0 ? longestPreorderDays + 1 : 0;

  for (let offset = startOffset; offset < startOffset + 21 && options.length < 8; offset++) {
    const candidateWib = new Date(
      Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + offset)
    );

    // JS getUTCDay(): 0 = Sun, 1 = Mon .. 6 = Sat -> Spec hari: 1 = Mon .. 7 = Sun
    const jsDay = candidateWib.getUTCDay();
    const specHari = jsDay === 0 ? 7 : jsDay;
    const sched = activeMap.get(specHari);
    if (!sched) continue;

    // Check cutoff hour if candidate is today in WIB (offset === 0)
    if (offset === 0) {
      const [limitH, limitM] = sched.jam_batas_pesan.split(':').map((n) => parseInt(n, 10));
      const cutoffMinutes = (limitH || 0) * 60 + (limitM || 0);
      if (currentWibMinutes >= cutoffMinutes) {
        continue;
      }
    }

    const yyyy = candidateWib.getUTCFullYear();
    const mm = String(candidateWib.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(candidateWib.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const hariName = HARI_NAMES[specHari];
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(candidateWib);

    options.push({
      dateStr,
      hariName,
      label: `${hariName}, ${dateFormatted} · ${sched.jam_mulai}–${sched.jam_selesai}`,
      jam_antar: `${sched.jam_mulai} - ${sched.jam_selesai}`,
      jam_batas_pesan: sched.jam_batas_pesan,
    });
  }

  return options;
}

export function isWithinReturnWindow(
  selesaiPada: string | null,
  batasHari: number,
  now: Date = new Date()
): boolean {
  if (!selesaiPada) return false;
  const completed = new Date(selesaiPada);
  if (Number.isNaN(completed.getTime())) return false;
  const deadline = new Date(completed.getTime() + batasHari * 24 * 60 * 60 * 1000);
  return now.getTime() <= deadline.getTime();
}
