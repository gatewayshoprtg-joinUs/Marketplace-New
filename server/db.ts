import fs from 'fs';
import path from 'path';
import { RMStoreDatabase } from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'rmstore.json');

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function futureDateStr(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function createSeedDatabase(): RMStoreDatabase {
  return {
    toko: {
      id: 'toko-rmstore-01',
      email: 'pemilik@rmstore.id',
      ownerEmails: ['pemilik@rmstore.id', 'n04671426@gmail.com'],
      nama_toko: 'RMStore',
      logo_url: '/src/assets/images/hero_rmstore_counter_1795622176108.jpg',
      deskripsi:
        'Toko kurasi kebutuhan harian dan kopi seduh lokal dengan pengantaran terjadwal langsung ke rumah Anda. Bayar tunai di tempat (COD) setelah barang diterima.',
      alamat_kios: 'Jl. Melati Raya No. 18, Menteng, Jakarta Pusat',
      lat: -6.1944,
      lng: 106.8229,
      no_whatsapp: '6281122334455',
      dibuat_pada: daysAgo(60),
    },
    tarif_ongkir: {
      tarif_dasar: 4000,
      tarif_per_km: 2500,
      batas_radius_km: 15,
      minimal_belanja_gratis_ongkir: 150000,
    },
    jadwal_antar: [
      { id: 'jad-1', hari: 1, jam_mulai: '15:00', jam_selesai: '18:00', jam_batas_pesan: '13:00', aktif: true },
      { id: 'jad-2', hari: 2, jam_mulai: '15:00', jam_selesai: '18:00', jam_batas_pesan: '13:00', aktif: true },
      { id: 'jad-3', hari: 3, jam_mulai: '15:00', jam_selesai: '18:00', jam_batas_pesan: '13:00', aktif: true },
      { id: 'jad-4', hari: 4, jam_mulai: '15:00', jam_selesai: '18:00', jam_batas_pesan: '13:00', aktif: true },
      { id: 'jad-5', hari: 5, jam_mulai: '15:00', jam_selesai: '18:00', jam_batas_pesan: '13:00', aktif: true },
      { id: 'jad-6', hari: 6, jam_mulai: '10:00', jam_selesai: '14:00', jam_batas_pesan: '09:00', aktif: true },
      { id: 'jad-7', hari: 7, jam_mulai: '10:00', jam_selesai: '13:00', jam_batas_pesan: '09:00', aktif: false },
    ],
    kategori: [
      { id: 'kat-kopi', nama: 'Kopi & Minuman', urutan: 1 },
      { id: 'kat-rumah', nama: 'Perlengkapan Rumah', urutan: 2 },
      { id: 'kat-meja', nama: 'Aksesori Meja', urutan: 3 },
      { id: 'kat-tas', nama: 'Tas & Harian', urutan: 4 },
    ],
    produk: [
      {
        id: 'prod-kopi-gayo',
        kategori_id: 'kat-kopi',
        nama: 'Kopi Arabika Gayo Roast 250g',
        deskripsi:
          'Biji kopi Arabika Aceh Gayo sangrai medium dengan karakter rasa cokelat hitam, karamel, dan keasaman buah yang seimbang. Siap kirim langsung dari stok kios.',
        tipe: 'Stok Sendiri',
        harga: 78000,
        stok: null,
        stok_minimum: 5,
        estimasi_tiba_hari: null,
        link_shopee: null,
        aktif: true,
        jumlah_terjual: 42,
        dihapus_pada: null,
        dibuat_pada: daysAgo(25),
        varian: [
          { id: 'var-kopi-biji', produk_id: 'prod-kopi-gayo', nama_varian: 'Biji Utuh (Whole Bean)', harga: 78000, stok: 12, aktif: true },
          { id: 'var-kopi-halus', produk_id: 'prod-kopi-gayo', nama_varian: 'Giling Halus (Tubruk/Espresso)', harga: 78000, stok: 7, aktif: true },
          { id: 'var-kopi-kasar', produk_id: 'prod-kopi-gayo', nama_varian: 'Giling Sedang (V60/Pour Over)', harga: 80000, stok: 3, aktif: true },
        ],
        foto: [
          { id: 'ft-kopi-1', produk_id: 'prod-kopi-gayo', url: '/src/assets/images/product_kopi_arabika_1795622176264.jpg', urutan: 1 },
          { id: 'ft-kopi-2', produk_id: 'prod-kopi-gayo', url: '/src/assets/images/hero_rmstore_counter_1795622176108.jpg', urutan: 2 },
        ],
      },
      {
        id: 'prod-tumbler-matte',
        kategori_id: 'kat-kopi',
        nama: 'Tumbler Vakum Stainless 500ml',
        deskripsi:
          'Botol minum insulated ganda berbahan stainless steel 304 tahan panas hingga 10 jam dan dingin 18 jam. Tutup anti-bocor dengan pegangan ringkas.',
        tipe: 'Stok Sendiri',
        harga: 135000,
        stok: null,
        stok_minimum: 4,
        estimasi_tiba_hari: null,
        link_shopee: null,
        aktif: true,
        jumlah_terjual: 28,
        dihapus_pada: null,
        dibuat_pada: daysAgo(20),
        varian: [
          { id: 'var-tumb-charcoal', produk_id: 'prod-tumbler-matte', nama_varian: 'Matte Charcoal', harga: null, stok: 3, aktif: true },
          { id: 'var-tumb-stone', produk_id: 'prod-tumbler-matte', nama_varian: 'Warm Stone', harga: null, stok: 0, aktif: true },
        ],
        foto: [
          { id: 'ft-tumb-1', produk_id: 'prod-tumbler-matte', url: '/src/assets/images/product_tumbler_stainless_1795622177026.jpg', urutan: 1 },
        ],
      },
      {
        id: 'prod-tas-kanvas',
        kategori_id: 'kat-tas',
        nama: 'Tas Kanvas Harian Heavyweight 14oz',
        deskripsi:
          'Tas jinjing kanvas katun tebal 14oz dengan tali webbing nilon kuat, saku dalam beritsleting untuk laptop 14 inci, dan jahitan ganda rapi.',
        tipe: 'Stok Sendiri',
        harga: 118000,
        stok: 9,
        stok_minimum: 3,
        estimasi_tiba_hari: null,
        link_shopee: null,
        aktif: true,
        jumlah_terjual: 31,
        dihapus_pada: null,
        dibuat_pada: daysAgo(18),
        varian: [],
        foto: [
          { id: 'ft-tas-1', produk_id: 'prod-tas-kanvas', url: '/src/assets/images/product_tas_kanvas_1795622178940.jpg', urutan: 1 },
        ],
      },
      {
        id: 'prod-lampu-meja',
        kategori_id: 'kat-rumah',
        nama: 'Lampu Meja LED Nirkabel Aluminium',
        deskripsi:
          'Lampu baca meja sentuh dengan 3 tingkat kecerahan hangat (2700K–4000K), baterai isi ulang USB-C tahan hingga 20 jam. Tersedia siap kirim dari kios.',
        tipe: 'Stok Sendiri',
        harga: 195000,
        stok: null,
        stok_minimum: 3,
        estimasi_tiba_hari: null,
        link_shopee: null,
        aktif: true,
        jumlah_terjual: 19,
        dihapus_pada: null,
        dibuat_pada: daysAgo(12),
        varian: [
          { id: 'var-lampu-silver', produk_id: 'prod-lampu-meja', nama_varian: 'Brushed Silver', harga: 195000, stok: 5, aktif: true },
          { id: 'var-lampu-black', produk_id: 'prod-lampu-meja', nama_varian: 'Anodized Black', harga: 205000, stok: 4, aktif: true },
        ],
        foto: [
          { id: 'ft-lampu-1', produk_id: 'prod-lampu-meja', url: '/src/assets/images/product_lampu_meja_1795622177052.jpg', urutan: 1 },
        ],
      },
      {
        id: 'prod-organizer-meja',
        kategori_id: 'kat-meja',
        nama: 'Tray Organizer Meja Walnut & Matte',
        deskripsi:
          'Set wadah penataan meja modular kombinasi kayu walnut dan komposit matte hitam. Cocok untuk alat tulis, kacamata, dan catatan harian.',
        tipe: 'Stok Sendiri',
        harga: 162000,
        stok: 7,
        stok_minimum: 3,
        estimasi_tiba_hari: null,
        link_shopee: null,
        aktif: true,
        jumlah_terjual: 14,
        dihapus_pada: null,
        dibuat_pada: daysAgo(8),
        varian: [],
        foto: [
          { id: 'ft-org-1', produk_id: 'prod-organizer-meja', url: '/src/assets/images/product_organizer_meja_1795622177972.jpg', urutan: 1 },
        ],
      },
      {
        id: 'prod-arabika-flores',
        kategori_id: 'kat-kopi',
        nama: 'Kopi Arabika Flores Bajawa 250g',
        deskripsi:
          'Single origin Flores Bajawa dengan aroma rempah lembut, cokelat susu, dan akhir rasa bersih. Tersedia dalam kemasan siap seduh.',
        tipe: 'Stok Sendiri',
        harga: 84000,
        stok: 2,
        stok_minimum: 4,
        estimasi_tiba_hari: null,
        link_shopee: null,
        aktif: true,
        jumlah_terjual: 22,
        dihapus_pada: null,
        dibuat_pada: daysAgo(5),
        varian: [],
        foto: [
          { id: 'ft-flores-1', produk_id: 'prod-arabika-flores', url: '/src/assets/images/product_kopi_arabika_1795622176264.jpg', urutan: 1 },
        ],
      },
    ],
    pembeli: [
      {
        id: 'pemb-siti',
        nama: 'Siti Rahma',
        no_whatsapp: '6281234567890',
        email: 'siti.rahma@gmail.com',
        dibuat_pada: daysAgo(30),
      },
      {
        id: 'pemb-budi',
        nama: 'Budi Santoso',
        no_whatsapp: '6281398765432',
        email: 'budi.santoso@gmail.com',
        dibuat_pada: daysAgo(15),
      },
    ],
    alamat: [
      {
        id: 'alm-siti-1',
        pembeli_id: 'pemb-siti',
        nama_penerima: 'Siti Rahma',
        no_telepon: '6281234567890',
        nama_wilayah: 'Menteng, Jakarta Pusat',
        alamat_lengkap: 'Jl. Kenanga No. 24, Menteng, Jakarta Pusat',
        patokan: 'Rumah pagar abu-abu sebelah apotek',
        lat: -6.1995,
        lng: 106.8358,
        jarak_km: 1.5,
        is_utama: true,
        dibuat_pada: daysAgo(30),
      },
      {
        id: 'alm-siti-2',
        pembeli_id: 'pemb-siti',
        nama_penerima: 'Siti Rahma (Kantor)',
        no_telepon: '6281234567890',
        nama_wilayah: 'Kebayoran Baru, Jakarta Selatan',
        alamat_lengkap: 'Ruko Graha Selatan Blok B2, Jl. Jenderal Sudirman, Jakarta Selatan',
        patokan: 'Titip di meja resepsionis lantai 1',
        lat: -6.2248,
        lng: 106.8065,
        jarak_km: 3.8,
        is_utama: false,
        dibuat_pada: daysAgo(14),
      },
      {
        id: 'alm-budi-1',
        pembeli_id: 'pemb-budi',
        nama_penerima: 'Budi Santoso',
        no_telepon: '6281398765432',
        nama_wilayah: 'Palmerah, Jakarta Barat',
        alamat_lengkap: 'Perumahan Griya Asri Blok D4 No. 11, Palmerah, Jakarta Barat',
        patokan: 'Dekat pos satpam blok D',
        lat: -6.1912,
        lng: 106.7932,
        jarak_km: 3.3,
        is_utama: true,
        dibuat_pada: daysAgo(15),
      },
    ],
    keranjang: [
      {
        id: 'cart-seed-1',
        pembeli_id: 'pemb-siti',
        produk_id: 'prod-kopi-gayo',
        varian_id: 'var-kopi-biji',
        jumlah: 1,
        dipilih: true,
        dibuat_pada: hoursAgo(4),
      },
    ],
    pesanan: [
      {
        id: 'ord-001',
        nomor_pesanan: 'RM-20261124-001',
        pembeli_id: 'pemb-siti',
        nama_pembeli: 'Siti Rahma',
        no_whatsapp_pembeli: '6281234567890',
        nama_penerima: 'Siti Rahma',
        no_telepon_penerima: '6281234567890',
        alamat_lengkap: 'Jl. Kenanga No. 24, Menteng, Jakarta Pusat',
        nama_wilayah: 'Menteng, Jakarta Pusat',
        lat: -6.1995,
        lng: 106.8358,
        jarak_km: 1.5,
        tanggal_antar: futureDateStr(-2),
        jam_antar: '15:00 - 18:00',
        catatan_pembeli: 'Tolong dikemas rapi ya kak',
        subtotal: 196000,
        ongkir: 0,
        total_cod: 196000,
        status: 'Selesai',
        sub_status: null,
        status_pembayaran: 'Sudah Dibayar',
        dibatalkan_oleh: null,
        alasan_batal: null,
        dikonfirmasi_pada: daysAgo(3),
        diantar_pada: daysAgo(2),
        selesai_pada: hoursAgo(18),
        dibuat_pada: daysAgo(3),
        items: [
          {
            id: 'oi-001-a',
            pesanan_id: 'ord-001',
            produk_id: 'prod-kopi-gayo',
            varian_id: 'var-kopi-biji',
            nama_produk: 'Kopi Arabika Gayo Roast 250g',
            nama_varian: 'Biji Utuh (Whole Bean)',
            harga_satuan: 78000,
            jumlah: 1,
            tipe_produk: 'Stok Sendiri',
            estimasi_tiba_hari: null,
            status_shopee: null,
            foto_url: '/src/assets/images/product_kopi_arabika_1795622176264.jpg',
          },
          {
            id: 'oi-001-b',
            pesanan_id: 'ord-001',
            produk_id: 'prod-tas-kanvas',
            varian_id: null,
            nama_produk: 'Tas Kanvas Harian Heavyweight 14oz',
            nama_varian: null,
            harga_satuan: 118000,
            jumlah: 1,
            tipe_produk: 'Stok Sendiri',
            estimasi_tiba_hari: null,
            status_shopee: null,
            foto_url: '/src/assets/images/product_tas_kanvas_1795622178940.jpg',
          },
        ],
        riwayat: [
          { id: 'rh-1', pesanan_id: 'ord-001', status_lama: null, status_baru: 'Baru', diubah_oleh: 'pembeli', alasan: null, waktu: daysAgo(3) },
          { id: 'rh-2', pesanan_id: 'ord-001', status_lama: 'Baru', status_baru: 'Diproses', diubah_oleh: 'penjual', alasan: null, waktu: daysAgo(3) },
          { id: 'rh-3', pesanan_id: 'ord-001', status_lama: 'Diproses', status_baru: 'Siap Diantar', diubah_oleh: 'penjual', alasan: null, waktu: daysAgo(2) },
          { id: 'rh-4', pesanan_id: 'ord-001', status_lama: 'Siap Diantar', status_baru: 'Diantar', diubah_oleh: 'penjual', alasan: null, waktu: daysAgo(2) },
          { id: 'rh-5', pesanan_id: 'ord-001', status_lama: 'Diantar', status_baru: 'Selesai', diubah_oleh: 'penjual', alasan: null, waktu: hoursAgo(18) },
        ],
      },
      {
        id: 'ord-002',
        nomor_pesanan: 'RM-20261125-002',
        pembeli_id: 'pemb-siti',
        nama_pembeli: 'Siti Rahma',
        no_whatsapp_pembeli: '6281234567890',
        nama_penerima: 'Siti Rahma',
        no_telepon_penerima: '6281234567890',
        alamat_lengkap: 'Jl. Kenanga No. 24, Menteng, Jakarta Pusat',
        nama_wilayah: 'Menteng, Jakarta Pusat',
        lat: -6.1995,
        lng: 106.8358,
        jarak_km: 1.5,
        tanggal_antar: futureDateStr(1),
        jam_antar: '15:00 - 18:00',
        catatan_pembeli: 'Kirim sekalian sesuai jadwal antar sore',
        subtotal: 273000,
        ongkir: 0,
        total_cod: 273000,
        status: 'Diproses',
        sub_status: null,
        status_pembayaran: 'Belum Dibayar',
        dibatalkan_oleh: null,
        alasan_batal: null,
        dikonfirmasi_pada: hoursAgo(10),
        diantar_pada: null,
        selesai_pada: null,
        dibuat_pada: hoursAgo(12),
        items: [
          {
            id: 'oi-002-a',
            pesanan_id: 'ord-002',
            produk_id: 'prod-lampu-meja',
            varian_id: 'var-lampu-silver',
            nama_produk: 'Lampu Meja LED Nirkabel Aluminium',
            nama_varian: 'Brushed Silver',
            harga_satuan: 195000,
            jumlah: 1,
            tipe_produk: 'Stok Sendiri',
            estimasi_tiba_hari: null,
            status_shopee: null,
            foto_url: '/src/assets/images/product_lampu_meja_1795622177052.jpg',
          },
          {
            id: 'oi-002-b',
            pesanan_id: 'ord-002',
            produk_id: 'prod-kopi-gayo',
            varian_id: 'var-kopi-biji',
            nama_produk: 'Kopi Arabika Gayo Roast 250g',
            nama_varian: 'Biji Utuh (Whole Bean)',
            harga_satuan: 78000,
            jumlah: 1,
            tipe_produk: 'Stok Sendiri',
            estimasi_tiba_hari: null,
            status_shopee: null,
            foto_url: '/src/assets/images/product_kopi_arabika_1795622176264.jpg',
          },
        ],
        riwayat: [
          { id: 'rh-201', pesanan_id: 'ord-002', status_lama: null, status_baru: 'Baru', diubah_oleh: 'pembeli', alasan: null, waktu: hoursAgo(12) },
          { id: 'rh-202', pesanan_id: 'ord-002', status_lama: 'Baru', status_baru: 'Diproses', diubah_oleh: 'penjual', alasan: null, waktu: hoursAgo(10) },
        ],
      },
      {
        id: 'ord-003',
        nomor_pesanan: 'RM-20261125-003',
        pembeli_id: 'pemb-budi',
        nama_pembeli: 'Budi Santoso',
        no_whatsapp_pembeli: '6281398765432',
        nama_penerima: 'Budi Santoso',
        no_telepon_penerima: '6281398765432',
        alamat_lengkap: 'Perumahan Griya Asri Blok D4 No. 11, Palmerah, Jakarta Barat',
        nama_wilayah: 'Palmerah, Jakarta Barat',
        lat: -6.1912,
        lng: 106.7932,
        jarak_km: 3.3,
        tanggal_antar: futureDateStr(1),
        jam_antar: '15:00 - 18:00',
        catatan_pembeli: 'Mohon hubungi WA sebelum kurir jalan',
        subtotal: 135000,
        ongkir: 12500,
        total_cod: 147500,
        status: 'Baru',
        sub_status: null,
        status_pembayaran: 'Belum Dibayar',
        dibatalkan_oleh: null,
        alasan_batal: null,
        dikonfirmasi_pada: null,
        diantar_pada: null,
        selesai_pada: null,
        dibuat_pada: hoursAgo(2),
        items: [
          {
            id: 'oi-003-a',
            pesanan_id: 'ord-003',
            produk_id: 'prod-tumbler-matte',
            varian_id: 'var-tumb-charcoal',
            nama_produk: 'Tumbler Vakum Stainless 500ml',
            nama_varian: 'Matte Charcoal',
            harga_satuan: 135000,
            jumlah: 1,
            tipe_produk: 'Stok Sendiri',
            estimasi_tiba_hari: null,
            status_shopee: null,
            foto_url: '/src/assets/images/product_tumbler_stainless_1795622177026.jpg',
          },
        ],
        riwayat: [
          { id: 'rh-301', pesanan_id: 'ord-003', status_lama: null, status_baru: 'Baru', diubah_oleh: 'pembeli', alasan: null, waktu: hoursAgo(2) },
        ],
      },
    ],
    ulasan: [
      {
        id: 'ul-001',
        pesanan_id: 'ord-001',
        produk_id: 'prod-kopi-gayo',
        pembeli_id: 'pemb-siti',
        nama_pembeli: 'Siti Rahma',
        rating: 5,
        komentar: 'Aroma kopinya wangi sekali dan kemasan rapi. Pengantaran tepat waktu sesuai jadwal sore.',
        dibuat_pada: hoursAgo(15),
        fotos: [],
      },
    ],
    retur: [],
    notifikasi: [
      {
        id: 'not-penjual-1',
        penerima_tipe: 'penjual',
        penerima_id: null,
        jenis: 'pesanan_baru',
        judul: 'Pesanan Baru RM-20261125-003',
        isi: 'Budi Santoso memesan 1 item senilai Rp145.000 (COD). Segera konfirmasi pesanan.',
        tujuan_tipe: 'pesanan',
        tujuan_id: 'ord-003',
        sudah_dibaca: false,
        dibuat_pada: hoursAgo(2),
      },
      {
        id: 'not-penjual-2',
        penerima_tipe: 'penjual',
        penerima_id: null,
        jenis: 'stok_menipis',
        judul: 'Stok Menipis: Kopi Arabika Flores Bajawa 250g',
        isi: 'Sisa stok saat ini 2 unit (batas minimum 4 unit).',
        tujuan_tipe: 'produk',
        tujuan_id: 'prod-arabika-flores',
        sudah_dibaca: false,
        dibuat_pada: hoursAgo(5),
      },
      {
        id: 'not-pembeli-1',
        penerima_tipe: 'pembeli',
        penerima_id: 'pemb-siti',
        jenis: 'status_pesanan',
        judul: 'Pesanan RM-20261125-002 Diproses',
        isi: 'Penjual sedang menyiapkan pesanan Anda untuk pengantaran terjadwal.',
        tujuan_tipe: 'pesanan',
        tujuan_id: 'ord-002',
        sudah_dibaca: false,
        dibuat_pada: hoursAgo(10),
      },
    ],
    pengaturan: {
      batas_waktu_retur_hari: 3,
      ukuran_maks_foto_mb: 5,
      maks_foto_ulasan: 3,
      maks_foto_retur: 5,
    },
  };
}

export function loadDatabase(): RMStoreDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as RMStoreDatabase & { zona_ongkir?: unknown };
    let migrated = false;

    if (typeof parsed.toko.lat !== 'number' || typeof parsed.toko.lng !== 'number') {
      parsed.toko.lat = -6.1944;
      parsed.toko.lng = 106.8229;
      migrated = true;
    }
    if (!parsed.tarif_ongkir) {
      parsed.tarif_ongkir = {
        tarif_dasar: 4000,
        tarif_per_km: 2500,
        batas_radius_km: 15,
        minimal_belanja_gratis_ongkir: 150000,
      };
      migrated = true;
    }
    if ('zona_ongkir' in parsed) {
      delete parsed.zona_ongkir;
      migrated = true;
    }
    const seedCoords: Record<string, { lat: number; lng: number; jarak_km: number; nama_wilayah: string }> = {
      'alm-siti-1': { lat: -6.1995, lng: 106.8358, jarak_km: 1.5, nama_wilayah: 'Menteng, Jakarta Pusat' },
      'alm-siti-2': { lat: -6.2248, lng: 106.8065, jarak_km: 3.8, nama_wilayah: 'Kebayoran Baru, Jakarta Selatan' },
      'alm-budi-1': { lat: -6.1912, lng: 106.7932, jarak_km: 3.3, nama_wilayah: 'Palmerah, Jakarta Barat' },
    };
    for (const addr of parsed.alamat) {
      const legacyAddr = addr as unknown as Record<string, unknown>;
      if ('zona_id' in legacyAddr) {
        delete legacyAddr.zona_id;
        migrated = true;
      }
      if (typeof addr.lat !== 'number' || typeof addr.lng !== 'number') {
        const preset = seedCoords[addr.id] || { lat: -6.201, lng: 106.832, jarak_km: 1.3, nama_wilayah: addr.nama_wilayah || 'Jakarta' };
        addr.lat = preset.lat;
        addr.lng = preset.lng;
        addr.jarak_km = preset.jarak_km;
        if (seedCoords[addr.id]) addr.nama_wilayah = preset.nama_wilayah;
        migrated = true;
      }
    }
    for (const ord of parsed.pesanan) {
      const legacyOrd = ord as unknown as Record<string, unknown>;
      if ('zona_id' in legacyOrd) {
        delete legacyOrd.zona_id;
        migrated = true;
      }
      if (typeof ord.lat !== 'number' || typeof ord.lng !== 'number') {
        ord.lat = -6.1995;
        ord.lng = 106.8358;
        ord.jarak_km = 1.5;
        migrated = true;
      }
    }

    if (migrated) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

export function saveDatabase(db: RMStoreDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
