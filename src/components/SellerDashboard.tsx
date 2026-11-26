import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  LogOut,
  Package,
  Plus,
  Printer,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  NavBellIcon,
  NavBoxIcon,
  NavDashboardIcon,
  NavIconProps,
  NavOrdersIcon,
  NavReturnIcon,
  NavSettingsIcon,
  NavStorefrontIcon,
  NavTruckIcon,
  WhatsAppIcon,
} from './NavIcons';
import { api, readImageFilesAsDataUrls, SellerOverviewResponse } from '../api';
import {
  JadwalAntar,
  Kategori,
  Notifikasi,
  PengaturanToko,
  Pesanan,
  Produk,
  ProdukFoto,
  ProdukVarian,
  Retur,
  StatusPesanan,
  StatusRetur,
} from '../types';
import {
  ALASAN_RETUR_LABELS,
  buildWhatsAppUrl,
  calculateDistanceShipping,
  formatRupiah,
  formatTanggal,
  formatTanggalWaktu,
  getProductEffectiveStock,
  HARI_NAMES,
  isProductLowStock,
} from '../utils/format';
import {
  AddressMapPicker,
  DeliveryRoutePreviewMap,
  SellerDeliveryOverviewMap,
} from './GoogleMapsWidgets';
import {
  APP_UI,
  ConfirmModal,
  NotaPrintView,
  OrderStatusLabel,
  PageHeader,
  ProductImage,
  ReturnStatusLabel,
} from './SharedUI';

export type SellerTab =
  | 'ringkasan'
  | 'produk'
  | 'pesanan'
  | 'pengantaran'
  | 'retur'
  | 'pengaturan'
  | 'notifikasi';

type ProductSubView = 'list' | 'form' | 'detail';
type SettingsSubTab = 'profil' | 'ongkir' | 'jadwal' | 'kategori' | 'aturan' | 'akun';

interface SellerDashboardProps {
  sellerEmail: string;
  data: SellerOverviewResponse;
  mapsAvailable: boolean;
  forceCompleteProfile: boolean;
  onProfileCompleted: () => void;
  onRefreshSeller: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
  onLogoutSeller: () => void;
  onSwitchToBuyer: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function SellerDashboard(props: SellerDashboardProps) {
  const {
    sellerEmail,
    data,
    mapsAvailable,
    forceCompleteProfile,
    onProfileCompleted,
    onRefreshSeller,
    onRefreshPublic,
    onLogoutSeller,
    onSwitchToBuyer,
    showToast,
  } = props;

  const {
    toko,
    tarif_ongkir,
    jadwal_antar,
    kategori,
    produk,
    pesanan,
    retur,
    ulasan,
    notifikasi,
    pengaturan,
  } = data;

  const [activeTab, setActiveTab] = useState<SellerTab>(
    forceCompleteProfile ? 'pengaturan' : 'ringkasan'
  );

  // Produk states
  const [prodSubView, setProdSubView] = useState<ProductSubView>('list');
  const [prodSearch, setProdSearch] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('all');
  const [prodStatusFilter, setProdStatusFilter] = useState<'all' | 'aktif' | 'nonaktif' | 'stok_menipis'>('all');
  const [selectedProdId, setSelectedProdId] = useState<string | null>(null);
  const [deleteProdTarget, setDeleteProdTarget] = useState<Produk | null>(null);

  // Product Form states
  const [editingProduct, setEditingProduct] = useState<Produk | null>(null);
  const [prodFormError, setProdFormError] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState<{
    nama: string;
    kategori_id: string;
    deskripsi: string;
    harga: string;
    stok: string;
    stok_minimum: string;
    aktif: boolean;
    varian: ProdukVarian[];
    foto: ProdukFoto[];
  }>({
    nama: '',
    kategori_id: kategori[0]?.id || '',
    deskripsi: '',
    harga: '',
    stok: '10',
    stok_minimum: '3',
    aktif: true,
    varian: [],
    foto: [],
  });
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState('');

  // Pesanan states
  const [orderTabFilter, setOrderTabFilter] = useState<'Semua' | StatusPesanan>('Semua');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Pesanan | null>(null);

  // Order Action Modals
  const [orderReasonModal, setOrderReasonModal] = useState<{
    type: 'reject' | 'cancel' | 'fail';
    orderId: string;
    nomor: string;
  } | null>(null);

  // Pengantaran states
  const [deliveryDateFilter, setDeliveryDateFilter] = useState('all');

  // Retur states
  const [returFilter, setReturFilter] = useState<'Semua' | StatusRetur>('Semua');
  const [selectedReturId, setSelectedReturId] = useState<string | null>(null);
  const [rejectReturTarget, setRejectReturTarget] = useState<Retur | null>(null);

  // Pengaturan states
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('profil');
  const [storeForm, setStoreForm] = useState({
    nama_toko: toko.nama_toko,
    logo_url: toko.logo_url,
    deskripsi: toko.deskripsi,
    alamat_kios: toko.alamat_kios,
    no_whatsapp: toko.no_whatsapp,
    lat: toko.lat,
    lng: toko.lng,
  });
  const [storeFormError, setStoreFormError] = useState<string | null>(null);

  // Distance Shipping & Kiosk Pin form
  const [shippingForm, setShippingForm] = useState({
    tarif_dasar: String(tarif_ongkir.tarif_dasar),
    tarif_per_km: String(tarif_ongkir.tarif_per_km),
    batas_radius_km: String(tarif_ongkir.batas_radius_km),
    minimal_belanja_gratis_ongkir: tarif_ongkir.minimal_belanja_gratis_ongkir
      ? String(tarif_ongkir.minimal_belanja_gratis_ongkir)
      : '',
    alamat_kios: toko.alamat_kios,
    nama_wilayah: '',
    lat: toko.lat,
    lng: toko.lng,
  });
  const [shippingFormError, setShippingFormError] = useState<string | null>(null);

  // Schedule form
  const [scheduleDraft, setScheduleDraft] = useState<JadwalAntar[]>(jadwal_antar);

  // Category form
  const [catNameInput, setCatNameInput] = useState('');
  const [catOrderInput, setCatOrderInput] = useState('1');
  const [editingCat, setEditingCat] = useState<Kategori | null>(null);

  // Rules form
  const [rulesForm, setRulesForm] = useState<PengaturanToko>(pengaturan);

  const unreadNotifCount = notifikasi.filter((n) => !n.sudah_dibaca).length;

  // Summary metrics
  const metrics = useMemo(() => {
    const pesananBaru = pesanan.filter((o) => o.status === 'Baru').length;
    const siapDiantar = pesanan.filter((o) => o.status === 'Siap Diantar').length;
    const stokMenipis = produk.filter((p) => isProductLowStock(p)).length;
    const returMenunggu = retur.filter((r) => r.status === 'Menunggu').length;
    return { pesananBaru, siapDiantar, stokMenipis, returMenunggu };
  }, [pesanan, produk, retur]);

  const refreshAll = async () => {
    await Promise.all([onRefreshSeller(), onRefreshPublic()]);
  };

  if (printingOrder) {
    return (
      <NotaPrintView
        order={printingOrder}
        toko={toko}
        onBack={() => setPrintingOrder(null)}
      />
    );
  }

  // Open Product Form
  const openProductForm = (p: Produk | null) => {
    setEditingProduct(p);
    setProdFormError(null);
    setNewPhotoUrlInput('');
    if (p) {
      setProdForm({
        nama: p.nama,
        kategori_id: p.kategori_id,
        deskripsi: p.deskripsi,
        harga: String(p.harga),
        stok: p.stok !== null ? String(p.stok) : '0',
        stok_minimum: p.stok_minimum !== null ? String(p.stok_minimum) : '3',
        aktif: p.aktif,
        varian: [...p.varian],
        foto: [...p.foto].sort((a, b) => a.urutan - b.urutan),
      });
    } else {
      setProdForm({
        nama: '',
        kategori_id: kategori[0]?.id || '',
        deskripsi: '',
        harga: '',
        stok: '10',
        stok_minimum: '3',
        aktif: true,
        varian: [],
        foto: [],
      });
    }
    setProdSubView('form');
  };

  // Notification Click Router (No 28-30, 96-98)
  const handleNotifClick = async (n: Notifikasi) => {
    if (!n.sudah_dibaca) {
      await api.markNotificationRead(n.id);
      await onRefreshSeller();
    }
    if (n.tujuan_tipe === 'pesanan' && n.tujuan_id) {
      setSelectedOrderId(n.tujuan_id);
      setActiveTab('pesanan');
    } else if (n.tujuan_tipe === 'retur' && n.tujuan_id) {
      setSelectedReturId(n.tujuan_id);
      setActiveTab('retur');
    } else if (n.tujuan_tipe === 'produk') {
      if (n.jenis === 'stok_menipis') {
        setProdStatusFilter('stok_menipis');
        setProdSubView('list');
        setActiveTab('produk');
      } else if (n.tujuan_id) {
        setSelectedProdId(n.tujuan_id);
        setProdSubView('detail');
        setActiveTab('produk');
      }
    }
  };

  // =============================================
  // RENDER: RINGKASAN
  // =============================================
  const renderRingkasan = () => (
    <div className={APP_UI.sellerSection}>
      <PageHeader
        title="Ringkasan Operasional"
        subtitle="Pantau pesanan masuk, kesiapan antar, stok kios, dan retur dalam satu layar."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            setOrderTabFilter('Baru');
            setSelectedOrderId(null);
            setActiveTab('pesanan');
          }}
          className={`text-left ${APP_UI.card} hover:border-teal-700 transition-colors`}
        >
          <div className="text-xs font-medium text-zinc-500">Pesanan Baru</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 mt-1.5 tabular-nums">
            {metrics.pesananBaru}
          </div>
          <div className="text-xs text-amber-700 font-medium mt-2">Perlu konfirmasi →</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pengantaran')}
          className={`text-left ${APP_UI.card} hover:border-teal-700 transition-colors`}
        >
          <div className="text-xs font-medium text-zinc-500">Siap Diantar</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 mt-1.5 tabular-nums">
            {metrics.siapDiantar}
          </div>
          <div className="text-xs text-teal-800 font-medium mt-2">Buka pengantaran →</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setProdStatusFilter('stok_menipis');
            setProdSubView('list');
            setActiveTab('produk');
          }}
          className={`text-left ${APP_UI.card} hover:border-teal-700 transition-colors`}
        >
          <div className="text-xs font-medium text-zinc-500">Stok Menipis</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 mt-1.5 tabular-nums">
            {metrics.stokMenipis}
          </div>
          <div className="text-xs text-rose-700 font-medium mt-2">Periksa stok →</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReturFilter('Menunggu');
            setSelectedReturId(null);
            setActiveTab('retur');
          }}
          className={`text-left ${APP_UI.card} hover:border-teal-700 transition-colors`}
        >
          <div className="text-xs font-medium text-zinc-500">Retur Menunggu</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 mt-1.5 tabular-nums">
            {metrics.returMenunggu}
          </div>
          <div className="text-xs text-amber-700 font-medium mt-2">Tinjau pengajuan →</div>
        </button>
      </div>

      {/* Recent Orders Quick Table + Mobile List */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-900">Pesanan Terbaru</h2>
          <button
            type="button"
            onClick={() => {
              setOrderTabFilter('Semua');
              setSelectedOrderId(null);
              setActiveTab('pesanan');
            }}
            className="text-xs font-semibold text-teal-800 hover:text-teal-950"
          >
            Semua Pesanan →
          </button>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-zinc-200 text-xs text-zinc-500 text-left">
                <th className="px-5 py-3 font-medium">No. Pesanan</th>
                <th className="px-5 py-3 font-medium">Pembeli</th>
                <th className="px-5 py-3 font-medium">Wilayah &amp; Jadwal</th>
                <th className="px-5 py-3 font-medium text-right">Total COD</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pesanan.slice(0, 6).map((ord) => (
                <tr
                  key={ord.id}
                  onClick={() => {
                    setSelectedOrderId(ord.id);
                    setActiveTab('pesanan');
                  }}
                  className="hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3 font-mono font-semibold text-zinc-900">
                    {ord.nomor_pesanan}
                  </td>
                  <td className="px-5 py-3 text-zinc-700">
                    {ord.nama_penerima} · <span className="text-xs text-zinc-500">{ord.items.length} item</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-600">
                    {ord.nama_wilayah} · {ord.tanggal_antar} · {ord.jam_antar}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">
                    {formatRupiah(ord.total_cod)}
                  </td>
                  <td className="px-5 py-3">
                    <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="seller" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-zinc-100">
          {pesanan.slice(0, 6).map((ord) => (
            <button
              key={ord.id}
              type="button"
              onClick={() => {
                setSelectedOrderId(ord.id);
                setActiveTab('pesanan');
              }}
              className="w-full text-left p-4 hover:bg-stone-50 transition-colors space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-zinc-900">{ord.nomor_pesanan}</span>
                <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="seller" />
              </div>
              <div className="text-xs font-semibold text-zinc-900">
                {ord.nama_penerima} · {ord.items.length} item
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
                <span>
                  {ord.nama_wilayah} · {ord.tanggal_antar}
                </span>
                <span className="font-bold text-teal-900 tabular-nums">{formatRupiah(ord.total_cod)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // =============================================
  // RENDER: PRODUK (List, Form, Detail)
  // =============================================
  const renderProdukTab = () => {
    if (prodSubView === 'form') {
      const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setProdFormError(null);
        if (!prodForm.nama.trim() || !prodForm.kategori_id || !prodForm.harga || Number(prodForm.harga) <= 0) {
          setProdFormError('Nama produk, kategori, dan harga valid wajib diisi.');
          return;
        }
        try {
          const payload: Partial<Produk> = {
            nama: prodForm.nama.trim(),
            kategori_id: prodForm.kategori_id,
            deskripsi: prodForm.deskripsi.trim(),
            tipe: 'Stok Sendiri',
            harga: Number(prodForm.harga),
            stok: prodForm.varian.length === 0 ? Number(prodForm.stok || 0) : null,
            stok_minimum: Number(prodForm.stok_minimum || 0),
            estimasi_tiba_hari: null,
            link_shopee: null,
            aktif: prodForm.aktif,
            varian: prodForm.varian,
            foto: prodForm.foto,
          };
          if (editingProduct) {
            await api.updateProduct(editingProduct.id, payload);
            showToast('success', 'Perubahan produk disimpan.');
          } else {
            await api.createProduct(payload);
            showToast('success', 'Produk baru ditambahkan ke katalog toko.');
          }
          await refreshAll();
          setProdSubView('list');
        } catch (err: unknown) {
          setProdFormError(err instanceof Error ? err.message : 'Gagal menyimpan produk.');
        }
      };

      const movePhoto = (idx: number, dir: -1 | 1) => {
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= prodForm.foto.length) return;
        const arr = [...prodForm.foto];
        const temp = arr[idx];
        arr[idx] = arr[nextIdx];
        arr[nextIdx] = temp;
        setProdForm({ ...prodForm, foto: arr.map((f, i) => ({ ...f, urutan: i + 1 })) });
      };

      return (
        <div className={APP_UI.sellerFocused}>
          <PageHeader
            title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
            backLabel="Daftar Produk"
            onBack={() => setProdSubView('list')}
          />

          <form onSubmit={handleSaveProduct} className={`${APP_UI.card} space-y-6`}>
            {prodFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {prodFormError}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  value={prodForm.nama}
                  onChange={(e) => setProdForm({ ...prodForm, nama: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Kategori *</label>
                <select
                  value={prodForm.kategori_id}
                  onChange={(e) => setProdForm({ ...prodForm, kategori_id: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
                >
                  {kategori.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Harga Normal (Rp) *</label>
                <input
                  type="number"
                  value={prodForm.harga}
                  onChange={(e) => setProdForm({ ...prodForm, harga: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>

              {prodForm.varian.length === 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Jumlah Stok *</label>
                  <input
                    type="number"
                    value={prodForm.stok}
                    onChange={(e) => setProdForm({ ...prodForm, stok: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Batas Minimum Stok (Pemicu Notifikasi)
                </label>
                <input
                  type="number"
                  value={prodForm.stok_minimum}
                  onChange={(e) => setProdForm({ ...prodForm, stok_minimum: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Deskripsi Produk</label>
                <textarea
                  rows={3}
                  value={prodForm.deskripsi}
                  onChange={(e) => setProdForm({ ...prodForm, deskripsi: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Bagian Varian (No 110) */}
            <div className="border-t border-zinc-200 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Varian Produk (Opsional)</h3>
                  <p className="text-xs text-zinc-500">
                    Jika produk memiliki varian, stok per varian diatur di sini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setProdForm({
                      ...prodForm,
                      varian: [
                        ...prodForm.varian,
                        {
                          id: `var-tmp-${Date.now()}`,
                          produk_id: editingProduct?.id || '',
                          nama_varian: '',
                          harga: null,
                          stok: 5,
                          aktif: true,
                        },
                      ],
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded-lg"
                >
                  + Tambah Varian
                </button>
              </div>

              {prodForm.varian.map((v, idx) => (
                <div key={v.id} className="grid sm:grid-cols-12 gap-2 items-center p-3 bg-stone-50 rounded-lg border border-zinc-200">
                  <input
                    type="text"
                    value={v.nama_varian}
                    onChange={(e) => {
                      const next = [...prodForm.varian];
                      next[idx] = { ...v, nama_varian: e.target.value };
                      setProdForm({ ...prodForm, varian: next });
                    }}
                    placeholder="Nama varian"
                    className="sm:col-span-4 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    value={v.harga ?? ''}
                    onChange={(e) => {
                      const next = [...prodForm.varian];
                      next[idx] = { ...v, harga: e.target.value ? Number(e.target.value) : null };
                      setProdForm({ ...prodForm, varian: next });
                    }}
                    placeholder="Harga khusus (opsional)"
                    className="sm:col-span-3 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                  />
                  <input
                    type="number"
                    value={v.stok ?? 0}
                    onChange={(e) => {
                      const next = [...prodForm.varian];
                      next[idx] = { ...v, stok: Number(e.target.value) };
                      setProdForm({ ...prodForm, varian: next });
                    }}
                    placeholder="Stok"
                    className="sm:col-span-2 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                  />
                  <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={v.aktif}
                      onChange={(e) => {
                        const next = [...prodForm.varian];
                        next[idx] = { ...v, aktif: e.target.checked };
                        setProdForm({ ...prodForm, varian: next });
                      }}
                    />
                    Aktif
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setProdForm({
                        ...prodForm,
                        varian: prodForm.varian.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 text-rose-700 hover:text-rose-900 p-1"
                    aria-label="Hapus varian"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Bagian Foto (No 111) */}
            <div className="border-t border-zinc-200 pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Foto Produk</h3>
                  <p className="text-xs text-zinc-500">
                    Urutan 1 menjadi foto utama produk. Maks {pengaturan.ukuran_maks_foto_mb} MB per foto.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Unggah Foto
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const res = await readImageFilesAsDataUrls(
                        e.target.files,
                        pengaturan.ukuran_maks_foto_mb,
                        10,
                        prodForm.foto.length
                      );
                      if (res.error) setProdFormError(res.error);
                      if (res.urls.length > 0) {
                        setProdForm({
                          ...prodForm,
                          foto: [
                            ...prodForm.foto,
                            ...res.urls.map((url, i) => ({
                              id: `ft-tmp-${Date.now()}-${i}`,
                              produk_id: editingProduct?.id || '',
                              url,
                              urutan: prodForm.foto.length + i + 1,
                            })),
                          ],
                        });
                      }
                    }}
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhotoUrlInput}
                  onChange={(e) => setNewPhotoUrlInput(e.target.value)}
                  placeholder="Atau tempel URL foto (/src/assets/images/...)"
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newPhotoUrlInput.trim()) return;
                    setProdForm({
                      ...prodForm,
                      foto: [
                        ...prodForm.foto,
                        {
                          id: `ft-tmp-${Date.now()}`,
                          produk_id: editingProduct?.id || '',
                          url: newPhotoUrlInput.trim(),
                          urutan: prodForm.foto.length + 1,
                        },
                      ],
                    });
                    setNewPhotoUrlInput('');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded-lg"
                >
                  Tambah URL
                </button>
              </div>

              {prodForm.foto.length > 0 && (
                <div className="space-y-2">
                  {prodForm.foto.map((ft, idx) => (
                    <div
                      key={ft.id}
                      className="flex items-center justify-between gap-3 p-2.5 border border-zinc-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-semibold text-zinc-500 w-6">
                          #{idx + 1}
                        </span>
                        <img
                          src={ft.url}
                          alt={`Foto ${idx + 1}`}
                          className="w-12 h-12 object-cover rounded border"
                        />
                        <span className="text-xs text-zinc-600">
                          {idx === 0 ? 'Foto Utama' : 'Foto Galeri'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePhoto(idx, -1)}
                          className="p-1.5 text-zinc-600 hover:bg-stone-100 rounded disabled:opacity-30"
                          aria-label="Naikkan urutan"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === prodForm.foto.length - 1}
                          onClick={() => movePhoto(idx, 1)}
                          className="p-1.5 text-zinc-600 hover:bg-stone-100 rounded disabled:opacity-30"
                          aria-label="Turunkan urutan"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setProdForm({
                              ...prodForm,
                              foto: prodForm.foto
                                .filter((_, i) => i !== idx)
                                .map((item, i) => ({ ...item, urutan: i + 1 })),
                            })
                          }
                          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded"
                          aria-label="Hapus foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setProdSubView('list')}
                className="px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-700 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
              >
                Simpan Produk
              </button>
            </div>
          </form>
        </div>
      );
    }

    if (prodSubView === 'detail' && selectedProdId) {
      const prod = produk.find((p) => p.id === selectedProdId);
      if (!prod) return null;
      const prodReviews = ulasan.filter((u) => u.produk_id === prod.id);
      const totalStock = getProductEffectiveStock(prod, null);
      return (
        <div className={APP_UI.sellerFocused}>
          <PageHeader
            title={prod.nama}
            subtitle={`${kategori.find((k) => k.id === prod.kategori_id)?.nama || 'Umum'} · ${prod.tipe} · ${prod.aktif ? 'Aktif' : 'Nonaktif'}`}
            backLabel="Daftar Produk"
            onBack={() => setProdSubView('list')}
            rightSlot={
              <button
                type="button"
                onClick={() => openProductForm(prod)}
                className={APP_UI.btnPrimary}
              >
                Edit Produk
              </button>
            }
          />

          <div className={`${APP_UI.card} space-y-5`}>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-44 h-36 rounded-xl overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                <ProductImage
                  src={[...prod.foto].sort((a, b) => a.urutan - b.urutan)[0]?.url}
                  alt={prod.nama}
                  className="w-full h-full"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-zinc-500">
                  {kategori.find((k) => k.id === prod.kategori_id)?.nama} · {prod.tipe} ·{' '}
                  {prod.aktif ? 'Aktif' : 'Nonaktif'}
                </div>
                <h1 className="text-xl font-display font-bold text-zinc-900">{prod.nama}</h1>
                <div className="text-lg font-bold text-zinc-900 tabular-nums">
                  {formatRupiah(prod.harga)}
                </div>
                <div className="text-xs text-zinc-600">
                  Total Stok: {totalStock} (Min. {prod.stok_minimum ?? 0}) · Terjual {prod.jumlah_terjual}
                </div>
                <p className="text-sm text-zinc-700 pt-1">{prod.deskripsi}</p>
              </div>
            </div>

            {prod.varian.length > 0 && (
              <div className="border-t border-zinc-200 pt-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Daftar Varian</h3>
                <div className="grid sm:grid-cols-3 gap-2">
                  {prod.varian.map((v) => (
                    <div key={v.id} className="p-3 rounded-lg border border-zinc-200 text-xs">
                      <div className="font-semibold text-zinc-900">{v.nama_varian}</div>
                      <div className="text-zinc-600 tabular-nums mt-0.5">
                        {formatRupiah(v.harga ?? prod.harga)} · Stok {v.stok ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-zinc-200 pt-4">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">
                Ulasan Pembeli ({prodReviews.length})
              </h3>
              {prodReviews.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada ulasan untuk produk ini.</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {prodReviews.map((rev) => (
                    <div key={rev.id} className="py-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-zinc-900">{rev.nama_pembeli}</span>
                        <span className="text-zinc-400">{formatTanggal(rev.dibuat_pada)}</span>
                      </div>
                      <div className="flex items-center gap-0.5 my-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-zinc-700">{rev.komentar}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Product List
    const filteredProducts = produk.filter((p) => {
      if (prodSearch.trim() && !p.nama.toLowerCase().includes(prodSearch.trim().toLowerCase())) {
        return false;
      }
      if (prodCatFilter !== 'all' && p.kategori_id !== prodCatFilter) return false;
      if (prodStatusFilter === 'aktif' && !p.aktif) return false;
      if (prodStatusFilter === 'nonaktif' && p.aktif) return false;
      if (prodStatusFilter === 'stok_menipis' && !isProductLowStock(p)) return false;
      return true;
    });

    return (
      <div className={APP_UI.sellerSection}>
        <PageHeader
          title="Daftar Produk"
          subtitle={<span className="tabular-nums">{filteredProducts.length} produk ditampilkan</span>}
          rightSlot={
            <button
              type="button"
              onClick={() => openProductForm(null)}
              className={APP_UI.btnPrimary}
            >
              <Plus className="w-4 h-4" />
              Tambah Produk
            </button>
          }
        />

        <div className={`${APP_UI.card} grid sm:grid-cols-3 gap-3`}>
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded-lg"
            />
          </div>
          <select
            value={prodCatFilter}
            onChange={(e) => setProdCatFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="all">Semua Kategori</option>
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
          <select
            value={prodStatusFilter}
            onChange={(e) => setProdStatusFilter(e.target.value as typeof prodStatusFilter)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
            <option value="stok_menipis">Stok Menipis</option>
          </select>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-zinc-200 text-xs text-zinc-500 text-left">
                  <th className="px-5 py-3 font-medium">Produk</th>
                  <th className="px-5 py-3 font-medium text-right">Harga</th>
                  <th className="px-5 py-3 font-medium text-right">Stok</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProducts.map((p) => {
                  const totalStock = getProductEffectiveStock(p, null);
                  const low = isProductLowStock(p);
                  const thumb = [...p.foto].sort((a, b) => a.urutan - b.urutan)[0]?.url;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProdId(p.id);
                            setProdSubView('detail');
                          }}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                            <ProductImage src={thumb} alt={p.nama} className="w-full h-full" />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 hover:text-teal-800">
                              {p.nama}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {kategori.find((k) => k.id === p.kategori_id)?.nama}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {formatRupiah(p.harga)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs tabular-nums">
                        <span className={low ? 'text-rose-700 font-semibold' : 'text-zinc-700'}>
                          {totalStock} unit{low ? ' (Menipis)' : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.toggleProductActive(p.id);
                            await refreshAll();
                            showToast('success', `Produk ${p.aktif ? 'dinonaktifkan' : 'diaktifkan'}.`);
                          }}
                          className={`px-2.5 py-1 text-xs font-semibold rounded border ${
                            p.aktif
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : 'border-zinc-300 bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {p.aktif ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => openProductForm(p)}
                          className="text-xs font-semibold text-teal-800 hover:text-teal-950"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteProdTarget(p)}
                          className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ConfirmModal
          open={Boolean(deleteProdTarget)}
          title="Hapus Produk?"
          description={`Produk "${deleteProdTarget?.nama}" akan dihapus dari toko (data riwayat pesanan lama tetap aman).`}
          confirmLabel="Ya, Hapus"
          cancelLabel="Batal"
          danger
          onCancel={() => setDeleteProdTarget(null)}
          onConfirm={async () => {
            if (!deleteProdTarget) return;
            await api.deleteProduct(deleteProdTarget.id);
            await refreshAll();
            showToast('success', 'Produk berhasil dihapus.');
            setDeleteProdTarget(null);
          }}
        />
      </div>
    );
  };

  // =============================================
  // RENDER: PESANAN (List & Detail)
  // =============================================
  const renderOrderDetail = (ord: Pesanan) => {
    const waBuyerUrl = buildWhatsAppUrl(
      ord.no_whatsapp_pembeli || ord.no_telepon_penerima,
      `Halo ${ord.nama_penerima}, terkait pesanan ${ord.nomor_pesanan} di ${toko.nama_toko}...`
    );

    const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
      try {
        await fn();
        await refreshAll();
        showToast('success', successMsg);
      } catch (err: unknown) {
        await refreshAll();
        showToast('error', err instanceof Error ? err.message : 'Aksi gagal.');
      }
    };

    return (
      <div className={APP_UI.sellerSection}>
        <PageHeader
          title={ord.nomor_pesanan}
          subtitle={`Dibuat ${formatTanggalWaktu(ord.dibuat_pada)}`}
          backLabel="Pesanan"
          onBack={() => setSelectedOrderId(null)}
          rightSlot={
            <div className="text-right space-y-0.5">
              <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="seller" />
              <div className="text-xs text-zinc-500">
                Pembayaran: <span className="font-semibold text-zinc-900">{ord.status_pembayaran}</span>
              </div>
            </div>
          }
        />

        {/* Complete 2-Column Order Detail — All Data Directly Visible */}
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Cancellation Callout, Complete Recipient & Schedule, Full Item List */}
          <div className="lg:col-span-7 space-y-4">
            {ord.status === 'Dibatalkan' && ord.alasan_batal && (
              <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800">
                <span className="font-semibold">Dibatalkan ({ord.dibatalkan_oleh}):</span> {ord.alasan_batal}
              </div>
            )}

            <div className={`${APP_UI.card} space-y-3 text-xs sm:text-sm`}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-zinc-500">Pembeli &amp; Alamat Antar</div>
                  <div className="font-semibold text-zinc-900">{ord.nama_penerima}</div>
                  <div className="text-xs font-mono text-zinc-600">{ord.no_telepon_penerima}</div>
                  <div className="text-zinc-700 leading-relaxed pt-0.5">
                    {ord.alamat_lengkap} · {ord.nama_wilayah}
                    {ord.jarak_km ? ` (${ord.jarak_km.toFixed(1)} km)` : ''}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-zinc-500">Jadwal Antar &amp; Catatan</div>
                  <div className="font-semibold text-zinc-900">
                    {ord.tanggal_antar} · {ord.jam_antar}
                  </div>
                  <div className="text-zinc-600 leading-relaxed pt-0.5">
                    Catatan: {ord.catatan_pembeli || 'Tidak ada catatan'}
                  </div>
                </div>
              </div>
              {typeof ord.lat === 'number' && typeof ord.lng === 'number' && (
                <DeliveryRoutePreviewMap
                  mapsAvailable={mapsAvailable}
                  origin={{ lat: toko.lat, lng: toko.lng }}
                  destination={{ lat: ord.lat, lng: ord.lng }}
                  kioskLabel={toko.nama_toko}
                  destinationLabel={ord.nama_penerima}
                  heightClass="h-[165px]"
                />
              )}
            </div>

            <div className={`${APP_UI.card} space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Rincian Item Pesanan</h2>
                <span className="text-xs text-zinc-500 tabular-nums">{ord.items.length} item</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {ord.items.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                          <ProductImage src={item.foto_url} alt={item.nama_produk} className="w-full h-full" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-sm font-semibold text-zinc-900">{item.nama_produk}</div>
                          <div className="text-xs text-zinc-500">
                            {item.nama_varian ? `${item.nama_varian} · ` : ''}
                            {item.jumlah} × {formatRupiah(item.harga_satuan)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 tabular-nums shrink-0">
                        {formatRupiah(item.harga_satuan * item.jumlah)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: COD Summary, Seller Actions & Complete Status History */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`${APP_UI.card} space-y-4`}>
              <h2 className="text-sm font-semibold text-zinc-900">Ringkasan COD &amp; Aksi Penjual</h2>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Status Pembayaran</span>
                  <span className="font-semibold text-zinc-900">{ord.status_pembayaran}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal Produk</span>
                  <span className="tabular-nums">{formatRupiah(ord.subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Ongkir ({ord.jarak_km ? `${ord.jarak_km.toFixed(1)} km` : ord.nama_wilayah})</span>
                  <span className="tabular-nums">
                    {ord.ongkir === 0 ? 'Gratis (Rp0)' : formatRupiah(ord.ongkir)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-zinc-900 pt-2.5 border-t border-zinc-100">
                  <span>Total Tagihan COD</span>
                  <span className="tabular-nums text-teal-900">{formatRupiah(ord.total_cod)}</span>
                </div>
              </div>

              {ord.status !== 'Dibatalkan' && ord.status !== 'Selesai' && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100">
                  {ord.status === 'Baru' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(() => api.confirmOrder(ord.id), 'Pesanan dikonfirmasi & stok diperbarui.')
                        }
                        className={APP_UI.btnPrimary}
                      >
                        Konfirmasi Pesanan
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOrderReasonModal({ type: 'reject', orderId: ord.id, nomor: ord.nomor_pesanan })
                        }
                        className={APP_UI.btnDanger}
                      >
                        Tolak
                      </button>
                    </>
                  )}

                  {ord.status === 'Diproses' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            () => api.markOrderReady(ord.id),
                            'Pesanan ditandai Siap Diantar.'
                          )
                        }
                        className={APP_UI.btnPrimary}
                      >
                        Siap Diantar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOrderReasonModal({ type: 'cancel', orderId: ord.id, nomor: ord.nomor_pesanan })
                        }
                        className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap"
                      >
                        Batalkan
                      </button>
                    </>
                  )}

                  {ord.status === 'Siap Diantar' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(() => api.startDelivery(ord.id), 'Status diubah ke Diantar.')
                        }
                        className={APP_UI.btnPrimary}
                      >
                        Mulai Antar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintingOrder(ord)}
                        className={APP_UI.btnSecondary}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak Nota
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOrderReasonModal({ type: 'cancel', orderId: ord.id, nomor: ord.nomor_pesanan })
                        }
                        className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap"
                      >
                        Batalkan
                      </button>
                    </>
                  )}

                  {ord.status === 'Diantar' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            () => api.completeOrder(ord.id),
                            'Pesanan Selesai & pembayaran COD dicatat Sudah Dibayar.'
                          )
                        }
                        className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
                      >
                        Selesai (COD Diterima)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintingOrder(ord)}
                        className={APP_UI.btnSecondary}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak Nota
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOrderReasonModal({ type: 'fail', orderId: ord.id, nomor: ord.nomor_pesanan })
                        }
                        className={APP_UI.btnDanger}
                      >
                        Gagal Antar
                      </button>
                    </>
                  )}

                  {(['Diproses', 'Siap Diantar', 'Diantar'] as StatusPesanan[]).includes(ord.status) && (
                    <a
                      href={waBuyerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={APP_UI.btnSecondary}
                    >
                      <WhatsAppIcon className="w-4 h-4 shrink-0" />
                      Hubungi Pembeli
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className={`${APP_UI.card} space-y-3`}>
              <h2 className="text-sm font-semibold text-zinc-900">Riwayat Status Pesanan</h2>
              <div className="divide-y divide-zinc-100">
                {[...ord.riwayat].reverse().map((r) => (
                  <div
                    key={r.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-900">{r.status_baru}</span>
                      <span className="text-zinc-500"> · oleh {r.diubah_oleh}</span>
                      {r.alasan && <div className="text-zinc-600 mt-0.5">{r.alasan}</div>}
                    </div>
                    <span className="text-[11px] text-zinc-400 tabular-nums shrink-0">
                      {formatTanggalWaktu(r.waktu)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPesananTab = () => {
    if (selectedOrderId) {
      const ord = pesanan.find((o) => o.id === selectedOrderId);
      if (ord) return renderOrderDetail(ord);
    }

    const tabs: Array<'Semua' | StatusPesanan> = [
      'Semua',
      'Baru',
      'Diproses',
      'Siap Diantar',
      'Diantar',
      'Selesai',
      'Dibatalkan',
    ];

    const filtered = pesanan.filter((o) => {
      if (orderTabFilter !== 'Semua' && o.status !== orderTabFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        if (
          !o.nomor_pesanan.toLowerCase().includes(q) &&
          !o.nama_penerima.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    return (
      <div className={APP_UI.sellerSection}>
        <PageHeader
          title="Daftar Pesanan"
          subtitle={<span className="tabular-nums">{filtered.length} pesanan ditampilkan</span>}
          rightSlot={
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="No. pesanan / pembeli..."
                className="w-full sm:w-56 pl-9 pr-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-lg"
              />
            </div>
          }
        />

        <div className={APP_UI.tabBar}>
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setOrderTabFilter(t)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                orderTabFilter === t
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {/* Desktop Complete Data Table (No Hidden Scroll Traps) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-zinc-200 text-xs text-zinc-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">No. Pesanan &amp; Dibuat</th>
                  <th className="px-5 py-3 font-medium">Pembeli &amp; Kontak</th>
                  <th className="px-5 py-3 font-medium">Rincian Item</th>
                  <th className="px-5 py-3 font-medium">Wilayah &amp; Jadwal</th>
                  <th className="px-5 py-3 font-medium text-right">Total COD &amp; Bayar</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-500">
                      Tidak ada pesanan sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors align-top"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-semibold text-zinc-900">{ord.nomor_pesanan}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                          {formatTanggalWaktu(ord.dibuat_pada)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-zinc-900">{ord.nama_penerima}</div>
                        <div className="text-xs font-mono text-zinc-500 mt-0.5">
                          {ord.no_telepon_penerima}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-700 space-y-0.5">
                        {ord.items.map((item) => (
                          <div key={item.id}>
                            <span className="font-medium text-zinc-900">{item.nama_produk}</span>
                            {item.nama_varian ? ` (${item.nama_varian})` : ''} × {item.jumlah}
                          </div>
                        ))}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-600">
                        <div className="font-medium text-zinc-800">{ord.nama_wilayah}</div>
                        <div className="mt-0.5">
                          {ord.tanggal_antar} · {ord.jam_antar}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="font-semibold text-zinc-900 tabular-nums">
                          {formatRupiah(ord.total_cod)}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">{ord.status_pembayaran}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="seller" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Complete Order Card List (All Key Order Data Visible, No Truncation) */}
          <div className="md:hidden divide-y divide-zinc-200">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                Tidak ada pesanan sesuai filter.
              </div>
            ) : (
              filtered.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => setSelectedOrderId(ord.id)}
                  className="w-full text-left p-4 hover:bg-stone-50 transition-colors space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-100">
                    <div>
                      <span className="font-mono text-xs font-bold text-zinc-900">
                        {ord.nomor_pesanan}
                      </span>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {formatTanggalWaktu(ord.dibuat_pada)}
                      </div>
                    </div>
                    <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="seller" />
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-zinc-900">
                      {ord.nama_penerima} ·{' '}
                      <span className="font-mono font-normal text-zinc-600">
                        {ord.no_telepon_penerima}
                      </span>
                    </div>
                    <div className="text-zinc-600 leading-relaxed">
                      {ord.alamat_lengkap} · {ord.nama_wilayah}
                    </div>
                    <div className="text-zinc-600">
                      Jadwal: <strong className="text-zinc-900">{ord.tanggal_antar} · {ord.jam_antar}</strong>
                    </div>
                  </div>

                  <div className="bg-stone-50 border border-zinc-200/80 rounded-lg p-2.5 space-y-1.5">
                    {ord.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-zinc-800">
                          <span className="font-medium">{item.nama_produk}</span>
                          {item.nama_varian ? ` (${item.nama_varian})` : ''} × {item.jumlah}
                        </span>
                        <span className="font-semibold text-zinc-900 tabular-nums shrink-0">
                          {formatRupiah(item.harga_satuan * item.jumlah)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <span className="text-zinc-500">
                      Pembayaran: <strong className="text-zinc-800">{ord.status_pembayaran}</strong>
                    </span>
                    <span className="font-bold text-sm text-teal-900 tabular-nums">
                      Total COD {formatRupiah(ord.total_cod)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // =============================================
  // RENDER: PENGANTARAN (No 74-75)
  // =============================================
  const renderPengantaranTab = () => {
    const deliveryOrders = pesanan.filter(
      (o) => o.status === 'Siap Diantar' || o.status === 'Diantar'
    );
    const uniqueDates = Array.from(new Set(deliveryOrders.map((o) => o.tanggal_antar)));
    const filtered = deliveryOrders.filter((o) => {
      if (deliveryDateFilter !== 'all' && o.tanggal_antar !== deliveryDateFilter) return false;
      return true;
    });

    return (
      <div className={APP_UI.sellerSection}>
        <PageHeader
          title="Daftar Pengantaran"
          subtitle="Pesanan Siap Diantar dan Sedang Diantar oleh kurir beserta titik lokasi Google Maps."
          rightSlot={
            <select
              value={deliveryDateFilter}
              onChange={(e) => setDeliveryDateFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium min-h-[40px]"
            >
              <option value="all">Semua Jadwal</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          }
        />

        <SellerDeliveryOverviewMap
          mapsAvailable={mapsAvailable}
          kioskLocation={{ lat: toko.lat, lng: toko.lng }}
          kioskName={toko.nama_toko}
          orders={filtered}
          onSelectOrder={(orderId) => {
            setSelectedOrderId(orderId);
            setActiveTab('pesanan');
          }}
        />

        {filtered.length === 0 ? (
          <div className={`${APP_UI.card} py-12 text-center text-sm text-zinc-500`}>
            Tidak ada pesanan siap diantar atau sedang diantar saat ini.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => {
                  setSelectedOrderId(ord.id);
                  setActiveTab('pesanan');
                }}
                className={`w-full text-left ${APP_UI.card} hover:border-teal-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-zinc-900">
                      {ord.nomor_pesanan}
                    </span>
                    <OrderStatusLabel status={ord.status} perspective="seller" />
                  </div>
                  <div className="text-sm font-semibold text-zinc-800">
                    {ord.nama_penerima} · <span className="font-mono text-xs">{ord.no_telepon_penerima}</span>
                  </div>
                  <div className="text-xs text-zinc-600">
                    {ord.alamat_lengkap} · {ord.nama_wilayah}
                    {ord.jarak_km ? ` (${ord.jarak_km.toFixed(1)} km)` : ''}
                  </div>
                </div>
                <div className="sm:text-right shrink-0">
                  <div className="text-xs text-zinc-500">
                    {ord.tanggal_antar} · {ord.jam_antar}
                  </div>
                  <div className="text-base font-bold text-teal-900 tabular-nums mt-1">
                    COD {formatRupiah(ord.total_cod)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // RENDER: RETUR & KOMPLAIN (No 76-81, 102-103)
  // =============================================
  const renderReturTab = () => {
    if (selectedReturId) {
      const ret = retur.find((r) => r.id === selectedReturId);
      if (ret) {
        const waBuyerUrl = buildWhatsAppUrl(
          ret.no_whatsapp_pembeli || '',
          `Halo ${ret.nama_pembeli || ''}, terkait pengajuan retur pesanan ${ret.nomor_pesanan || ''}.`
        );
        return (
          <div className={APP_UI.sellerFocused}>
            <PageHeader
              title={`Retur ${ret.nomor_pesanan}`}
              subtitle={`Pembeli: ${ret.nama_pembeli} · Diajukan ${formatTanggalWaktu(ret.diajukan_pada)}`}
              backLabel="Daftar Retur"
              onBack={() => setSelectedReturId(null)}
              rightSlot={<ReturnStatusLabel status={ret.status} />}
            />

            <div className={`${APP_UI.card} space-y-5`}>
              <div className="text-sm space-y-2">
                <div>
                  <span className="text-zinc-500">Alasan Retur: </span>
                  <span className="font-semibold text-zinc-900">
                    {ALASAN_RETUR_LABELS[ret.alasan]}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Keterangan: </span>
                  <span className="text-zinc-800">{ret.keterangan || '-'}</span>
                </div>
                {ret.alasan_penolakan && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    Alasan Penolakan: {ret.alasan_penolakan}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-500 mb-2">Foto Bukti Pembeli</div>
                <div className="flex flex-wrap gap-3">
                  {ret.bukti.map((b) => (
                    <img
                      key={b.id}
                      src={b.url}
                      alt="Bukti retur"
                      className="w-24 h-24 object-cover rounded-lg border border-zinc-200"
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2 border-t border-zinc-100">
                {ret.no_whatsapp_pembeli && (
                  <a
                    href={waBuyerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={APP_UI.btnSecondary}
                  >
                    <WhatsAppIcon className="w-4 h-4 shrink-0" />
                    Hubungi Pembeli
                  </a>
                )}

                {ret.status === 'Menunggu' && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.approveReturn(ret.id);
                        await refreshAll();
                        showToast('success', 'Retur disetujui.');
                      }}
                      className={APP_UI.btnPrimary}
                    >
                      Setujui Retur
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectReturTarget(ret)}
                      className={APP_UI.btnDanger}
                    >
                      Tolak Retur
                    </button>
                  </>
                )}

                {ret.status === 'Disetujui' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.completeReturn(ret.id);
                      await refreshAll();
                      showToast('success', 'Retur ditandai Selesai.');
                    }}
                    className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    Tandai Retur Selesai
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }
    }

    const tabs: Array<'Semua' | StatusRetur> = [
      'Semua',
      'Menunggu',
      'Disetujui',
      'Ditolak',
      'Dibatalkan',
      'Selesai',
    ];
    const filtered = retur.filter((r) => returFilter === 'Semua' || r.status === returFilter);

    return (
      <div className={APP_UI.sellerSection}>
        <PageHeader
          title="Retur & Komplain"
          subtitle={<span className="tabular-nums">{filtered.length} pengajuan retur</span>}
        />

        <div className={APP_UI.tabBar}>
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setReturFilter(t)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                returFilter === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={`${APP_UI.card} py-12 text-center text-sm text-zinc-500`}>
            Tidak ada pengajuan retur pada status ini.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ret) => (
              <button
                key={ret.id}
                type="button"
                onClick={() => setSelectedReturId(ret.id)}
                className={`w-full text-left ${APP_UI.card} hover:border-teal-700 flex items-center justify-between gap-4 transition-colors`}
              >
                <div>
                  <div className="font-mono text-sm font-bold text-zinc-900">
                    {ret.nomor_pesanan}
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">
                    {ret.nama_pembeli} · {ALASAN_RETUR_LABELS[ret.alasan]}
                  </div>
                </div>
                <ReturnStatusLabel status={ret.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // RENDER: PENGATURAN TOKO (No 82-95, 105-109, 112-113, 124)
  // =============================================
  const renderPengaturanTab = () => {
    const subMenus: Array<{ id: SettingsSubTab; label: string }> = [
      { id: 'profil', label: 'Profil Toko' },
      { id: 'ongkir', label: 'Lokasi Kios & Ongkir' },
      { id: 'jadwal', label: 'Jadwal Antar' },
      { id: 'kategori', label: 'Kategori' },
      { id: 'aturan', label: 'Aturan Toko' },
      { id: 'akun', label: 'Akun & Keamanan' },
    ];

    return (
      <div className={APP_UI.sellerSection}>
        <PageHeader
          title={forceCompleteProfile ? 'Lengkapi Profil Toko' : 'Pengaturan Toko'}
          subtitle={
            forceCompleteProfile ? (
              <span className="text-amber-800">
                Lengkapi nama toko, alamat kios, dan nomor WhatsApp sebelum membuka halaman dashboard lainnya.
              </span>
            ) : (
              'Kelola identitas toko, titik lokasi Google Maps kios, tarif ongkos kirim per km, jadwal antar, dan aturan.'
            )
          }
        />

        {!forceCompleteProfile && (
          <div className={APP_UI.tabBar}>
            {subMenus.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSettingsSubTab(m.id)}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  settingsSubTab === m.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {(settingsSubTab === 'profil' || forceCompleteProfile) && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setStoreFormError(null);
              try {
                await api.updateStoreProfile(storeForm);
                await refreshAll();
                showToast('success', 'Profil toko disimpan.');
                if (forceCompleteProfile) {
                  onProfileCompleted();
                  setActiveTab('ringkasan');
                }
              } catch (err: unknown) {
                setStoreFormError(err instanceof Error ? err.message : 'Gagal menyimpan profil toko.');
              }
            }}
            className="max-w-2xl bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
          >
            {storeFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {storeFormError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nama Toko *</label>
              <input
                type="text"
                value={storeForm.nama_toko}
                onChange={(e) => setStoreForm({ ...storeForm, nama_toko: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Nomor WhatsApp Toko (Format 628xxx) *
              </label>
              <input
                type="tel"
                value={storeForm.no_whatsapp}
                onChange={(e) => setStoreForm({ ...storeForm, no_whatsapp: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Dipakai tombol Hubungi Penjual di halaman pesanan dan retur pembeli.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Alamat Kios *</label>
              <textarea
                rows={2}
                value={storeForm.alamat_kios}
                onChange={(e) => setStoreForm({ ...storeForm, alamat_kios: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Deskripsi Toko</label>
              <textarea
                rows={3}
                value={storeForm.deskripsi}
                onChange={(e) => setStoreForm({ ...storeForm, deskripsi: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">URL Foto / Banner Toko</label>
              <input
                type="text"
                value={storeForm.logo_url}
                onChange={(e) => setStoreForm({ ...storeForm, logo_url: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
              >
                Simpan Profil Toko
              </button>
            </div>
          </form>
        )}

        {!forceCompleteProfile && settingsSubTab === 'ongkir' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setShippingFormError(null);
              try {
                const payload = {
                  tarif_dasar: Number(shippingForm.tarif_dasar),
                  tarif_per_km: Number(shippingForm.tarif_per_km),
                  batas_radius_km: Number(shippingForm.batas_radius_km),
                  minimal_belanja_gratis_ongkir: shippingForm.minimal_belanja_gratis_ongkir
                    ? Number(shippingForm.minimal_belanja_gratis_ongkir)
                    : null,
                  alamat_kios: shippingForm.alamat_kios,
                  lat: shippingForm.lat,
                  lng: shippingForm.lng,
                };
                await api.updateShippingConfig(payload);
                setStoreForm((prev) => ({
                  ...prev,
                  alamat_kios: shippingForm.alamat_kios,
                  lat: shippingForm.lat,
                  lng: shippingForm.lng,
                }));
                await refreshAll();
                showToast('success', 'Pin lokasi kios dan tarif ongkir jarak disimpan.');
              } catch (err: unknown) {
                setShippingFormError(
                  err instanceof Error ? err.message : 'Gagal menyimpan pengaturan ongkir.'
                );
              }
            }}
            className="grid lg:grid-cols-12 gap-5 items-start"
          >
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Titik Asal Kios di Google Maps
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ongkos kirim pembeli dihitung otomatis dari jarak rute pin alamat pembeli ke pin kios ini.
                </p>
              </div>
              <AddressMapPicker
                mode="seller"
                mapsAvailable={mapsAvailable}
                kioskLocation={{
                  lat: shippingForm.lat,
                  lng: shippingForm.lng,
                  alamat_kios: shippingForm.alamat_kios,
                }}
                kioskName={toko.nama_toko}
                value={{
                  alamat_lengkap: shippingForm.alamat_kios,
                  nama_wilayah: shippingForm.nama_wilayah,
                  lat: shippingForm.lat,
                  lng: shippingForm.lng,
                  jarak_km: 0,
                }}
                onChange={(next) =>
                  setShippingForm((prev) => ({
                    ...prev,
                    alamat_kios: next.alamat_lengkap,
                    nama_wilayah: next.nama_wilayah,
                    lat: next.lat ?? prev.lat,
                    lng: next.lng ?? prev.lng,
                  }))
                }
              />
            </div>

            <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Rumus Tarif Ongkir per Kilometer</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Perubahan tarif dan radius langsung berlaku untuk checkout berikutnya.
                </p>
              </div>

              {shippingFormError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {shippingFormError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Tarif Dasar (Rp) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={shippingForm.tarif_dasar}
                    onChange={(e) =>
                      setShippingForm({ ...shippingForm, tarif_dasar: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Tarif per Kilometer (Rp/km) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={shippingForm.tarif_per_km}
                    onChange={(e) =>
                      setShippingForm({ ...shippingForm, tarif_per_km: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Batas Radius Pengantaran (km) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    value={shippingForm.batas_radius_km}
                    onChange={(e) =>
                      setShippingForm({ ...shippingForm, batas_radius_km: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Minimal Belanja Gratis Ongkir (Rp, kosongkan jika tidak ada)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={shippingForm.minimal_belanja_gratis_ongkir}
                    onChange={(e) =>
                      setShippingForm({
                        ...shippingForm,
                        minimal_belanja_gratis_ongkir: e.target.value,
                      })
                    }
                    placeholder="Contoh: 150000"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              {/* Live distance shipping preview */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-zinc-200 space-y-2 text-xs">
                <div className="font-semibold text-zinc-800">Simulasi Ongkos Kirim</div>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 3, 5, 10].map((km) => {
                    const sim = calculateDistanceShipping(50000, km, {
                      tarif_dasar: Math.max(0, Number(shippingForm.tarif_dasar) || 0),
                      tarif_per_km: Math.max(0, Number(shippingForm.tarif_per_km) || 0),
                      batas_radius_km: Math.max(1, Number(shippingForm.batas_radius_km) || 1),
                      minimal_belanja_gratis_ongkir: shippingForm.minimal_belanja_gratis_ongkir
                        ? Number(shippingForm.minimal_belanja_gratis_ongkir)
                        : null,
                    });
                    return (
                      <div key={km} className="flex justify-between text-zinc-600">
                        <span>Jarak {km} km:</span>
                        <span className="font-semibold text-zinc-900 tabular-nums">
                          {formatRupiah(sim)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-5 py-2.5 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
              >
                Simpan Lokasi Kios &amp; Tarif Ongkir
              </button>
            </div>
          </form>
        )}

        {!forceCompleteProfile && settingsSubTab === 'jadwal' && (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500 text-left">
                    <th className="py-2 font-medium">Hari</th>
                    <th className="py-2 font-medium">Aktif</th>
                    <th className="py-2 font-medium">Jam Mulai</th>
                    <th className="py-2 font-medium">Jam Selesai</th>
                    <th className="py-2 font-medium">Jam Batas Pesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {scheduleDraft.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="py-2.5 font-semibold text-zinc-900">{HARI_NAMES[s.hari]}</td>
                      <td className="py-2.5">
                        <input
                          type="checkbox"
                          checked={s.aktif}
                          onChange={(e) => {
                            const next = [...scheduleDraft];
                            next[idx] = { ...s, aktif: e.target.checked };
                            setScheduleDraft(next);
                          }}
                          className="accent-teal-800"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          type="time"
                          value={s.jam_mulai}
                          onChange={(e) => {
                            const next = [...scheduleDraft];
                            next[idx] = { ...s, jam_mulai: e.target.value };
                            setScheduleDraft(next);
                          }}
                          className="border border-zinc-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          type="time"
                          value={s.jam_selesai}
                          onChange={(e) => {
                            const next = [...scheduleDraft];
                            next[idx] = { ...s, jam_selesai: e.target.value };
                            setScheduleDraft(next);
                          }}
                          className="border border-zinc-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="py-2.5">
                        <input
                          type="time"
                          value={s.jam_batas_pesan}
                          onChange={(e) => {
                            const next = [...scheduleDraft];
                            next[idx] = { ...s, jam_batas_pesan: e.target.value };
                            setScheduleDraft(next);
                          }}
                          className="border border-zinc-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api.updateSchedules(scheduleDraft);
                await refreshAll();
                showToast('success', 'Jadwal antar diperbarui.');
              }}
              className="px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Simpan Jadwal Antar
            </button>
          </div>
        )}

        {!forceCompleteProfile && settingsSubTab === 'kategori' && (
          <div className="max-w-2xl space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (editingCat) {
                    await api.updateCategory(editingCat.id, {
                      nama: catNameInput,
                      urutan: Number(catOrderInput),
                    });
                    setEditingCat(null);
                  } else {
                    await api.createCategory({
                      nama: catNameInput,
                      urutan: Number(catOrderInput),
                    });
                  }
                  setCatNameInput('');
                  await refreshAll();
                  showToast('success', 'Kategori disimpan.');
                } catch (err: unknown) {
                  showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan kategori.');
                }
              }}
              className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap gap-2 items-center"
            >
              <input
                type="text"
                value={catNameInput}
                onChange={(e) => setCatNameInput(e.target.value)}
                placeholder="Nama kategori..."
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={catOrderInput}
                onChange={(e) => setCatOrderInput(e.target.value)}
                placeholder="Urutan"
                className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
              >
                {editingCat ? 'Simpan Perubahan' : 'Tambah Kategori'}
              </button>
              {editingCat && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCat(null);
                    setCatNameInput('');
                  }}
                  className="px-3 py-2 text-xs font-medium bg-zinc-100 rounded-lg"
                >
                  Batal
                </button>
              )}
            </form>

            <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
              {kategori.map((k) => (
                <div key={k.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-zinc-400 mr-2">#{k.urutan}</span>
                    <span className="text-sm font-semibold text-zinc-900">{k.nama}</span>
                  </div>
                  <div className="space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCat(k);
                        setCatNameInput(k.nama);
                        setCatOrderInput(String(k.urutan));
                      }}
                      className="text-xs font-semibold text-teal-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.deleteCategory(k.id);
                          await refreshAll();
                          showToast('success', 'Kategori dihapus.');
                        } catch (err: unknown) {
                          showToast(
                            'error',
                            err instanceof Error ? err.message : 'Gagal menghapus kategori.'
                          );
                        }
                      }}
                      className="text-xs font-semibold text-rose-700"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!forceCompleteProfile && settingsSubTab === 'aturan' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.updateSettings(rulesForm);
                await refreshAll();
                showToast('success', 'Aturan toko disimpan.');
              } catch (err: unknown) {
                showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan aturan.');
              }
            }}
            className="max-w-xl bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Batas Waktu Retur (Hari setelah pesanan Selesai)
              </label>
              <input
                type="number"
                min={1}
                value={rulesForm.batas_waktu_retur_hari}
                onChange={(e) =>
                  setRulesForm({ ...rulesForm, batas_waktu_retur_hari: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Ukuran Maksimal Tiap Foto (MB)
              </label>
              <input
                type="number"
                min={1}
                value={rulesForm.ukuran_maks_foto_mb}
                onChange={(e) =>
                  setRulesForm({ ...rulesForm, ukuran_maks_foto_mb: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Maksimal Jumlah Foto per Ulasan
              </label>
              <input
                type="number"
                min={1}
                value={rulesForm.maks_foto_ulasan}
                onChange={(e) =>
                  setRulesForm({ ...rulesForm, maks_foto_ulasan: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Maksimal Jumlah Foto Bukti Retur
              </label>
              <input
                type="number"
                min={1}
                value={rulesForm.maks_foto_retur}
                onChange={(e) =>
                  setRulesForm({ ...rulesForm, maks_foto_retur: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Simpan Aturan Toko
            </button>
          </form>
        )}

        {!forceCompleteProfile && settingsSubTab === 'akun' && (
          <div className="max-w-xl bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div>
              <div className="text-xs font-medium text-zinc-500">Akun Google Pemilik Terhubung</div>
              <div className="text-base font-semibold text-zinc-900 mt-1">{sellerEmail}</div>
              <p className="text-xs text-zinc-500 mt-1">
                Akses penjual dikelola langsung melalui autentikasi Google tanpa kata sandi lokal.
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={onLogoutSeller}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-rose-700 text-white rounded-lg hover:bg-rose-800"
              >
                <LogOut className="w-4 h-4" />
                Keluar dari Dashboard Penjual
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // RENDER: NOTIFIKASI PENJUAL
  // =============================================
  const renderNotifikasiTab = () => (
    <div className={APP_UI.sellerFocused}>
      <PageHeader
        title="Notifikasi Penjual"
        backLabel="Ringkasan"
        onBack={() => setActiveTab('ringkasan')}
        rightSlot={
          unreadNotifCount > 0 ? (
            <button
              type="button"
              onClick={async () => {
                await api.markAllNotificationsRead('penjual');
                await onRefreshSeller();
              }}
              className={APP_UI.btnSecondary}
            >
              Tandai Semua Dibaca
            </button>
          ) : undefined
        }
      />

      {notifikasi.length === 0 ? (
        <div className={`${APP_UI.card} py-12 text-center text-sm text-zinc-500`}>
          Belum ada notifikasi.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {notifikasi.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleNotifClick(n)}
              className={`w-full text-left p-4 hover:bg-stone-50 flex items-start justify-between gap-4 ${
                n.sudah_dibaca ? 'opacity-70' : 'bg-teal-50/30'
              }`}
            >
              <div>
                <div className="text-sm font-semibold text-zinc-900">{n.judul}</div>
                <div className="text-xs text-zinc-600 mt-0.5">{n.isi}</div>
                <div className="text-[11px] text-zinc-400 mt-1">{formatTanggalWaktu(n.dibuat_pada)}</div>
              </div>
              {!n.sudah_dibaca && (
                <span className="text-[11px] font-semibold text-teal-800 shrink-0">Baru</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const navItems: Array<{
    id: SellerTab;
    label: string;
    shortLabel: string;
    Icon: React.FC<NavIconProps>;
  }> = [
    { id: 'ringkasan', label: 'Ringkasan', shortLabel: 'Ringkas', Icon: NavDashboardIcon },
    { id: 'produk', label: 'Produk', shortLabel: 'Produk', Icon: NavBoxIcon },
    { id: 'pesanan', label: 'Pesanan', shortLabel: 'Pesanan', Icon: NavOrdersIcon },
    { id: 'pengantaran', label: 'Pengantaran', shortLabel: 'Antar', Icon: NavTruckIcon },
    { id: 'retur', label: 'Retur & Komplain', shortLabel: 'Retur', Icon: NavReturnIcon },
    { id: 'pengaturan', label: 'Pengaturan Toko', shortLabel: 'Toko', Icon: NavSettingsIcon },
  ];

  return (
    <div className="min-h-screen flex bg-[#F7F7F5]">
      {/* Desktop Sidebar (256px sticky full height) */}
      <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-64 shrink-0 flex-col bg-white border-r border-zinc-200">
        <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-200">
          <span className="text-lg font-display font-bold text-zinc-900 truncate">
            {toko.nama_toko}
          </span>
          <span className="text-[11px] font-medium text-teal-800">Penjual</span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, Icon }) => {
            const disabled = forceCompleteProfile && id !== 'pengaturan';
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedReturId(null);
                  setProdSubView('list');
                  setActiveTab(id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-semibold'
                    : 'text-zinc-600 hover:bg-stone-100 hover:text-zinc-900'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Icon active={isActive} className="w-[18px] h-[18px] shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-200 space-y-1">
          <button
            type="button"
            onClick={onSwitchToBuyer}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-teal-800 hover:bg-teal-50"
          >
            <NavStorefrontIcon className="w-[18px] h-[18px] shrink-0" />
            Lihat Toko (Pembeli)
          </button>
          <button
            type="button"
            onClick={onLogoutSeller}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col pt-[calc(52px+env(safe-area-inset-top,0px))] md:pt-0 pb-[calc(68px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <header className="fixed top-0 left-0 right-0 md:static z-40 pt-safe md:pt-0 fixed-gpu h-[calc(52px+env(safe-area-inset-top,0px))] md:h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-3.5 sm:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 text-xs text-zinc-500">
            <span className="md:hidden font-display font-bold text-sm text-zinc-900 shrink-0">
              {toko.nama_toko}
            </span>
            <span className="hidden md:inline shrink-0">Dashboard Penjual</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-zinc-900 truncate capitalize">
              {activeTab === 'retur' ? 'Retur & Komplain' : activeTab}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onSwitchToBuyer}
              className="md:hidden inline-flex items-center gap-1.5 min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200/80 rounded-lg whitespace-nowrap"
            >
              <NavStorefrontIcon className="w-4 h-4 text-teal-800" />
              <span>Toko</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifikasi')}
              aria-label="Notifikasi Penjual"
              className="relative min-w-[42px] min-h-[42px] inline-flex items-center justify-center p-2 text-zinc-700 hover:bg-stone-100 rounded-xl transition-colors"
            >
              <NavBellIcon active={activeTab === 'notifikasi'} className="w-[21px] h-[21px]" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-700 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <span className="hidden sm:inline text-xs text-zinc-600 font-medium">{sellerEmail}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto min-w-0">
          {activeTab === 'ringkasan' && renderRingkasan()}
          {activeTab === 'produk' && renderProdukTab()}
          {activeTab === 'pesanan' && renderPesananTab()}
          {activeTab === 'pengantaran' && renderPengantaranTab()}
          {activeTab === 'retur' && renderReturTab()}
          {activeTab === 'pengaturan' && renderPengaturanTab()}
          {activeTab === 'notifikasi' && renderNotifikasiTab()}
        </main>
      </div>

      {/* Fixed Non-Shifting Mobile Bottom Main Menu */}
      <nav
        aria-label="Menu Utama Penjual"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe fixed-gpu bg-white/95 backdrop-blur-md border-t border-zinc-200/90 shadow-[0_-4px_18px_rgba(0,0,0,0.05)] select-none"
      >
        <div className="grid grid-cols-6 h-[60px] max-w-xl mx-auto">
          {navItems.map(({ id, shortLabel, Icon }) => {
            const disabled = forceCompleteProfile && id !== 'pengaturan';
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedReturId(null);
                  setProdSubView('list');
                  setActiveTab(id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-0.5 transition-colors disabled:opacity-35 ${
                  isActive ? 'text-teal-800' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[2.5px] rounded-b-full bg-teal-800"
                  />
                )}
                <Icon active={isActive} className="w-[21px] h-[21px]" />
                <span
                  className={`text-[10.5px] leading-tight tracking-tight truncate max-w-full ${
                    isActive ? 'font-bold text-teal-900' : 'font-medium'
                  }`}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Order Reject / Cancel / Fail Delivery Modal */}
      <ConfirmModal
        open={Boolean(orderReasonModal)}
        title={
          orderReasonModal?.type === 'reject'
            ? `Tolak Pesanan ${orderReasonModal.nomor}?`
            : orderReasonModal?.type === 'fail'
            ? `Tandai Gagal Antar ${orderReasonModal.nomor}?`
            : `Batalkan Pesanan ${orderReasonModal?.nomor}?`
        }
        description={
          orderReasonModal?.type === 'reject'
            ? 'Pesanan akan berstatus Dibatalkan dan pembeli akan menerima notifikasi beserta alasan.'
            : 'Pesanan akan dibatalkan, stok barang sendiri dikembalikan otomatis, dan pembeli diberi notifikasi.'
        }
        confirmLabel="Kirim"
        cancelLabel="Batal"
        danger
        requireReason
        reasonLabel="Alasan *"
        onCancel={() => setOrderReasonModal(null)}
        onConfirm={async (reason) => {
          if (!orderReasonModal || !reason) return;
          try {
            if (orderReasonModal.type === 'reject') {
              await api.rejectOrder(orderReasonModal.orderId, reason);
            } else if (orderReasonModal.type === 'fail') {
              await api.failDelivery(orderReasonModal.orderId, reason);
            } else {
              await api.cancelSellerOrder(orderReasonModal.orderId, reason);
            }
            await refreshAll();
            showToast('success', 'Status pesanan diperbarui ke Dibatalkan.');
          } catch (err: unknown) {
            await refreshAll();
            showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui status.');
          } finally {
            setOrderReasonModal(null);
          }
        }}
      />

      {/* Reject Return Modal */}
      <ConfirmModal
        open={Boolean(rejectReturTarget)}
        title={`Tolak Pengajuan Retur ${rejectReturTarget?.nomor_pesanan || ''}?`}
        description="Isi alasan penolakan agar pembeli mengetahui keputusan toko."
        confirmLabel="Kirim Penolakan"
        cancelLabel="Batal"
        danger
        requireReason
        reasonLabel="Alasan Penolakan *"
        onCancel={() => setRejectReturTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectReturTarget || !reason) return;
          try {
            await api.rejectReturn(rejectReturTarget.id, reason);
            await refreshAll();
            showToast('success', 'Retur ditolak & pembeli diberitahu.');
          } catch (err: unknown) {
            showToast('error', err instanceof Error ? err.message : 'Gagal menolak retur.');
          } finally {
            setRejectReturTarget(null);
          }
        }}
      />
    </div>
  );
}
