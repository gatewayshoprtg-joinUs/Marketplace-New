export type StatusPesanan =
  | 'Baru'
  | 'Diproses'
  | 'Siap Diantar'
  | 'Diantar'
  | 'Selesai'
  | 'Dibatalkan';

export type SubStatusPesanan = 'Menunggu Barang Shopee' | null;

export type StatusPembayaran = 'Belum Dibayar' | 'Sudah Dibayar';

export type StatusRetur =
  | 'Menunggu'
  | 'Disetujui'
  | 'Ditolak'
  | 'Dibatalkan'
  | 'Selesai';

export type TipeProduk = 'Stok Sendiri' | 'Pre-order Shopee';

export type StatusShopee = 'Belum Dipesan' | 'Sudah Dipesan' | 'Tiba';

export type JenisNotifikasi =
  | 'pesanan_baru'
  | 'status_pesanan'
  | 'pesanan_dibatalkan'
  | 'retur_baru'
  | 'status_retur'
  | 'retur_dibatalkan'
  | 'stok_menipis'
  | 'ulasan_baru';

export type AlasanRetur =
  | 'barang_rusak'
  | 'tidak_sesuai'
  | 'jumlah_kurang'
  | 'lainnya';

export interface Toko {
  id: string;
  email: string;
  ownerEmails: string[];
  nama_toko: string;
  logo_url: string;
  deskripsi: string;
  alamat_kios: string;
  lat: number;
  lng: number;
  no_whatsapp: string;
  dibuat_pada: string;
}

export interface TarifOngkirJarak {
  tarif_dasar: number;
  tarif_per_km: number;
  batas_radius_km: number;
  minimal_belanja_gratis_ongkir: number | null;
}

export interface JadwalAntar {
  id: string;
  hari: number; // 1 = Senin .. 7 = Minggu
  jam_mulai: string;
  jam_selesai: string;
  jam_batas_pesan: string;
  aktif: boolean;
}

export interface Kategori {
  id: string;
  nama: string;
  urutan: number;
}

export interface ProdukVarian {
  id: string;
  produk_id: string;
  nama_varian: string;
  harga: number | null;
  stok: number | null;
  aktif: boolean;
}

export interface ProdukFoto {
  id: string;
  produk_id: string;
  url: string;
  urutan: number;
}

export interface Produk {
  id: string;
  kategori_id: string;
  nama: string;
  deskripsi: string;
  tipe: TipeProduk;
  harga: number;
  stok: number | null;
  stok_minimum: number | null;
  estimasi_tiba_hari: number | null;
  link_shopee: string | null;
  aktif: boolean;
  jumlah_terjual: number;
  dihapus_pada: string | null;
  dibuat_pada: string;
  varian: ProdukVarian[];
  foto: ProdukFoto[];
}

export interface Pembeli {
  id: string;
  nama: string;
  no_whatsapp: string;
  email: string;
  dibuat_pada: string;
}

export interface Alamat {
  id: string;
  pembeli_id: string;
  nama_penerima: string;
  no_telepon: string;
  nama_wilayah: string;
  alamat_lengkap: string;
  patokan: string;
  lat: number | null;
  lng: number | null;
  jarak_km: number | null;
  is_utama: boolean;
  dibuat_pada: string;
}

export interface KeranjangItem {
  id: string;
  pembeli_id: string;
  produk_id: string;
  varian_id: string | null;
  jumlah: number;
  dipilih: boolean;
  dibuat_pada: string;
}

export interface PesananItem {
  id: string;
  pesanan_id: string;
  produk_id: string;
  varian_id: string | null;
  nama_produk: string;
  nama_varian: string | null;
  harga_satuan: number;
  jumlah: number;
  tipe_produk: TipeProduk;
  estimasi_tiba_hari: number | null;
  status_shopee: StatusShopee | null;
  foto_url?: string;
}

export interface RiwayatStatusPesanan {
  id: string;
  pesanan_id: string;
  status_lama: StatusPesanan | null;
  status_baru: StatusPesanan;
  diubah_oleh: 'pembeli' | 'penjual' | 'sistem';
  alasan: string | null;
  waktu: string;
}

export interface Pesanan {
  id: string;
  nomor_pesanan: string;
  pembeli_id: string;
  nama_pembeli?: string;
  no_whatsapp_pembeli?: string;
  nama_penerima: string;
  no_telepon_penerima: string;
  alamat_lengkap: string;
  nama_wilayah: string;
  lat: number | null;
  lng: number | null;
  jarak_km: number | null;
  tanggal_antar: string;
  jam_antar: string;
  catatan_pembeli: string;
  subtotal: number;
  ongkir: number;
  total_cod: number;
  status: StatusPesanan;
  sub_status: SubStatusPesanan;
  status_pembayaran: StatusPembayaran;
  dibatalkan_oleh: 'pembeli' | 'penjual' | null;
  alasan_batal: string | null;
  dikonfirmasi_pada: string | null;
  diantar_pada: string | null;
  selesai_pada: string | null;
  dibuat_pada: string;
  items: PesananItem[];
  riwayat: RiwayatStatusPesanan[];
}

export interface UlasanFoto {
  id: string;
  ulasan_id: string;
  url: string;
  urutan: number;
}

export interface Ulasan {
  id: string;
  pesanan_id: string;
  produk_id: string;
  pembeli_id: string;
  nama_pembeli: string;
  rating: number;
  komentar: string;
  dibuat_pada: string;
  fotos: UlasanFoto[];
}

export interface ReturBukti {
  id: string;
  retur_id: string;
  url: string;
}

export interface Retur {
  id: string;
  pesanan_id: string;
  nomor_pesanan?: string;
  pembeli_id: string;
  nama_pembeli?: string;
  no_whatsapp_pembeli?: string;
  alasan: AlasanRetur;
  keterangan: string;
  status: StatusRetur;
  alasan_penolakan: string | null;
  diajukan_pada: string;
  diputuskan_pada: string | null;
  selesai_pada: string | null;
  bukti: ReturBukti[];
}

export interface Notifikasi {
  id: string;
  penerima_tipe: 'pembeli' | 'penjual';
  penerima_id: string | null;
  jenis: JenisNotifikasi;
  judul: string;
  isi: string;
  tujuan_tipe: 'pesanan' | 'retur' | 'produk';
  tujuan_id: string | null;
  sudah_dibaca: boolean;
  dibuat_pada: string;
}

export interface PengaturanToko {
  batas_waktu_retur_hari: number;
  ukuran_maks_foto_mb: number;
  maks_foto_ulasan: number;
  maks_foto_retur: number;
}

export interface RMStoreDatabase {
  toko: Toko;
  tarif_ongkir: TarifOngkirJarak;
  jadwal_antar: JadwalAntar[];
  kategori: Kategori[];
  produk: Produk[];
  pembeli: Pembeli[];
  alamat: Alamat[];
  keranjang: KeranjangItem[];
  pesanan: Pesanan[];
  ulasan: Ulasan[];
  retur: Retur[];
  notifikasi: Notifikasi[];
  pengaturan: PengaturanToko;
}

export interface DeliverySlotOption {
  dateStr: string; // YYYY-MM-DD
  label: string;
  hariName: string;
  jam_antar: string;
  jam_batas_pesan: string;
}
