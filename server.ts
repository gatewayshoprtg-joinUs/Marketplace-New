import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loadDatabase, saveDatabase } from './server/db';
import {
  Alamat,
  AlasanRetur,
  JenisNotifikasi,
  Notifikasi,
  Pembeli,
  Pesanan,
  PesananItem,
  Produk,
  Retur,
  StatusPesanan,
  Ulasan,
} from './src/types';
import {
  calculateDistanceShipping,
  getAvailableDeliverySlots,
  getProductEffectivePrice,
  getProductEffectiveStock,
  haversineDistanceKm,
  isAddressWithinRadius,
  isProductLowStock,
  isValidWhatsApp,
  isWithinReturnWindow,
  normalizeWhatsApp,
} from './src/utils/format';

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateOrderNumber(existingCount: number): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(3, '0');
  const rand = crypto.randomInt(10, 99);
  return `RM-${yyyy}${mm}${dd}-${seq}${rand}`;
}

function addNotification(
  db: ReturnType<typeof loadDatabase>,
  payload: {
    penerima_tipe: 'pembeli' | 'penjual';
    penerima_id: string | null;
    jenis: JenisNotifikasi;
    judul: string;
    isi: string;
    tujuan_tipe: 'pesanan' | 'retur' | 'produk';
    tujuan_id: string | null;
  }
): Notifikasi {
  const notif: Notifikasi = {
    id: uid('not'),
    ...payload,
    sudah_dibaca: false,
    dibuat_pada: nowIso(),
  };
  db.notifikasi.unshift(notif);
  return notif;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '30mb' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    const bodyErr = err as { type?: string; status?: number };
    if (bodyErr?.type === 'entity.too.large' || bodyErr?.status === 413) {
      return res.status(413).json({
        error: 'Ukuran total foto melebihi batas unggahan. Kurangi jumlah atau ukuran foto.',
      });
    }
    next(err);
  });

  // Public bootstrap (storefront + active catalog + reviews + distance shipping + schedules)
  app.get('/api/bootstrap', (_req, res) => {
    const db = loadDatabase();
    const activeProducts = db.produk.filter((p) => !p.dihapus_pada && p.aktif);
    const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({
      toko: db.toko,
      kategori: [...db.kategori].sort((a, b) => a.urutan - b.urutan),
      tarif_ongkir: db.tarif_ongkir,
      jadwal_antar: [...db.jadwal_antar].sort((a, b) => a.hari - b.hari),
      produk: activeProducts,
      all_produk_public_ref: db.produk.filter((p) => !p.dihapus_pada),
      ulasan: db.ulasan,
      pengaturan: db.pengaturan,
      maps_api_key: mapsApiKey,
    });
  });

  // Server-side Google Maps Geocoding REST API proxies (avoids browser CORS & legacy JS Geocoder)
  function extractAreaLabel(
    components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined,
    fallback: string
  ): string {
    if (!Array.isArray(components)) return fallback;
    const sublocality =
      components.find((c) => c.types.includes('administrative_area_level_3'))?.long_name ||
      components.find((c) => c.types.includes('sublocality_level_1'))?.long_name ||
      components.find((c) => c.types.includes('locality'))?.long_name ||
      '';
    const city =
      components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ||
      components.find((c) => c.types.includes('administrative_area_level_1'))?.long_name ||
      '';
    const parts = [sublocality, city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : fallback;
  }

  app.get('/api/maps/geocode', async (req, res) => {
    const address = String(req.query.address || '').trim();
    if (!address) {
      return res.status(400).json({ error: 'Alamat pencarian wajib diisi.' });
    }
    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    if (!mapsKey) {
      return res.status(503).json({ error: 'Kunci API Google Maps belum tersedia di server.' });
    }
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', address);
      url.searchParams.set('language', 'id');
      url.searchParams.set('region', 'id');
      url.searchParams.set('key', mapsKey);

      const response = await fetch(url.toString());
      if (response.status === 429) {
        return res.status(429).json({ code: 'QUOTA_EXCEEDED', error: 'Google Maps quota reached.' });
      }
      const data = (await response.json()) as {
        status: string;
        error_message?: string;
        results?: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
          address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        }>;
      };
      if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'RESOURCE_EXHAUSTED') {
        return res.status(429).json({ code: 'QUOTA_EXCEEDED', error: data.error_message || 'Quota reached.' });
      }
      if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
        return res.json({ found: false });
      }
      if (data.status !== 'OK') {
        return res.status(400).json({ error: data.error_message || `Geocoding gagal (${data.status}).` });
      }
      const first = data.results[0];
      const lat = first.geometry?.location?.lat;
      const lng = first.geometry?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.json({ found: false });
      }
      const areaLabel = extractAreaLabel(first.address_components, first.formatted_address);
      return res.json({
        found: true,
        lat,
        lng,
        formattedAddress: first.formatted_address,
        areaLabel,
      });
    } catch {
      return res.status(500).json({ error: 'Gagal menghubungi layanan Google Geocoding.' });
    }
  });

  app.get('/api/maps/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Koordinat lat/lng tidak valid.' });
    }
    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    if (!mapsKey) {
      return res.status(503).json({ error: 'Kunci API Google Maps belum tersedia di server.' });
    }
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('language', 'id');
      url.searchParams.set('key', mapsKey);

      const response = await fetch(url.toString());
      if (response.status === 429) {
        return res.status(429).json({ code: 'QUOTA_EXCEEDED', error: 'Google Maps quota reached.' });
      }
      const data = (await response.json()) as {
        status: string;
        error_message?: string;
        results?: Array<{
          formatted_address: string;
          address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        }>;
      };
      if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'RESOURCE_EXHAUSTED') {
        return res.status(429).json({ code: 'QUOTA_EXCEEDED', error: data.error_message || 'Quota reached.' });
      }
      if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
        return res.json({ found: false });
      }
      if (data.status !== 'OK') {
        return res.status(400).json({ error: data.error_message || `Reverse geocoding gagal (${data.status}).` });
      }
      const first = data.results[0];
      const areaLabel = extractAreaLabel(first.address_components, first.formatted_address);
      return res.json({
        found: true,
        formattedAddress: first.formatted_address,
        areaLabel,
      });
    } catch {
      return res.status(500).json({ error: 'Gagal menghubungi layanan Google Geocoding.' });
    }
  });

  // Google Auth simulation enforcing exact spec rules
  app.post('/api/auth/google', (req, res) => {
    const { email, name, roleIntent } = req.body as {
      email?: string;
      name?: string;
      roleIntent?: 'buyer' | 'seller';
    };
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({ error: 'Email akun Google tidak valid.' });
    }

    const db = loadDatabase();

    if (roleIntent === 'seller') {
      const isOwner =
        db.toko.email.toLowerCase() === normalizedEmail ||
        db.toko.ownerEmails.some((e) => e.toLowerCase() === normalizedEmail);
      if (!isOwner) {
        return res.status(403).json({
          error: 'Akses ditolak: akun Google ini tidak punya akses penjual.',
        });
      }
      const storeComplete = Boolean(
        db.toko.nama_toko.trim() && db.toko.alamat_kios.trim() && db.toko.no_whatsapp.trim()
      );
      return res.json({
        role: 'seller',
        email: normalizedEmail,
        storeComplete,
        toko: db.toko,
      });
    }

    const existingBuyer = db.pembeli.find((b) => b.email.toLowerCase() === normalizedEmail);
    if (!existingBuyer) {
      return res.json({
        role: 'buyer',
        needsProfile: true,
        googleAccount: {
          email: normalizedEmail,
          name: (name || normalizedEmail.split('@')[0]).trim(),
        },
      });
    }

    return res.json({
      role: 'buyer',
      needsProfile: false,
      pembeli: existingBuyer,
    });
  });

  // Complete Buyer Profile (Lengkapi Data Diri - No 12 & 13)
  app.post('/api/buyer/complete-profile', (req, res) => {
    const { email, nama, no_whatsapp } = req.body as {
      email?: string;
      nama?: string;
      no_whatsapp?: string;
    };
    const db = loadDatabase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (nama || '').trim();
    const rawWa = (no_whatsapp || '').trim();

    if (!cleanEmail || !cleanName || !rawWa) {
      return res.status(400).json({ error: 'Nama lengkap dan nomor WhatsApp wajib diisi.' });
    }
    if (!isValidWhatsApp(rawWa)) {
      return res.status(400).json({
        error: 'Format nomor WhatsApp tidak valid. Gunakan format 628xxx (contoh: 6281234567890).',
      });
    }

    const existing = db.pembeli.find((b) => b.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.json({ pembeli: existing });
    }

    const newBuyer: Pembeli = {
      id: uid('pemb'),
      nama: cleanName,
      no_whatsapp: normalizeWhatsApp(rawWa),
      email: cleanEmail,
      dibuat_pada: nowIso(),
    };
    db.pembeli.push(newBuyer);
    saveDatabase(db);
    return res.json({ pembeli: newBuyer });
  });

  // Buyer session hydration
  app.get('/api/buyer/state', (req, res) => {
    const pembeliId = String(req.query.pembeliId || '');
    if (!pembeliId) {
      return res.status(401).json({ error: 'Sesi pembeli tidak ditemukan.' });
    }
    const db = loadDatabase();
    const pembeli = db.pembeli.find((b) => b.id === pembeliId);
    if (!pembeli) {
      return res.status(401).json({ error: 'Sesi berakhir, silakan masuk kembali.' });
    }
    const alamat = db.alamat.filter((a) => a.pembeli_id === pembeliId);
    const keranjang = db.keranjang.filter((c) => c.pembeli_id === pembeliId);
    const pesanan = db.pesanan
      .filter((p) => p.pembeli_id === pembeliId)
      .sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada));
    const retur = db.retur
      .filter((r) => r.pembeli_id === pembeliId)
      .sort((a, b) => b.diajukan_pada.localeCompare(a.diajukan_pada));
    const notifikasi = db.notifikasi
      .filter((n) => n.penerima_tipe === 'pembeli' && n.penerima_id === pembeliId)
      .sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada));

    res.json({ pembeli, alamat, keranjang, pesanan, retur, notifikasi });
  });

  // Update Buyer Profile (Edit Profil - No 88 & 109)
  app.put('/api/buyer/profile', (req, res) => {
    const { pembeliId, nama, no_whatsapp } = req.body as {
      pembeliId?: string;
      nama?: string;
      no_whatsapp?: string;
    };
    const db = loadDatabase();
    const buyer = db.pembeli.find((b) => b.id === pembeliId);
    if (!buyer) return res.status(404).json({ error: 'Pembeli tidak ditemukan.' });
    if (!nama?.trim() || !no_whatsapp?.trim()) {
      return res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
    }
    if (!isValidWhatsApp(no_whatsapp)) {
      return res.status(400).json({ error: 'Format nomor WhatsApp tidak valid (gunakan 628xxx).' });
    }
    buyer.nama = nama.trim();
    buyer.no_whatsapp = normalizeWhatsApp(no_whatsapp);
    saveDatabase(db);
    res.json({ pembeli: buyer });
  });

  // Buyer Addresses CRUD (Google Maps pinned coordinates + distance)
  app.post('/api/buyer/addresses', (req, res) => {
    const {
      pembeliId,
      nama_penerima,
      no_telepon,
      nama_wilayah,
      alamat_lengkap,
      patokan,
      lat,
      lng,
      jarak_km,
    } = req.body as Partial<Alamat> & { pembeliId?: string };
    const db = loadDatabase();
    if (!pembeliId || !db.pembeli.some((b) => b.id === pembeliId)) {
      return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    }
    if (!nama_penerima?.trim() || !no_telepon?.trim() || !alamat_lengkap?.trim()) {
      return res.status(400).json({ error: 'Lengkapi nama penerima, nomor telepon, dan alamat lengkap.' });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: 'Pin lokasi pada Google Maps belum ditentukan. Masukkan alamat untuk menempatkan pin di peta.',
      });
    }
    const existingCount = db.alamat.filter((a) => a.pembeli_id === pembeliId).length;
    const haversineKm = haversineDistanceKm(db.toko, { lat, lng });
    const computedKm =
      typeof jarak_km === 'number' && Number.isFinite(jarak_km) && jarak_km >= 0
        ? Math.round(jarak_km * 10) / 10
        : haversineKm;

    const newAddr: Alamat = {
      id: uid('alm'),
      pembeli_id: pembeliId,
      nama_penerima: nama_penerima.trim(),
      no_telepon: normalizeWhatsApp(no_telepon),
      nama_wilayah: (nama_wilayah || '').trim() || 'Lokasi Terpin',
      alamat_lengkap: alamat_lengkap.trim(),
      patokan: (patokan || '').trim(),
      lat,
      lng,
      jarak_km: computedKm,
      is_utama: existingCount === 0,
      dibuat_pada: nowIso(),
    };
    db.alamat.push(newAddr);
    saveDatabase(db);
    res.json({ alamat: newAddr });
  });

  app.put('/api/buyer/addresses/:id', (req, res) => {
    const { id } = req.params;
    const {
      pembeliId,
      nama_penerima,
      no_telepon,
      nama_wilayah,
      alamat_lengkap,
      patokan,
      lat,
      lng,
      jarak_km,
    } = req.body as Partial<Alamat> & { pembeliId?: string };
    const db = loadDatabase();
    const addr = db.alamat.find((a) => a.id === id && a.pembeli_id === pembeliId);
    if (!addr) return res.status(404).json({ error: 'Alamat tidak ditemukan.' });
    if (!nama_penerima?.trim() || !no_telepon?.trim() || !alamat_lengkap?.trim()) {
      return res.status(400).json({ error: 'Semua kolom wajib harus diisi.' });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: 'Pin lokasi pada Google Maps belum ditentukan. Masukkan alamat untuk menempatkan pin di peta.',
      });
    }
    const haversineKm = haversineDistanceKm(db.toko, { lat, lng });
    const computedKm =
      typeof jarak_km === 'number' && Number.isFinite(jarak_km) && jarak_km >= 0
        ? Math.round(jarak_km * 10) / 10
        : haversineKm;

    addr.nama_penerima = nama_penerima.trim();
    addr.no_telepon = normalizeWhatsApp(no_telepon);
    addr.nama_wilayah = (nama_wilayah || '').trim() || addr.nama_wilayah || 'Lokasi Terpin';
    addr.alamat_lengkap = alamat_lengkap.trim();
    addr.patokan = (patokan || '').trim();
    addr.lat = lat;
    addr.lng = lng;
    addr.jarak_km = computedKm;
    saveDatabase(db);
    res.json({ alamat: addr });
  });

  app.post('/api/buyer/addresses/:id/primary', (req, res) => {
    const { id } = req.params;
    const { pembeliId } = req.body as { pembeliId?: string };
    const db = loadDatabase();
    const target = db.alamat.find((a) => a.id === id && a.pembeli_id === pembeliId);
    if (!target) return res.status(404).json({ error: 'Alamat tidak ditemukan.' });
    db.alamat.forEach((a) => {
      if (a.pembeli_id === pembeliId) {
        a.is_utama = a.id === id;
      }
    });
    saveDatabase(db);
    res.json({ alamat: db.alamat.filter((a) => a.pembeli_id === pembeliId) });
  });

  app.delete('/api/buyer/addresses/:id', (req, res) => {
    const { id } = req.params;
    const pembeliId = String(req.query.pembeliId || '');
    const db = loadDatabase();
    const target = db.alamat.find((a) => a.id === id && a.pembeli_id === pembeliId);
    if (!target) return res.status(404).json({ error: 'Alamat tidak ditemukan.' });
    if (target.is_utama) {
      return res.status(400).json({
        error: 'Alamat utama tidak dapat dihapus. Jadikan alamat lain sebagai utama terlebih dahulu.',
      });
    }
    db.alamat = db.alamat.filter((a) => a.id !== id);
    saveDatabase(db);
    res.json({ success: true });
  });

  // Cart endpoints
  app.post('/api/buyer/cart', (req, res) => {
    const { pembeliId, produk_id, varian_id, jumlah } = req.body as {
      pembeliId?: string;
      produk_id?: string;
      varian_id?: string | null;
      jumlah?: number;
    };
    const db = loadDatabase();
    if (!pembeliId || !db.pembeli.some((b) => b.id === pembeliId)) {
      return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    }
    const product = db.produk.find((p) => p.id === produk_id && p.aktif && !p.dihapus_pada);
    if (!product) return res.status(404).json({ error: 'Produk tidak tersedia.' });

    let selectedVariant = null;
    if (product.varian.length > 0) {
      selectedVariant = product.varian.find((v) => v.id === varian_id && v.aktif) || null;
      if (!selectedVariant) {
        return res.status(400).json({ error: 'Pilih varian yang tersedia terlebih dahulu.' });
      }
    }

    const qtyToAdd = Math.max(1, jumlah || 1);
    const maxStock = getProductEffectiveStock(product, selectedVariant);
    if (product.tipe === 'Stok Sendiri' && maxStock <= 0) {
      return res.status(400).json({ error: 'Stok produk habis.' });
    }

    const existing = db.keranjang.find(
      (c) =>
        c.pembeli_id === pembeliId &&
        c.produk_id === product.id &&
        (c.varian_id || null) === (selectedVariant?.id || null)
    );

    if (existing) {
      const nextQty = existing.jumlah + qtyToAdd;
      if (product.tipe === 'Stok Sendiri' && nextQty > maxStock) {
        return res.status(400).json({ error: `Jumlah di keranjang melebihi stok maksimal (${maxStock}).` });
      }
      existing.jumlah = nextQty;
      existing.dipilih = true;
    } else {
      if (product.tipe === 'Stok Sendiri' && qtyToAdd > maxStock) {
        return res.status(400).json({ error: `Jumlah melebihi stok tersedia (${maxStock}).` });
      }
      db.keranjang.push({
        id: uid('cart'),
        pembeli_id: pembeliId,
        produk_id: product.id,
        varian_id: selectedVariant?.id || null,
        jumlah: qtyToAdd,
        dipilih: true,
        dibuat_pada: nowIso(),
      });
    }

    saveDatabase(db);
    res.json({ keranjang: db.keranjang.filter((c) => c.pembeli_id === pembeliId) });
  });

  app.patch('/api/buyer/cart/:id', (req, res) => {
    const { id } = req.params;
    const { pembeliId, jumlah, dipilih } = req.body as {
      pembeliId?: string;
      jumlah?: number;
      dipilih?: boolean;
    };
    const db = loadDatabase();
    const item = db.keranjang.find((c) => c.id === id && c.pembeli_id === pembeliId);
    if (!item) return res.status(404).json({ error: 'Item keranjang tidak ditemukan.' });

    const product = db.produk.find((p) => p.id === item.produk_id);
    if (typeof dipilih === 'boolean') {
      if (dipilih && (!product || !product.aktif || product.dihapus_pada)) {
        return res.status(400).json({ error: 'Produk sudah tidak tersedia.' });
      }
      item.dipilih = dipilih;
    }
    if (typeof jumlah === 'number') {
      if (jumlah < 1) {
        return res.status(400).json({ error: 'Jumlah minimal 1. Gunakan tombol Hapus Item untuk menghapus.' });
      }
      if (product && product.tipe === 'Stok Sendiri') {
        const variant = product.varian.find((v) => v.id === item.varian_id) || null;
        const maxStock = getProductEffectiveStock(product, variant);
        if (jumlah > maxStock) {
          return res.status(400).json({ error: `Stok maksimal tersedia adalah ${maxStock}.` });
        }
      }
      item.jumlah = jumlah;
    }

    saveDatabase(db);
    res.json({ keranjang: db.keranjang.filter((c) => c.pembeli_id === pembeliId) });
  });

  app.post('/api/buyer/cart/select-all', (req, res) => {
    const { pembeliId, dipilih } = req.body as { pembeliId?: string; dipilih?: boolean };
    const db = loadDatabase();
    db.keranjang.forEach((c) => {
      if (c.pembeli_id === pembeliId) {
        const product = db.produk.find((p) => p.id === c.produk_id);
        const isAvail = Boolean(product && product.aktif && !product.dihapus_pada);
        if (!dipilih) {
          c.dipilih = false;
        } else if (isAvail) {
          c.dipilih = true;
        }
      }
    });
    saveDatabase(db);
    res.json({ keranjang: db.keranjang.filter((c) => c.pembeli_id === pembeliId) });
  });

  app.delete('/api/buyer/cart/:id', (req, res) => {
    const { id } = req.params;
    const pembeliId = String(req.query.pembeliId || '');
    const db = loadDatabase();
    db.keranjang = db.keranjang.filter((c) => !(c.id === id && c.pembeli_id === pembeliId));
    saveDatabase(db);
    res.json({ keranjang: db.keranjang.filter((c) => c.pembeli_id === pembeliId) });
  });

  // Place Order (Checkout - No 62, 63, 64, 176, 184, 185)
  app.post('/api/buyer/orders', (req, res) => {
    const {
      pembeliId,
      alamatId,
      tanggal_antar,
      jam_antar,
      catatan_pembeli,
      expectedOngkir,
      buyNowItem,
    } = req.body as {
      pembeliId?: string;
      alamatId?: string;
      tanggal_antar?: string;
      jam_antar?: string;
      catatan_pembeli?: string;
      expectedOngkir?: number;
      buyNowItem?: { produk_id: string; varian_id: string | null; jumlah: number } | null;
    };

    const db = loadDatabase();
    const buyer = db.pembeli.find((b) => b.id === pembeliId);
    if (!buyer) return res.status(401).json({ error: 'Sesi pembeli tidak valid.' });

    const address = db.alamat.find((a) => a.id === alamatId && a.pembeli_id === pembeliId);
    if (!address) {
      return res.status(400).json({ error: 'Pilih alamat pengantaran terlebih dahulu.' });
    }
    if (address.lat === null || address.lng === null) {
      return res.status(409).json({
        code: 'ADDRESS_PIN_MISSING',
        error: 'Alamat ini belum memiliki pin koordinat Google Maps. Edit alamat untuk menempatkan pin.',
      });
    }
    const distanceKm =
      typeof address.jarak_km === 'number' && Number.isFinite(address.jarak_km)
        ? address.jarak_km
        : haversineDistanceKm(db.toko, { lat: address.lat, lng: address.lng });

    if (!isAddressWithinRadius(distanceKm, db.tarif_ongkir)) {
      return res.status(409).json({
        code: 'OUT_OF_RADIUS',
        error: `Jarak alamat (${distanceKm} km) melebihi batas radius pengantaran toko (${db.tarif_ongkir.batas_radius_km} km). Pilih alamat lain.`,
      });
    }

    const sourceItems = buyNowItem
      ? [{ produk_id: buyNowItem.produk_id, varian_id: buyNowItem.varian_id, jumlah: buyNowItem.jumlah }]
      : db.keranjang
          .filter((c) => c.pembeli_id === pembeliId && c.dipilih)
          .map((c) => ({ produk_id: c.produk_id, varian_id: c.varian_id, jumlah: c.jumlah }));

    if (sourceItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada item yang dipilih untuk checkout.' });
    }

    const orderItems: PesananItem[] = [];
    let subtotal = 0;
    let longestPreorderDays = 0;
    const orderId = uid('ord');

    for (const src of sourceItems) {
      const product = db.produk.find((p) => p.id === src.produk_id);
      if (!product || !product.aktif || product.dihapus_pada) {
        return res.status(409).json({
          code: 'ITEM_UNAVAILABLE',
          error: `Produk "${product?.nama || 'pilihan'}" sudah dinonaktifkan atau dihapus penjual.`,
        });
      }
      const variant = src.varian_id
        ? product.varian.find((v) => v.id === src.varian_id && v.aktif) || null
        : null;
      if (product.varian.length > 0 && !variant) {
        return res.status(409).json({
          code: 'ITEM_UNAVAILABLE',
          error: `Varian untuk "${product.nama}" tidak lagi tersedia.`,
        });
      }

      if (product.tipe === 'Stok Sendiri') {
        const stock = getProductEffectiveStock(product, variant);
        if (src.jumlah > stock || stock <= 0) {
          return res.status(409).json({
            code: 'STOCK_INSUFFICIENT',
            error: `Stok "${product.nama}"${variant ? ` (${variant.nama_varian})` : ''} tidak cukup (tersedia: ${stock}).`,
          });
        }
      } else {
        longestPreorderDays = Math.max(longestPreorderDays, product.estimasi_tiba_hari || 1);
      }

      const price = getProductEffectivePrice(product, variant);
      subtotal += price * src.jumlah;
      const primaryPhoto = [...product.foto].sort((a, b) => a.urutan - b.urutan)[0]?.url;

      orderItems.push({
        id: uid('oi'),
        pesanan_id: orderId,
        produk_id: product.id,
        varian_id: variant ? variant.id : null,
        nama_produk: product.nama,
        nama_varian: variant ? variant.nama_varian : null,
        harga_satuan: price,
        jumlah: src.jumlah,
        tipe_produk: product.tipe,
        estimasi_tiba_hari: product.tipe === 'Pre-order Shopee' ? product.estimasi_tiba_hari : null,
        status_shopee: product.tipe === 'Pre-order Shopee' ? 'Belum Dipesan' : null,
        foto_url: primaryPhoto,
      });
    }

    const actualOngkir = calculateDistanceShipping(subtotal, distanceKm, db.tarif_ongkir);
    if (typeof expectedOngkir === 'number' && expectedOngkir !== actualOngkir) {
      return res.status(409).json({
        code: 'ONGKIR_CHANGED',
        newOngkir: actualOngkir,
        error: 'Tarif ongkir atau minimal gratis ongkir berubah. Periksa rincian terbaru sebelum menekan Buat Pesanan.',
      });
    }

    // Validate delivery schedule against current slots (No 184)
    const validSlots = getAvailableDeliverySlots(db.jadwal_antar, longestPreorderDays, new Date());
    const chosenSlot = validSlots.find(
      (s) => s.dateStr === tanggal_antar && s.jam_antar === jam_antar
    );
    if (!chosenSlot) {
      return res.status(409).json({
        code: 'SCHEDULE_INVALID',
        error: 'Jadwal antar yang dipilih sudah lewat jam batas pesan atau tidak tersedia lagi. Pilih jadwal lain.',
      });
    }

    const now = nowIso();
    const newOrder: Pesanan = {
      id: orderId,
      nomor_pesanan: generateOrderNumber(db.pesanan.length),
      pembeli_id: buyer.id,
      nama_pembeli: buyer.nama,
      no_whatsapp_pembeli: buyer.no_whatsapp,
      nama_penerima: address.nama_penerima,
      no_telepon_penerima: address.no_telepon,
      alamat_lengkap: address.patokan
        ? `${address.alamat_lengkap} (Patokan: ${address.patokan})`
        : address.alamat_lengkap,
      nama_wilayah: address.nama_wilayah,
      lat: address.lat,
      lng: address.lng,
      jarak_km: distanceKm,
      tanggal_antar: chosenSlot.dateStr,
      jam_antar: chosenSlot.jam_antar,
      catatan_pembeli: (catatan_pembeli || '').trim(),
      subtotal,
      ongkir: actualOngkir,
      total_cod: subtotal + actualOngkir,
      status: 'Baru',
      sub_status: null,
      status_pembayaran: 'Belum Dibayar',
      dibatalkan_oleh: null,
      alasan_batal: null,
      dikonfirmasi_pada: null,
      diantar_pada: null,
      selesai_pada: null,
      dibuat_pada: now,
      items: orderItems,
      riwayat: [
        {
          id: uid('rh'),
          pesanan_id: orderId,
          status_lama: null,
          status_baru: 'Baru',
          diubah_oleh: 'pembeli',
          alasan: null,
          waktu: now,
        },
      ],
    };

    db.pesanan.unshift(newOrder);

    // Clear only checked cart items if not Beli Sekarang (No 62)
    if (!buyNowItem) {
      db.keranjang = db.keranjang.filter((c) => !(c.pembeli_id === pembeliId && c.dipilih));
    }

    addNotification(db, {
      penerima_tipe: 'penjual',
      penerima_id: null,
      jenis: 'pesanan_baru',
      judul: `Pesanan Baru ${newOrder.nomor_pesanan}`,
      isi: `${buyer.nama} membuat pesanan COD senilai Rp${newOrder.total_cod.toLocaleString('id-ID')}.`,
      tujuan_tipe: 'pesanan',
      tujuan_id: newOrder.id,
    });

    saveDatabase(db);
    res.json({ pesanan: newOrder });
  });

  // Buyer Cancels Order (No 71)
  app.post('/api/buyer/orders/:id/cancel', (req, res) => {
    const { id } = req.params;
    const { pembeliId } = req.body as { pembeliId?: string };
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id && o.pembeli_id === pembeliId);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Baru') {
      return res.status(409).json({
        error: `Pembatalan ditolak karena status pesanan saat ini sudah "${order.status}". Hubungi penjual untuk koordinasi pembatalan.`,
      });
    }

    const oldStatus = order.status;
    order.status = 'Dibatalkan';
    order.dibatalkan_oleh = 'pembeli';
    order.alasan_batal = 'Dibatalkan oleh pembeli sebelum konfirmasi';
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: oldStatus,
      status_baru: 'Dibatalkan',
      diubah_oleh: 'pembeli',
      alasan: order.alasan_batal,
      waktu: nowIso(),
    });

    addNotification(db, {
      penerima_tipe: 'penjual',
      penerima_id: null,
      jenis: 'pesanan_dibatalkan',
      judul: `Pesanan ${order.nomor_pesanan} Dibatalkan Pembeli`,
      isi: `${order.nama_penerima} membatalkan pesanan saat menunggu konfirmasi.`,
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });

    saveDatabase(db);
    res.json({ pesanan: order });
  });

  // Buyer Reorder / Beli Lagi (No 77)
  app.post('/api/buyer/orders/:id/reorder', (req, res) => {
    const { id } = req.params;
    const { pembeliId } = req.body as { pembeliId?: string };
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id && o.pembeli_id === pembeliId);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

    const skipped: string[] = [];
    let addedCount = 0;

    for (const item of order.items) {
      const product = db.produk.find((p) => p.id === item.produk_id && p.aktif && !p.dihapus_pada);
      if (!product) {
        skipped.push(`${item.nama_produk} (produk nonaktif/dihapus)`);
        continue;
      }
      const variant = item.varian_id
        ? product.varian.find((v) => v.id === item.varian_id && v.aktif) || null
        : null;
      if (item.varian_id && !variant) {
        skipped.push(`${item.nama_produk} - ${item.nama_varian} (varian tidak aktif)`);
        continue;
      }

      const maxStock = getProductEffectiveStock(product, variant);
      if (product.tipe === 'Stok Sendiri' && maxStock <= 0) {
        skipped.push(`${item.nama_produk} (stok habis)`);
        continue;
      }

      const desiredQty = product.tipe === 'Stok Sendiri' ? Math.min(item.jumlah, maxStock) : item.jumlah;
      const existingCart = db.keranjang.find(
        (c) =>
          c.pembeli_id === pembeliId &&
          c.produk_id === product.id &&
          (c.varian_id || null) === (variant?.id || null)
      );
      if (existingCart) {
        existingCart.jumlah =
          product.tipe === 'Stok Sendiri'
            ? Math.min(existingCart.jumlah + desiredQty, maxStock)
            : existingCart.jumlah + desiredQty;
        existingCart.dipilih = true;
      } else {
        db.keranjang.push({
          id: uid('cart'),
          pembeli_id: pembeliId!,
          produk_id: product.id,
          varian_id: variant?.id || null,
          jumlah: desiredQty,
          dipilih: true,
          dibuat_pada: nowIso(),
        });
      }
      addedCount++;
    }

    saveDatabase(db);
    res.json({
      addedCount,
      skipped,
      keranjang: db.keranjang.filter((c) => c.pembeli_id === pembeliId),
    });
  });

  // Buyer Review (No 79, 80, 159-161)
  app.post('/api/buyer/reviews', (req, res) => {
    const { pembeliId, pesanan_id, produk_id, rating, komentar, fotos } = req.body as {
      pembeliId?: string;
      pesanan_id?: string;
      produk_id?: string;
      rating?: number;
      komentar?: string;
      fotos?: string[];
    };
    const db = loadDatabase();
    const buyer = db.pembeli.find((b) => b.id === pembeliId);
    if (!buyer) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const order = db.pesanan.find((o) => o.id === pesanan_id && o.pembeli_id === pembeliId);
    if (!order || order.status !== 'Selesai') {
      return res.status(400).json({ error: 'Ulasan hanya dapat diberikan untuk pesanan Selesai.' });
    }
    if (!order.items.some((i) => i.produk_id === produk_id)) {
      return res.status(400).json({ error: 'Produk tidak ada dalam pesanan ini.' });
    }
    if (db.ulasan.some((u) => u.pesanan_id === pesanan_id && u.produk_id === produk_id)) {
      return res.status(400).json({ error: 'Anda sudah memberikan ulasan untuk produk ini pada pesanan ini.' });
    }
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Pilih rating bintang 1 sampai 5 terlebih dahulu.' });
    }
    const photoList = (Array.isArray(fotos) ? fotos : [])
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .slice(0, db.pengaturan.maks_foto_ulasan);
    const reviewId = uid('ul');
    const review: Ulasan = {
      id: reviewId,
      pesanan_id: pesanan_id!,
      produk_id: produk_id!,
      pembeli_id: buyer.id,
      nama_pembeli: buyer.nama,
      rating: numericRating,
      komentar: (komentar || '').trim(),
      dibuat_pada: nowIso(),
      fotos: photoList.map((url, idx) => ({
        id: uid('uf'),
        ulasan_id: reviewId,
        url,
        urutan: idx + 1,
      })),
    };
    db.ulasan.unshift(review);

    const product = db.produk.find((p) => p.id === produk_id);
    addNotification(db, {
      penerima_tipe: 'penjual',
      penerima_id: null,
      jenis: 'ulasan_baru',
      judul: `Ulasan Baru (${rating}/5) dari ${buyer.nama}`,
      isi: `${product?.nama || 'Produk'}: "${review.komentar || 'Memberi rating ' + rating + ' bintang'}"`,
      tujuan_tipe: 'produk',
      tujuan_id: produk_id!,
    });

    saveDatabase(db);
    res.json({ ulasan: review });
  });

  // Buyer Return Submit & Cancel (No 82, 83, 168-169)
  app.post('/api/buyer/returns', (req, res) => {
    const { pembeliId, pesanan_id, alasan, keterangan, bukti } = req.body as {
      pembeliId?: string;
      pesanan_id?: string;
      alasan?: AlasanRetur;
      keterangan?: string;
      bukti?: string[];
    };
    const db = loadDatabase();
    const buyer = db.pembeli.find((b) => b.id === pembeliId);
    if (!buyer) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const order = db.pesanan.find((o) => o.id === pesanan_id && o.pembeli_id === pembeliId);
    if (!order || order.status !== 'Selesai') {
      return res.status(400).json({ error: 'Retur hanya dapat diajukan untuk pesanan berstatus Selesai.' });
    }
    if (!isWithinReturnWindow(order.selesai_pada, db.pengaturan.batas_waktu_retur_hari)) {
      return res.status(400).json({
        error: `Batas waktu pengajuan retur (${db.pengaturan.batas_waktu_retur_hari} hari setelah selesai) telah berakhir.`,
      });
    }
    const activeReturn = db.retur.find(
      (r) => r.pesanan_id === order.id && (r.status === 'Menunggu' || r.status === 'Disetujui')
    );
    if (activeReturn) {
      return res.status(400).json({ error: 'Sudah ada pengajuan retur aktif untuk pesanan ini.' });
    }
    if (!alasan || !bukti || bukti.length === 0) {
      return res.status(400).json({ error: 'Pilih alasan retur dan unggah minimal 1 foto bukti.' });
    }

    const retId = uid('ret');
    const newReturn: Retur = {
      id: retId,
      pesanan_id: order.id,
      nomor_pesanan: order.nomor_pesanan,
      pembeli_id: buyer.id,
      nama_pembeli: buyer.nama,
      no_whatsapp_pembeli: buyer.no_whatsapp,
      alasan,
      keterangan: (keterangan || '').trim(),
      status: 'Menunggu',
      alasan_penolakan: null,
      diajukan_pada: nowIso(),
      diputuskan_pada: null,
      selesai_pada: null,
      bukti: bukti.slice(0, db.pengaturan.maks_foto_retur).map((url) => ({
        id: uid('rb'),
        retur_id: retId,
        url,
      })),
    };
    db.retur.unshift(newReturn);

    addNotification(db, {
      penerima_tipe: 'penjual',
      penerima_id: null,
      jenis: 'retur_baru',
      judul: `Pengajuan Retur ${order.nomor_pesanan}`,
      isi: `${buyer.nama} mengajukan retur (${alasan.replace('_', ' ')}).`,
      tujuan_tipe: 'retur',
      tujuan_id: newReturn.id,
    });

    saveDatabase(db);
    res.json({ retur: newReturn });
  });

  app.post('/api/buyer/returns/:id/cancel', (req, res) => {
    const { id } = req.params;
    const { pembeliId } = req.body as { pembeliId?: string };
    const db = loadDatabase();
    const ret = db.retur.find((r) => r.id === id && r.pembeli_id === pembeliId);
    if (!ret) return res.status(404).json({ error: 'Pengajuan retur tidak ditemukan.' });
    if (ret.status !== 'Menunggu') {
      return res.status(409).json({ error: 'Retur tidak dapat dibatalkan karena sudah diproses penjual.' });
    }
    ret.status = 'Dibatalkan';
    ret.diputuskan_pada = nowIso();

    addNotification(db, {
      penerima_tipe: 'penjual',
      penerima_id: null,
      jenis: 'retur_dibatalkan',
      judul: `Retur ${ret.nomor_pesanan || ''} Dibatalkan Pembeli`,
      isi: `${ret.nama_pembeli || 'Pembeli'} membatalkan pengajuan retur.`,
      tujuan_tipe: 'retur',
      tujuan_id: ret.id,
    });

    saveDatabase(db);
    res.json({ retur: ret });
  });

  // Notifications (Buyer & Seller)
  app.post('/api/notifications/:id/read', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const n = db.notifikasi.find((item) => item.id === id);
    if (n) {
      n.sudah_dibaca = true;
      saveDatabase(db);
    }
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const { recipientType, pembeliId } = req.body as {
      recipientType: 'pembeli' | 'penjual';
      pembeliId?: string;
    };
    const db = loadDatabase();
    db.notifikasi.forEach((n) => {
      if (recipientType === 'penjual' && n.penerima_tipe === 'penjual') {
        n.sudah_dibaca = true;
      } else if (
        recipientType === 'pembeli' &&
        n.penerima_tipe === 'pembeli' &&
        n.penerima_id === pembeliId
      ) {
        n.sudah_dibaca = true;
      }
    });
    saveDatabase(db);
    res.json({ success: true });
  });

  // ==========================================
  // SELLER API ROUTES
  // ==========================================
  app.get('/api/seller/overview', (_req, res) => {
    const db = loadDatabase();
    res.json({
      toko: db.toko,
      tarif_ongkir: db.tarif_ongkir,
      jadwal_antar: [...db.jadwal_antar].sort((a, b) => a.hari - b.hari),
      kategori: [...db.kategori].sort((a, b) => a.urutan - b.urutan),
      produk: db.produk.filter((p) => !p.dihapus_pada),
      pesanan: [...db.pesanan].sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada)),
      retur: [...db.retur].sort((a, b) => b.diajukan_pada.localeCompare(a.diajukan_pada)),
      ulasan: db.ulasan,
      notifikasi: db.notifikasi
        .filter((n) => n.penerima_tipe === 'penjual')
        .sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada)),
      pengaturan: db.pengaturan,
    });
  });

  app.put('/api/seller/store', (req, res) => {
    const { nama_toko, logo_url, deskripsi, alamat_kios, lat, lng, no_whatsapp } = req.body as Partial<{
      nama_toko: string;
      logo_url: string;
      deskripsi: string;
      alamat_kios: string;
      lat: number;
      lng: number;
      no_whatsapp: string;
    }>;
    const db = loadDatabase();
    if (!nama_toko?.trim() || !alamat_kios?.trim() || !no_whatsapp?.trim()) {
      return res.status(400).json({ error: 'Nama toko, alamat kios, dan nomor WhatsApp wajib diisi.' });
    }
    if (!isValidWhatsApp(no_whatsapp)) {
      return res.status(400).json({ error: 'Format nomor WhatsApp toko tidak valid (gunakan 628xxx).' });
    }
    const coordsChanged =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      (lat !== db.toko.lat || lng !== db.toko.lng);

    db.toko.nama_toko = nama_toko.trim();
    db.toko.logo_url = (logo_url || '').trim() || db.toko.logo_url;
    db.toko.deskripsi = (deskripsi || '').trim();
    db.toko.alamat_kios = alamat_kios.trim();
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      db.toko.lat = lat;
      db.toko.lng = lng;
    }
    db.toko.no_whatsapp = normalizeWhatsApp(no_whatsapp);

    if (coordsChanged) {
      for (const addr of db.alamat) {
        if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
          addr.jarak_km = haversineDistanceKm(db.toko, { lat: addr.lat, lng: addr.lng });
        }
      }
    }

    saveDatabase(db);
    res.json({ toko: db.toko });
  });

  // Seller Products CRUD
  app.post('/api/seller/products', (req, res) => {
    const body = req.body as Partial<Produk>;
    const db = loadDatabase();
    if (!body.nama?.trim() || !body.kategori_id || !body.harga || body.harga <= 0) {
      return res.status(400).json({ error: 'Nama produk, kategori, dan harga valid wajib diisi.' });
    }
    const prodId = uid('prod');
    const varianList = (body.varian || []).map((v) => ({
      id: v.id || uid('var'),
      produk_id: prodId,
      nama_varian: v.nama_varian.trim(),
      harga: v.harga ? Number(v.harga) : null,
      stok: Number(v.stok ?? 0),
      aktif: v.aktif !== false,
    }));
    const fotoList = (body.foto || []).map((f, idx) => ({
      id: f.id || uid('ft'),
      produk_id: prodId,
      url: f.url,
      urutan: idx + 1,
    }));

    const newProd: Produk = {
      id: prodId,
      kategori_id: body.kategori_id,
      nama: body.nama.trim(),
      deskripsi: (body.deskripsi || '').trim(),
      tipe: 'Stok Sendiri',
      harga: Number(body.harga),
      stok: varianList.length === 0 ? Number(body.stok ?? 0) : null,
      stok_minimum: Number(body.stok_minimum ?? 3),
      estimasi_tiba_hari: null,
      link_shopee: null,
      aktif: body.aktif !== false,
      jumlah_terjual: 0,
      dihapus_pada: null,
      dibuat_pada: nowIso(),
      varian: varianList,
      foto: fotoList,
    };
    db.produk.unshift(newProd);
    saveDatabase(db);
    res.json({ produk: newProd });
  });

  app.put('/api/seller/products/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<Produk>;
    const db = loadDatabase();
    const existing = db.produk.find((p) => p.id === id && !p.dihapus_pada);
    if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    if (!body.nama?.trim() || !body.kategori_id || !body.harga || body.harga <= 0) {
      return res.status(400).json({ error: 'Nama produk, kategori, dan harga valid wajib diisi.' });
    }

    const varianList = (body.varian || []).map((v) => ({
      id: v.id || uid('var'),
      produk_id: id,
      nama_varian: v.nama_varian.trim(),
      harga: v.harga ? Number(v.harga) : null,
      stok: Number(v.stok ?? 0),
      aktif: v.aktif !== false,
    }));
    const fotoList = (body.foto || []).map((f, idx) => ({
      id: f.id || uid('ft'),
      produk_id: id,
      url: f.url,
      urutan: idx + 1,
    }));

    existing.kategori_id = body.kategori_id;
    existing.nama = body.nama.trim();
    existing.deskripsi = (body.deskripsi || '').trim();
    existing.tipe = 'Stok Sendiri';
    existing.harga = Number(body.harga);
    existing.stok = varianList.length === 0 ? Number(body.stok ?? 0) : null;
    existing.stok_minimum = Number(body.stok_minimum ?? 3);
    existing.estimasi_tiba_hari = null;
    existing.link_shopee = null;
    existing.aktif = body.aktif !== false;
    existing.varian = varianList;
    existing.foto = fotoList;

    saveDatabase(db);
    res.json({ produk: existing });
  });

  app.patch('/api/seller/products/:id/toggle', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const p = db.produk.find((prod) => prod.id === id && !prod.dihapus_pada);
    if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    p.aktif = !p.aktif;
    saveDatabase(db);
    res.json({ produk: p });
  });

  app.delete('/api/seller/products/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const p = db.produk.find((prod) => prod.id === id && !prod.dihapus_pada);
    if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    p.dihapus_pada = nowIso();
    p.aktif = false;
    saveDatabase(db);
    res.json({ success: true });
  });

  // Seller Order Actions (Spec No 58-72, 114-116, 125)
  app.post('/api/seller/orders/:id/confirm', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Baru') {
      return res.status(409).json({
        error: `Aksi ditolak: status pesanan sudah berubah menjadi "${order.status}".`,
      });
    }

    // Check self-stock availability first
    for (const item of order.items) {
      if (item.tipe_produk === 'Stok Sendiri') {
        const product = db.produk.find((p) => p.id === item.produk_id);
        if (!product) continue;
        const variant = item.varian_id
          ? product.varian.find((v) => v.id === item.varian_id) || null
          : null;
        const avail = getProductEffectiveStock(product, variant);
        if (avail < item.jumlah) {
          return res.status(400).json({
            error: `Stok "${item.nama_produk}"${item.nama_varian ? ` (${item.nama_varian})` : ''} tidak cukup (tersisa ${avail}, butuh ${item.jumlah}). Tambah stok terlebih dahulu atau Tolak Pesanan.`,
          });
        }
      }
    }

    // Deduct self-stock & trigger stok_menipis notifications if <= stok_minimum
    for (const item of order.items) {
      if (item.tipe_produk === 'Stok Sendiri') {
        const product = db.produk.find((p) => p.id === item.produk_id);
        if (!product) continue;
        if (item.varian_id) {
          const variant = product.varian.find((v) => v.id === item.varian_id);
          if (variant && variant.stok !== null) {
            variant.stok = Math.max(0, variant.stok - item.jumlah);
          }
        } else if (product.stok !== null) {
          product.stok = Math.max(0, product.stok - item.jumlah);
        }
        if (isProductLowStock(product)) {
          const remaining = getProductEffectiveStock(product, null);
          addNotification(db, {
            penerima_tipe: 'penjual',
            penerima_id: null,
            jenis: 'stok_menipis',
            judul: `Stok Menipis: ${product.nama}`,
            isi: `Total stok tersisa ${remaining} unit (batas minimum ${product.stok_minimum}).`,
            tujuan_tipe: 'produk',
            tujuan_id: product.id,
          });
        }
      }
    }

    const now = nowIso();
    order.status = 'Diproses';
    order.dikonfirmasi_pada = now;
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: 'Baru',
      status_baru: 'Diproses',
      diubah_oleh: 'penjual',
      alasan: null,
      waktu: now,
    });

    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pesanan ${order.nomor_pesanan} Dikonfirmasi`,
      isi: 'Penjual sedang menyiapkan pesanan Anda.',
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });

    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/reject', (req, res) => {
    const { id } = req.params;
    const { alasan } = req.body as { alasan?: string };
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Baru') {
      return res.status(409).json({
        error: `Aksi ditolak: status pesanan sudah berubah menjadi "${order.status}".`,
      });
    }
    if (!alasan?.trim()) {
      return res.status(400).json({ error: 'Isi alasan penolakan terlebih dahulu.' });
    }

    order.status = 'Dibatalkan';
    order.dibatalkan_oleh = 'penjual';
    order.alasan_batal = alasan.trim();
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: 'Baru',
      status_baru: 'Dibatalkan',
      diubah_oleh: 'penjual',
      alasan: order.alasan_batal,
      waktu: nowIso(),
    });

    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pesanan ${order.nomor_pesanan} Dibatalkan`,
      isi: `Alasan: ${order.alasan_batal}`,
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });

    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/shopee-ordered', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Diproses') {
      return res.status(409).json({ error: `Status pesanan saat ini "${order.status}".` });
    }
    const shopeeItems = order.items.filter((i) => i.tipe_produk === 'Pre-order Shopee');
    if (shopeeItems.length === 0) {
      return res.status(400).json({ error: 'Pesanan ini tidak memiliki item Pre-order Shopee.' });
    }
    shopeeItems.forEach((i) => {
      if (i.status_shopee === 'Belum Dipesan') {
        i.status_shopee = 'Sudah Dipesan';
      }
    });
    order.sub_status = 'Menunggu Barang Shopee';

    const maxEta = Math.max(...shopeeItems.map((i) => i.estimasi_tiba_hari || 3));
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Item Shopee Pesanan ${order.nomor_pesanan} Sudah Dipesan`,
      isi: `Menunggu barang Shopee tiba di kios (estimasi ${maxEta} hari).`,
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });

    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/shopee-arrived', (req, res) => {
    const { id } = req.params;
    const { itemId } = req.body as { itemId?: string };
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Diproses') {
      return res.status(409).json({ error: `Status pesanan saat ini "${order.status}".` });
    }

    const shopeeItems = order.items.filter((i) => i.tipe_produk === 'Pre-order Shopee');
    shopeeItems.forEach((i) => {
      if (!itemId || i.id === itemId) {
        i.status_shopee = 'Tiba';
      }
    });

    const allArrived = shopeeItems.every((i) => i.status_shopee === 'Tiba');
    if (allArrived) {
      order.sub_status = null;
      order.status = 'Siap Diantar';
      order.riwayat.push({
        id: uid('rh'),
        pesanan_id: order.id,
        status_lama: 'Diproses',
        status_baru: 'Siap Diantar',
        diubah_oleh: 'penjual',
        alasan: 'Semua barang Shopee sudah tiba di kios',
        waktu: nowIso(),
      });
      addNotification(db, {
        penerima_tipe: 'pembeli',
        penerima_id: order.pembeli_id,
        jenis: 'status_pesanan',
        judul: `Pesanan ${order.nomor_pesanan} Siap Diantar`,
        isi: 'Semua barang pesanan sudah lengkap di kios dan siap diantar sesuai jadwal.',
        tujuan_tipe: 'pesanan',
        tujuan_id: order.id,
      });
    }

    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/ready', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Diproses') {
      return res.status(409).json({ error: `Status pesanan saat ini "${order.status}".` });
    }
    const pendingShopee = order.items.some(
      (i) => i.tipe_produk === 'Pre-order Shopee' && i.status_shopee !== 'Tiba'
    );
    if (pendingShopee) {
      return res.status(400).json({ error: 'Masih ada item Pre-order Shopee yang belum tiba.' });
    }
    order.sub_status = null;
    order.status = 'Siap Diantar';
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: 'Diproses',
      status_baru: 'Siap Diantar',
      diubah_oleh: 'penjual',
      alasan: null,
      waktu: nowIso(),
    });
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pesanan ${order.nomor_pesanan} Siap Diantar`,
      isi: 'Pesanan Anda siap diantar pada jadwal yang dipilih.',
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });
    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/start-delivery', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Siap Diantar') {
      return res.status(409).json({ error: `Status pesanan saat ini "${order.status}".` });
    }
    const now = nowIso();
    order.status = 'Diantar';
    order.diantar_pada = now;
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: 'Siap Diantar',
      status_baru: 'Diantar',
      diubah_oleh: 'penjual',
      alasan: null,
      waktu: now,
    });
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pesanan ${order.nomor_pesanan} Sedang Diantar`,
      isi: `Kurir sedang menuju alamat Anda. Siapkan uang pas COD Rp${order.total_cod.toLocaleString('id-ID')}.`,
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });
    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/complete', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Diantar') {
      return res.status(409).json({ error: `Status pesanan saat ini "${order.status}".` });
    }
    const now = nowIso();
    order.status = 'Selesai';
    order.status_pembayaran = 'Sudah Dibayar';
    order.selesai_pada = now;
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: 'Diantar',
      status_baru: 'Selesai',
      diubah_oleh: 'penjual',
      alasan: 'Pembayaran COD diterima',
      waktu: now,
    });

    // Increment jumlah_terjual (No 69)
    for (const item of order.items) {
      const product = db.produk.find((p) => p.id === item.produk_id);
      if (product) {
        product.jumlah_terjual += item.jumlah;
      }
    }

    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pesanan ${order.nomor_pesanan} Selesai`,
      isi: 'Terima kasih telah berbelanja! Anda sekarang dapat memberi ulasan produk.',
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });

    saveDatabase(db);
    res.json({ pesanan: order });
  });

  function restoreOrderSelfStock(db: ReturnType<typeof loadDatabase>, order: Pesanan) {
    for (const item of order.items) {
      if (item.tipe_produk === 'Stok Sendiri') {
        const product = db.produk.find((p) => p.id === item.produk_id);
        if (!product) continue;
        if (item.varian_id) {
          const variant = product.varian.find((v) => v.id === item.varian_id);
          if (variant && variant.stok !== null) {
            variant.stok += item.jumlah;
          }
        } else if (product.stok !== null) {
          product.stok += item.jumlah;
        }
      }
    }
  }

  app.post('/api/seller/orders/:id/cancel', (req, res) => {
    const { id } = req.params;
    const { alasan } = req.body as { alasan?: string };
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (!(['Diproses', 'Siap Diantar'] as StatusPesanan[]).includes(order.status)) {
      return res.status(409).json({ error: `Tidak dapat membatalkan pesanan pada status "${order.status}".` });
    }
    if (!alasan?.trim()) return res.status(400).json({ error: 'Alasan pembatalan wajib diisi.' });

    const oldStatus = order.status;
    restoreOrderSelfStock(db, order);
    order.status = 'Dibatalkan';
    order.sub_status = null;
    order.dibatalkan_oleh = 'penjual';
    order.alasan_batal = alasan.trim();
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: oldStatus,
      status_baru: 'Dibatalkan',
      diubah_oleh: 'penjual',
      alasan: order.alasan_batal,
      waktu: nowIso(),
    });
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pesanan ${order.nomor_pesanan} Dibatalkan Penjual`,
      isi: `Alasan: ${order.alasan_batal}`,
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });
    saveDatabase(db);
    res.json({ pesanan: order });
  });

  app.post('/api/seller/orders/:id/fail-delivery', (req, res) => {
    const { id } = req.params;
    const { alasan } = req.body as { alasan?: string };
    const db = loadDatabase();
    const order = db.pesanan.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'Diantar') {
      return res.status(409).json({ error: `Aksi Gagal Antar hanya berlaku untuk status Diantar.` });
    }
    if (!alasan?.trim()) return res.status(400).json({ error: 'Isi alasan gagal antar terlebih dahulu.' });

    restoreOrderSelfStock(db, order);
    order.status = 'Dibatalkan';
    order.dibatalkan_oleh = 'penjual';
    order.alasan_batal = `Gagal antar: ${alasan.trim()}`;
    order.riwayat.push({
      id: uid('rh'),
      pesanan_id: order.id,
      status_lama: 'Diantar',
      status_baru: 'Dibatalkan',
      diubah_oleh: 'penjual',
      alasan: order.alasan_batal,
      waktu: nowIso(),
    });
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: order.pembeli_id,
      jenis: 'status_pesanan',
      judul: `Pengantaran ${order.nomor_pesanan} Gagal`,
      isi: order.alasan_batal,
      tujuan_tipe: 'pesanan',
      tujuan_id: order.id,
    });
    saveDatabase(db);
    res.json({ pesanan: order });
  });

  // Seller Return Actions (No 77-79, 103)
  app.post('/api/seller/returns/:id/approve', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const ret = db.retur.find((r) => r.id === id);
    if (!ret) return res.status(404).json({ error: 'Retur tidak ditemukan.' });
    if (ret.status !== 'Menunggu') {
      return res.status(409).json({ error: `Status retur sudah berubah menjadi "${ret.status}".` });
    }
    ret.status = 'Disetujui';
    ret.diputuskan_pada = nowIso();
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: ret.pembeli_id,
      jenis: 'status_retur',
      judul: `Retur ${ret.nomor_pesanan || ''} Disetujui`,
      isi: 'Penjual menyetujui pengajuan retur Anda. Koordinasikan pengambilan barang lewat WhatsApp.',
      tujuan_tipe: 'retur',
      tujuan_id: ret.id,
    });
    saveDatabase(db);
    res.json({ retur: ret });
  });

  app.post('/api/seller/returns/:id/reject', (req, res) => {
    const { id } = req.params;
    const { alasan } = req.body as { alasan?: string };
    const db = loadDatabase();
    const ret = db.retur.find((r) => r.id === id);
    if (!ret) return res.status(404).json({ error: 'Retur tidak ditemukan.' });
    if (ret.status !== 'Menunggu') {
      return res.status(409).json({ error: `Status retur sudah berubah menjadi "${ret.status}".` });
    }
    if (!alasan?.trim()) return res.status(400).json({ error: 'Alasan penolakan retur wajib diisi.' });
    ret.status = 'Ditolak';
    ret.alasan_penolakan = alasan.trim();
    ret.diputuskan_pada = nowIso();
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: ret.pembeli_id,
      jenis: 'status_retur',
      judul: `Retur ${ret.nomor_pesanan || ''} Ditolak`,
      isi: `Alasan: ${ret.alasan_penolakan}`,
      tujuan_tipe: 'retur',
      tujuan_id: ret.id,
    });
    saveDatabase(db);
    res.json({ retur: ret });
  });

  app.post('/api/seller/returns/:id/complete', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const ret = db.retur.find((r) => r.id === id);
    if (!ret) return res.status(404).json({ error: 'Retur tidak ditemukan.' });
    if (ret.status !== 'Disetujui') {
      return res.status(409).json({ error: 'Retur hanya bisa ditandai selesai jika sudah Disetujui.' });
    }
    ret.status = 'Selesai';
    ret.selesai_pada = nowIso();
    addNotification(db, {
      penerima_tipe: 'pembeli',
      penerima_id: ret.pembeli_id,
      jenis: 'status_retur',
      judul: `Retur ${ret.nomor_pesanan || ''} Selesai`,
      isi: 'Proses retur dan pengembalian dana COD telah diselesaikan.',
      tujuan_tipe: 'retur',
      tujuan_id: ret.id,
    });
    saveDatabase(db);
    res.json({ retur: ret });
  });

  // Seller Distance Shipping & Kiosk Pin Configuration (replaces zone-to-zone)
  app.put('/api/seller/shipping', (req, res) => {
    const {
      tarif_dasar,
      tarif_per_km,
      batas_radius_km,
      minimal_belanja_gratis_ongkir,
      alamat_kios,
      lat,
      lng,
    } = req.body as {
      tarif_dasar?: number;
      tarif_per_km?: number;
      batas_radius_km?: number;
      minimal_belanja_gratis_ongkir?: number | null;
      alamat_kios?: string;
      lat?: number;
      lng?: number;
    };
    const db = loadDatabase();
    if (
      tarif_dasar === undefined ||
      Number(tarif_dasar) < 0 ||
      tarif_per_km === undefined ||
      Number(tarif_per_km) < 0 ||
      !batas_radius_km ||
      Number(batas_radius_km) <= 0
    ) {
      return res.status(400).json({
        error: 'Tarif dasar, tarif per km (>= 0), dan radius maksimal (> 0 km) wajib valid.',
      });
    }

    db.tarif_ongkir = {
      tarif_dasar: Number(tarif_dasar),
      tarif_per_km: Number(tarif_per_km),
      batas_radius_km: Number(batas_radius_km),
      minimal_belanja_gratis_ongkir:
        minimal_belanja_gratis_ongkir !== null &&
        minimal_belanja_gratis_ongkir !== undefined &&
        Number(minimal_belanja_gratis_ongkir) > 0
          ? Number(minimal_belanja_gratis_ongkir)
          : null,
    };

    if (alamat_kios?.trim()) {
      db.toko.alamat_kios = alamat_kios.trim();
    }
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      const coordsChanged = lat !== db.toko.lat || lng !== db.toko.lng;
      db.toko.lat = lat;
      db.toko.lng = lng;
      if (coordsChanged) {
        for (const addr of db.alamat) {
          if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
            addr.jarak_km = haversineDistanceKm(db.toko, { lat: addr.lat, lng: addr.lng });
          }
        }
      }
    }

    saveDatabase(db);
    res.json({ tarif_ongkir: db.tarif_ongkir, toko: db.toko });
  });

  // Seller Schedules
  app.put('/api/seller/schedules', (req, res) => {
    const { jadwal_antar } = req.body as { jadwal_antar?: ReturnType<typeof loadDatabase>['jadwal_antar'] };
    const db = loadDatabase();
    if (!Array.isArray(jadwal_antar)) {
      return res.status(400).json({ error: 'Format jadwal antar tidak valid.' });
    }
    db.jadwal_antar = jadwal_antar;
    saveDatabase(db);
    res.json({ jadwal_antar: db.jadwal_antar });
  });

  // Seller Categories CRUD (No 108, 109)
  app.post('/api/seller/categories', (req, res) => {
    const { nama, urutan } = req.body as { nama?: string; urutan?: number };
    const db = loadDatabase();
    if (!nama?.trim()) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    if (db.kategori.some((k) => k.nama.toLowerCase() === nama.trim().toLowerCase())) {
      return res.status(400).json({ error: 'Nama kategori sudah ada.' });
    }
    const cat = {
      id: uid('kat'),
      nama: nama.trim(),
      urutan: Number(urutan ?? db.kategori.length + 1),
    };
    db.kategori.push(cat);
    saveDatabase(db);
    res.json({ kategori: cat });
  });

  app.put('/api/seller/categories/:id', (req, res) => {
    const { id } = req.params;
    const { nama, urutan } = req.body as { nama?: string; urutan?: number };
    const db = loadDatabase();
    const cat = db.kategori.find((k) => k.id === id);
    if (!cat) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    if (!nama?.trim()) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    cat.nama = nama.trim();
    if (urutan !== undefined) cat.urutan = Number(urutan);
    saveDatabase(db);
    res.json({ kategori: cat });
  });

  app.delete('/api/seller/categories/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDatabase();
    const inUse = db.produk.some((p) => p.kategori_id === id && !p.dihapus_pada);
    if (inUse) {
      return res.status(409).json({
        error: 'Kategori masih dipakai produk. Pindahkan atau hapus produknya terlebih dahulu.',
      });
    }
    db.kategori = db.kategori.filter((k) => k.id !== id);
    saveDatabase(db);
    res.json({ success: true });
  });

  // Seller Store Rules (Aturan Toko - No 112-113)
  app.put('/api/seller/settings', (req, res) => {
    const { batas_waktu_retur_hari, ukuran_maks_foto_mb, maks_foto_ulasan, maks_foto_retur } =
      req.body as Partial<ReturnType<typeof loadDatabase>['pengaturan']>;
    const db = loadDatabase();
    if (
      !batas_waktu_retur_hari ||
      batas_waktu_retur_hari < 1 ||
      !ukuran_maks_foto_mb ||
      ukuran_maks_foto_mb < 1 ||
      !maks_foto_ulasan ||
      maks_foto_ulasan < 1 ||
      !maks_foto_retur ||
      maks_foto_retur < 1
    ) {
      return res.status(400).json({ error: 'Semua nilai aturan toko minimal bernilai 1.' });
    }
    db.pengaturan = {
      batas_waktu_retur_hari: Number(batas_waktu_retur_hari),
      ukuran_maks_foto_mb: Number(ukuran_maks_foto_mb),
      maks_foto_ulasan: Number(maks_foto_ulasan),
      maks_foto_retur: Number(maks_foto_retur),
    };
    saveDatabase(db);
    res.json({ pengaturan: db.pengaturan });
  });

  // Vite middleware for dev, static dist for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RMStore server running on http://localhost:${PORT}`);
  });
}

startServer();
