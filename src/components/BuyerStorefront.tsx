import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ExternalLink,
  Home,
  LayoutGrid,
  LogOut,
  MapPin,
  Minus,
  Monitor,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import {
  NavBellIcon,
  NavCartIcon,
  NavCatalogIcon,
  NavHomeIcon,
  NavOrdersIcon,
  NavProfileIcon,
  WhatsAppIcon,
} from './NavIcons';
import { api, readImageFilesAsDataUrls } from '../api';
import {
  Alamat,
  AlasanRetur,
  JadwalAntar,
  Kategori,
  KeranjangItem,
  Notifikasi,
  Pembeli,
  PengaturanToko,
  Pesanan,
  Produk,
  Retur,
  TarifOngkirJarak,
  Toko,
  Ulasan,
} from '../types';
import {
  ALASAN_RETUR_LABELS,
  buildWhatsAppUrl,
  calculateDistanceShipping,
  formatRupiah,
  formatTanggal,
  formatTanggalWaktu,
  getAvailableDeliverySlots,
  getProductEffectivePrice,
  getProductEffectiveStock,
  haversineDistanceKm,
  isAddressWithinRadius,
  isWithinReturnWindow,
} from '../utils/format';
import {
  AddressMapPicker,
  AddressMapValue,
  DeliveryRoutePreviewMap,
  StoreLocationMapCard,
} from './GoogleMapsWidgets';
import {
  APP_UI,
  ConfirmModal,
  OrderStatusLabel,
  PageHeader,
  ProductImage,
  ReturnStatusLabel,
} from './SharedUI';

export type BuyerPage =
  | 'beranda'
  | 'daftar-produk'
  | 'hasil-pencarian'
  | 'detail-produk'
  | 'keranjang'
  | 'checkout'
  | 'pilih-alamat'
  | 'form-alamat'
  | 'pesanan-berhasil'
  | 'pesanan-saya'
  | 'detail-pesanan'
  | 'form-ulasan'
  | 'form-retur'
  | 'status-retur'
  | 'profil-saya'
  | 'edit-profil'
  | 'daftar-alamat'
  | 'notifikasi';

interface BuyerStorefrontProps {
  toko: Toko;
  kategori: Kategori[];
  tarifOngkir: TarifOngkirJarak;
  mapsAvailable: boolean;
  jadwalAntar: JadwalAntar[];
  produk: Produk[];
  allProdukRef: Produk[];
  ulasan: Ulasan[];
  pengaturan: PengaturanToko;
  buyer: Pembeli | null;
  addresses: Alamat[];
  cart: KeranjangItem[];
  orders: Pesanan[];
  returns: Retur[];
  notifications: Notifikasi[];
  page: BuyerPage;
  setPage: (p: BuyerPage) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  selectedReturnId: string | null;
  setSelectedReturnId: (id: string | null) => void;
  onRequireAuth: (targetPage?: BuyerPage, afterAction?: () => void) => void;
  onLogoutBuyer: () => void;
  onRefreshPublic: () => Promise<void>;
  onRefreshBuyer: () => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function BuyerStorefront(props: BuyerStorefrontProps) {
  const {
    toko,
    kategori,
    tarifOngkir,
    mapsAvailable,
    jadwalAntar,
    produk,
    allProdukRef,
    ulasan,
    pengaturan,
    buyer,
    addresses,
    cart,
    orders,
    returns,
    notifications,
    page,
    setPage,
    selectedProductId,
    setSelectedProductId,
    selectedOrderId,
    setSelectedOrderId,
    selectedReturnId,
    setSelectedReturnId,
    onRequireAuth,
    onLogoutBuyer,
    onRefreshPublic,
    onRefreshBuyer,
    showToast,
  } = props;

  // Search & Catalog filter state
  const [headerSearch, setHeaderSearch] = useState('');
  const [berandaSearch, setBerandaSearch] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<'terbaru' | 'termurah' | 'terlaris'>('terbaru');
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const PAGE_SIZE = 6;

  // Product detail state
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [detailQty, setDetailQty] = useState<number>(1);
  const [detailTab, setDetailTab] = useState<'deskripsi' | 'ulasan'>('deskripsi');
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Checkout & Buy Now state
  const [buyNowItem, setBuyNowItem] = useState<{
    produk_id: string;
    varian_id: string | null;
    jumlah: number;
  } | null>(null);
  const [checkoutAddressId, setCheckoutAddressId] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>('');
  const [catatanPenjual, setCatatanPenjual] = useState<string>('');
  const [checkoutBannerError, setCheckoutBannerError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<Pesanan | null>(null);

  // Address Form state
  const [addressReturnPage, setAddressReturnPage] = useState<'checkout' | 'pilih-alamat' | 'daftar-alamat'>('daftar-alamat');
  const [editingAddress, setEditingAddress] = useState<Alamat | null>(null);
  const [addrForm, setAddrForm] = useState<{
    nama_penerima: string;
    no_telepon: string;
    nama_wilayah: string;
    alamat_lengkap: string;
    patokan: string;
    lat: number | null;
    lng: number | null;
    jarak_km: number | null;
  }>({
    nama_penerima: '',
    no_telepon: '',
    nama_wilayah: '',
    alamat_lengkap: '',
    patokan: '',
    lat: null,
    lng: null,
    jarak_km: null,
  });
  const [addrError, setAddrError] = useState<string | null>(null);
  const [deleteAddrTarget, setDeleteAddrTarget] = useState<Alamat | null>(null);

  // Orders & Detail state
  const [orderStatusTab, setOrderStatusTab] = useState<
    'Semua' | 'Menunggu Konfirmasi' | 'Diproses' | 'Diantar' | 'Selesai' | 'Dibatalkan'
  >('Semua');
  const [cancelOrderConfirmOpen, setCancelOrderConfirmOpen] = useState(false);

  // Review Form state
  const [reviewTargetProductId, setReviewTargetProductId] = useState<string>('');
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Return Form state
  const [returnReason, setReturnReason] = useState<AlasanRetur>('barang_rusak');
  const [returnNote, setReturnNote] = useState<string>('');
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [cancelReturnConfirmOpen, setCancelReturnConfirmOpen] = useState(false);

  // Edit Profile state
  const [editProfileNama, setEditProfileNama] = useState('');
  const [editProfileWa, setEditProfileWa] = useState('');
  const [editProfileError, setEditProfileError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.sudah_dibaca).length;
  const cartTotalCount = cart.reduce((acc, item) => acc + item.jumlah, 0);

  const navigateProtected = (target: BuyerPage, afterAction?: () => void) => {
    if (!buyer) {
      onRequireAuth(target, afterAction);
      return;
    }
    if (afterAction) afterAction();
    setPage(target);
  };

  const openProductDetail = (productId: string) => {
    const p = allProdukRef.find((x) => x.id === productId) || produk.find((x) => x.id === productId);
    setSelectedProductId(productId);
    setActivePhotoIdx(0);
    setDetailQty(1);
    setDetailTab('deskripsi');
    if (p && p.varian.length > 0) {
      const firstAvail = p.varian.find((v) => v.aktif && (v.stok ?? 0) > 0) || p.varian.find((v) => v.aktif);
      setSelectedVariantId(firstAvail?.id || null);
    } else {
      setSelectedVariantId(null);
    }
    setPage('detail-produk');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getAddressDistanceKm = (addr: Alamat | null): number | null => {
    if (!addr) return null;
    if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
      return typeof addr.jarak_km === 'number' && Number.isFinite(addr.jarak_km)
        ? addr.jarak_km
        : haversineDistanceKm(toko, { lat: addr.lat, lng: addr.lng });
    }
    return null;
  };

  const openAddressForm = (
    addr: Alamat | null,
    returnTo: 'checkout' | 'pilih-alamat' | 'daftar-alamat'
  ) => {
    setAddressReturnPage(returnTo);
    setEditingAddress(addr);
    setAddrError(null);
    if (addr) {
      setAddrForm({
        nama_penerima: addr.nama_penerima,
        no_telepon: addr.no_telepon,
        nama_wilayah: addr.nama_wilayah,
        alamat_lengkap: addr.alamat_lengkap,
        patokan: addr.patokan || '',
        lat: addr.lat,
        lng: addr.lng,
        jarak_km: getAddressDistanceKm(addr),
      });
    } else {
      setAddrForm({
        nama_penerima: buyer?.nama || '',
        no_telepon: buyer?.no_whatsapp || '',
        nama_wilayah: '',
        alamat_lengkap: '',
        patokan: '',
        lat: null,
        lng: null,
        jarak_km: null,
      });
    }
    setPage('form-alamat');
  };

  const startCheckout = (
    directBuyNow: { produk_id: string; varian_id: string | null; jumlah: number } | null
  ) => {
    setBuyNowItem(directBuyNow);
    setCheckoutBannerError(null);
    setCatatanPenjual('');
    setSelectedSlotKey('');
    if (addresses.length === 0) {
      openAddressForm(null, 'checkout');
      return;
    }
    const primary = addresses.find((a) => a.is_utama) || addresses[0];
    const distKm = getAddressDistanceKm(primary);
    const pinValid =
      distKm !== null && isAddressWithinRadius(distKm, tarifOngkir);
    if (pinValid) {
      setCheckoutAddressId(primary.id);
      setPage('checkout');
    } else {
      setCheckoutAddressId(null);
      showToast(
        'info',
        distKm === null
          ? 'Pin lokasi Google Maps alamat utama belum diatur. Silakan pilih atau lengkapi pin alamat.'
          : `Alamat utama (${distKm.toFixed(1)} km) berada di luar radius maks ${tarifOngkir.batas_radius_km} km.`
      );
      setPage('pilih-alamat');
    }
  };

  // Filtered & sorted products for Daftar Produk & Hasil Pencarian
  const filteredProducts = useMemo(() => {
    const kw = page === 'hasil-pencarian' ? searchKeyword.trim().toLowerCase() : '';
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;

    const list = produk.filter((p) => {
      if (kw && !p.nama.toLowerCase().includes(kw) && !p.deskripsi.toLowerCase().includes(kw)) {
        return false;
      }
      if (filterCat !== 'all' && p.kategori_id !== filterCat) return false;
      if (minP !== null && p.harga < minP) return false;
      if (maxP !== null && p.harga > maxP) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'termurah') return a.harga - b.harga;
      if (sortBy === 'terlaris') return b.jumlah_terjual - a.jumlah_terjual;
      return b.dibuat_pada.localeCompare(a.dibuat_pada);
    });
  }, [produk, page, searchKeyword, filterCat, minPrice, maxPrice, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice(
    (currentPageNum - 1) * PAGE_SIZE,
    currentPageNum * PAGE_SIZE
  );

  const resetFilters = () => {
    setFilterCat('all');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('terbaru');
    setCurrentPageNum(1);
  };

  // Helper to get product rating summary
  const getProductRating = (productId: string) => {
    const list = ulasan.filter((u) => u.produk_id === productId);
    if (list.length === 0) return { avg: 0, count: 0 };
    const avg = list.reduce((s, u) => s + u.rating, 0) / list.length;
    return { avg: Number(avg.toFixed(1)), count: list.length };
  };

  // =============================================
  // RENDER HELPERS
  // =============================================
  const handleQuickAddToCart = async (e: React.MouseEvent, p: Produk) => {
    e.stopPropagation();
    const totalStock = getProductEffectiveStock(p, null);
    if (totalStock <= 0) {
      showToast('error', 'Stok produk sedang habis.');
      return;
    }
    if (p.varian.length > 0) {
      openProductDetail(p.id);
      showToast('info', 'Pilih varian produk terlebih dahulu.');
      return;
    }
    if (!buyer) {
      onRequireAuth('beranda', async () => {
        showToast('info', 'Silakan klik tambah ke keranjang kembali.');
      });
      return;
    }
    try {
      await api.addToCart({
        pembeliId: buyer.id,
        produk_id: p.id,
        varian_id: null,
        jumlah: 1,
      });
      await onRefreshBuyer();
      showToast('success', `${p.nama} ditambahkan ke keranjang.`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menambah ke keranjang.');
    }
  };

  const renderProductCard = (p: Produk, compact = false) => {
    const sortedPhotos = [...p.foto].sort((a, b) => a.urutan - b.urutan);
    const catName = kategori.find((k) => k.id === p.kategori_id)?.nama || 'Umum';
    const totalStock = getProductEffectiveStock(p, null);
    const isOOS = totalStock <= 0;
    const rating = getProductRating(p.id);

    return (
      <div
        key={p.id}
        onClick={() => openProductDetail(p.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openProductDetail(p.id);
          }
        }}
        className="group text-left bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-teal-700/50 hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer"
      >
        <div className="aspect-[4/3] w-full bg-stone-100 overflow-hidden relative">
          <ProductImage
            src={sortedPhotos[0]?.url}
            alt={p.nama}
            className="w-full h-full group-hover:scale-[1.03] transition-transform duration-200"
          />
          {isOOS && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-xs font-semibold text-white bg-zinc-900/90 px-3 py-1 rounded-md">
                Stok Habis
              </span>
            </div>
          )}
        </div>
        <div className={`${compact ? 'p-3 sm:p-3.5' : 'p-3.5 sm:p-4'} flex-1 flex flex-col justify-between gap-2.5 sm:gap-3`}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
              <span className="truncate">{catName}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 text-teal-800">Stok {totalStock}</span>
            </div>
            <h3 className="text-[13px] sm:text-[15px] font-semibold text-zinc-900 mt-1 line-clamp-2 leading-snug">
              {p.nama}
            </h3>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="text-sm sm:text-[15px] font-bold text-zinc-900 tabular-nums">
                {formatRupiah(p.harga)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 tabular-nums">
                {rating.count > 0 && (
                  <>
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="font-medium text-zinc-700">{rating.avg}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>Terjual {p.jumlah_terjual}</span>
              </span>
            </div>

            <button
              type="button"
              disabled={isOOS}
              onClick={(e) => handleQuickAddToCart(e, p)}
              className="w-full min-h-[38px] sm:min-h-[36px] py-2 px-2.5 text-xs font-semibold rounded-lg border border-teal-800/30 bg-teal-50/60 text-teal-900 hover:bg-teal-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isOOS ? 'Stok Habis' : p.varian.length > 0 ? 'Pilih Varian' : 'Tambah'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =============================================
  // RENDER HEADER (Fixed Non-Shifting Top Bar)
  // =============================================
  const renderHeader = () => (
    <header className="fixed top-0 left-0 right-0 z-40 pt-safe fixed-gpu bg-white/95 backdrop-blur-md border-b border-zinc-200/90 no-print">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-[52px] lg:h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => {
            setPage('beranda');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-lg sm:text-xl font-display font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 hover:text-teal-800 transition-colors min-h-[44px] flex items-center"
        >
          {toko.nama_toko}
        </button>

        {/* Zone 2: 5 concise single-line nav links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-600">
          <button
            type="button"
            onClick={() => setPage('beranda')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 transition-colors ${
              page === 'beranda' ? 'text-zinc-900 underline underline-offset-8 decoration-teal-800 decoration-2' : ''
            }`}
          >
            Beranda
          </button>
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setPage('daftar-produk');
            }}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 transition-colors ${
              page === 'daftar-produk' || page === 'hasil-pencarian'
                ? 'text-zinc-900 underline underline-offset-8 decoration-teal-800 decoration-2'
                : ''
            }`}
          >
            Produk
          </button>
          <button
            type="button"
            onClick={() => navigateProtected('pesanan-saya')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 transition-colors ${
              page === 'pesanan-saya' || page === 'detail-pesanan'
                ? 'text-zinc-900 underline underline-offset-8 decoration-teal-800 decoration-2'
                : ''
            }`}
          >
            Pesanan Saya
          </button>
          <button
            type="button"
            onClick={() => navigateProtected('profil-saya')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 transition-colors ${
              page === 'profil-saya' || page === 'edit-profil' || page === 'daftar-alamat'
                ? 'text-zinc-900 underline underline-offset-8 decoration-teal-800 decoration-2'
                : ''
            }`}
          >
            Profil Saya
          </button>
        </nav>

        {/* Zone 3: Search (desktop), Cart, Notifications, Account */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchKeyword(headerSearch);
              setCurrentPageNum(1);
              setPage('hasil-pencarian');
            }}
            className="hidden lg:flex items-center relative"
          >
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Cari produk..."
              aria-label="Kolom Pencarian"
              className="w-44 xl:w-56 pl-9 pr-3 py-1.5 text-sm bg-stone-100 border border-transparent focus:border-zinc-300 focus:bg-white rounded-lg focus:outline-none transition-colors"
            />
          </form>

          <button
            type="button"
            onClick={() => navigateProtected('keranjang')}
            aria-label="Keranjang Belanja"
            className="hidden lg:inline-flex relative min-w-[44px] min-h-[44px] items-center justify-center p-2 text-zinc-700 hover:text-zinc-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <NavCartIcon active={page === 'keranjang' || page === 'checkout'} className="w-[22px] h-[22px]" />
            {buyer && cartTotalCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-800 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {cartTotalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigateProtected('notifikasi')}
            aria-label="Notifikasi"
            className="relative min-w-[42px] min-h-[42px] inline-flex items-center justify-center p-2 text-zinc-700 hover:text-zinc-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <NavBellIcon active={page === 'notifikasi'} className="w-[21px] h-[21px]" />
            {buyer && unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-700 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {buyer ? (
            <button
              type="button"
              onClick={() => setPage('profil-saya')}
              className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-stone-100 hover:bg-stone-200 rounded-lg whitespace-nowrap shrink-0 transition-colors"
            >
              <NavProfileIcon active={page === 'profil-saya'} className="w-4 h-4 text-teal-800" />
              <span className="max-w-[100px] truncate">{buyer.nama}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRequireAuth()}
              className="min-h-[38px] px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg whitespace-nowrap shrink-0 transition-colors"
            >
              Masuk
            </button>
          )}
        </div>
      </div>
    </header>
  );

  // =============================================
  // RENDER FIXED MOBILE BOTTOM MAIN MENU
  // =============================================
  const renderMobileBottomNav = () => {
    const isBeranda = page === 'beranda';
    const isProduk =
      page === 'daftar-produk' || page === 'hasil-pencarian' || page === 'detail-produk';
    const isKeranjang =
      page === 'keranjang' ||
      page === 'checkout' ||
      page === 'pilih-alamat' ||
      page === 'form-alamat';
    const isPesanan =
      page === 'pesanan-saya' ||
      page === 'detail-pesanan' ||
      page === 'pesanan-berhasil' ||
      page === 'form-ulasan' ||
      page === 'form-retur' ||
      page === 'status-retur';
    const isProfil =
      page === 'profil-saya' ||
      page === 'edit-profil' ||
      page === 'daftar-alamat' ||
      page === 'notifikasi';

    const items: Array<{
      id: string;
      label: string;
      active: boolean;
      badge?: number;
      onClick: () => void;
      renderIcon: (active: boolean) => React.ReactNode;
    }> = [
      {
        id: 'beranda',
        label: 'Beranda',
        active: isBeranda,
        onClick: () => {
          setPage('beranda');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        renderIcon: (active) => <NavHomeIcon active={active} className="w-[22px] h-[22px]" />,
      },
      {
        id: 'produk',
        label: 'Produk',
        active: isProduk,
        onClick: () => {
          resetFilters();
          setPage('daftar-produk');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        renderIcon: (active) => <NavCatalogIcon active={active} className="w-[22px] h-[22px]" />,
      },
      {
        id: 'keranjang',
        label: 'Keranjang',
        active: isKeranjang,
        badge: buyer && cartTotalCount > 0 ? cartTotalCount : undefined,
        onClick: () => navigateProtected('keranjang'),
        renderIcon: (active) => <NavCartIcon active={active} className="w-[22px] h-[22px]" />,
      },
      {
        id: 'pesanan',
        label: 'Pesanan',
        active: isPesanan,
        onClick: () => navigateProtected('pesanan-saya'),
        renderIcon: (active) => <NavOrdersIcon active={active} className="w-[22px] h-[22px]" />,
      },
      {
        id: 'profil',
        label: buyer ? 'Profil' : 'Akun',
        active: isProfil,
        onClick: () => (buyer ? setPage('profil-saya') : onRequireAuth()),
        renderIcon: (active) => <NavProfileIcon active={active} className="w-[22px] h-[22px]" />,
      },
    ];

    return (
      <nav
        aria-label="Menu Utama Pembeli"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-safe fixed-gpu bg-white/95 backdrop-blur-md border-t border-zinc-200/90 shadow-[0_-4px_18px_rgba(0,0,0,0.05)] select-none no-print"
      >
        <div className="grid grid-cols-5 h-[60px] max-w-xl mx-auto">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-1 transition-colors ${
                item.active ? 'text-teal-800' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {item.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-b-full bg-teal-800"
                />
              )}
              <span className="relative flex items-center justify-center">
                {item.renderIcon(item.active)}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-teal-800 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[11px] leading-tight tracking-tight truncate max-w-full ${
                  item.active ? 'font-bold text-teal-900' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    );
  };

  // =============================================
  // PAGE VIEWS
  // =============================================
  const renderBeranda = () => {
    const primaryAddr = buyer
      ? addresses.find((a) => a.is_utama) || addresses[0] || null
      : null;
    const primaryDistKm = getAddressDistanceKm(primaryAddr);
    const nextSlot = getAvailableDeliverySlots(jadwalAntar, 0)[0] || null;

    const stokSendiriProducts = [...produk].sort((a, b) => b.jumlah_terjual - a.jumlah_terjual);

    const catSpotlight1 = kategori[0];
    const catSpotlight1Items = catSpotlight1
      ? produk.filter((p) => p.kategori_id === catSpotlight1.id).slice(0, 2)
      : [];
    const catSpotlight2 = kategori[1];
    const catSpotlight2Items = catSpotlight2
      ? produk.filter((p) => p.kategori_id === catSpotlight2.id).slice(0, 2)
      : [];

    const getCategoryVisual = (catName: string, catId: string) => {
      const samplePhoto = produk.find((p) => p.kategori_id === catId)?.foto?.[0]?.url;
      if (samplePhoto) return { type: 'img' as const, src: samplePhoto };
      const lower = catName.toLowerCase();
      if (lower.includes('kopi')) return { type: 'icon' as const, Icon: Coffee };
      if (lower.includes('rumah')) return { type: 'icon' as const, Icon: Home };
      if (lower.includes('meja')) return { type: 'icon' as const, Icon: Monitor };
      return { type: 'icon' as const, Icon: Package };
    };

    return (
      <div className="space-y-10 pb-16">
        {/* Modern Quick-Commerce Hero Band (inspired by InstantMart reference, upgraded to RMStore editorial teal) */}
        <section className="bg-[#0F4C46] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-10 space-y-6">
            {/* Top Delivery Location & Next Slot Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-b border-white/15 pb-4">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-teal-200 shrink-0" />
                {buyer && primaryAddr ? (
                  <button
                    type="button"
                    onClick={() => setPage('daftar-alamat')}
                    className="flex items-center gap-1.5 text-left hover:text-teal-100 truncate"
                  >
                    <span className="text-teal-200 shrink-0">Kirim ke:</span>
                    <span className="font-semibold truncate">
                      {primaryAddr.alamat_lengkap} · {primaryAddr.nama_wilayah}
                      {primaryDistKm !== null ? ` (${primaryDistKm.toFixed(1)} km)` : ''}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-teal-200" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-teal-200">
                      Ongkir Jarak Google Maps: mulai {formatRupiah(tarifOngkir.tarif_dasar)} +{' '}
                      {formatRupiah(tarifOngkir.tarif_per_km)}/km (maks. {tarifOngkir.batas_radius_km} km)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigateProtected('form-alamat', () => openAddressForm(null, 'daftar-alamat'))
                      }
                      className="px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
                    >
                      Pin Alamat
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-teal-100 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-teal-200" />
                  {nextSlot
                    ? `Antar terdekat: ${nextSlot.hariName}, ${nextSlot.jam_antar}`
                    : 'Pengantaran terjadwal'}
                </span>
                <span aria-hidden="true" className="hidden sm:inline text-white/30">
                  |
                </span>
                <span className="hidden sm:inline font-medium text-white">COD Tunai di Tempat</span>
                <span aria-hidden="true" className="hidden sm:inline text-white/30">
                  |
                </span>
                <a
                  href={buildWhatsAppUrl(toko.no_whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-white hover:text-teal-200 transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  <span>WhatsApp Toko</span>
                </a>
              </div>
            </div>

            {/* Hero Main Grid: Search-first left + Kiosk showcase right */}
            <div className="grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-5">
                <div>
                  <h1 className="text-2xl sm:text-4xl font-display font-bold tracking-tight leading-[1.15] [text-wrap:balance]">
                    Belanja Harian Stok Kios Cepat &amp; Bayar COD di Tempat
                  </h1>
                  <p className="mt-2.5 text-sm text-teal-100/90 max-w-2xl leading-relaxed">
                    {toko.deskripsi}
                  </p>
                </div>

                {/* Large Search Bar (InstantMart reference centerpiece) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearchKeyword(berandaSearch);
                    setHeaderSearch(berandaSearch);
                    setCurrentPageNum(1);
                    setPage('hasil-pencarian');
                  }}
                  className="bg-white rounded-xl p-1.5 flex items-center gap-2 shadow-sm max-w-2xl"
                >
                  <Search className="w-5 h-5 text-zinc-400 ml-3 shrink-0" />
                  <input
                    type="search"
                    value={berandaSearch}
                    onChange={(e) => setBerandaSearch(e.target.value)}
                    placeholder="Cari kopi, tumbler, lampu meja, atau barang kebutuhan..."
                    className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs sm:text-sm font-semibold bg-[#0F4C46] hover:bg-teal-950 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Cari Produk
                  </button>
                </form>

                {/* Quick Action Links */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-teal-100">
                  <button
                    type="button"
                    onClick={() => {
                      resetFilters();
                      setPage('daftar-produk');
                    }}
                    className="hover:text-white underline underline-offset-4"
                  >
                    Lihat Semua Produk ({produk.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetFilters();
                      setSortBy('terlaris');
                      setPage('daftar-produk');
                    }}
                    className="hover:text-white underline underline-offset-4"
                  >
                    Produk Terlaris
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative h-52 sm:h-64 rounded-2xl overflow-hidden border border-white/15 bg-teal-950/40">
                  <ProductImage
                    src={toko.logo_url}
                    alt={toko.nama_toko}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-4">
                    <div className="text-xs text-white/95">
                      <div className="font-semibold text-sm">{toko.nama_toko}</div>
                      <div className="text-white/80 line-clamp-1 mt-0.5">{toko.alamat_kios}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Horizontal Category Tile Strip (InstantMart reference icon-card row) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {kategori.map((cat) => {
                const vis = getCategoryVisual(cat.nama, cat.id);
                const count = produk.filter((p) => p.kategori_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      resetFilters();
                      setFilterCat(cat.id);
                      setPage('daftar-produk');
                    }}
                    className="group flex flex-col items-center text-center p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-stone-100 border border-zinc-200 overflow-hidden flex items-center justify-center mb-2 group-hover:border-teal-700 transition-colors">
                      {vis.type === 'img' ? (
                        <ProductImage src={vis.src} alt={cat.nama} className="w-full h-full object-cover" />
                      ) : (
                        <vis.Icon className="w-6 h-6 text-teal-800" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-zinc-900 line-clamp-2 leading-tight">
                      {cat.nama}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                      {count} item
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setPage('daftar-produk');
                }}
                className="group flex flex-col items-center text-center p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-2 group-hover:border-teal-700 transition-colors">
                  <LayoutGrid className="w-6 h-6 text-teal-800" />
                </div>
                <span className="text-xs font-semibold text-zinc-900 leading-tight">
                  Semua Produk
                </span>
                <span className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                  {produk.length} item
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Belanja Harian / Stok Kios Showcase (InstantMart "BELANJA MINGGUAN | LIHAT SEMUA >" row) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-zinc-900 tracking-tight">
                Belanja Harian · Stok Kios
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Tersedia langsung di kios dan siap diantar pada jadwal terdekat
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setPage('daftar-produk');
              }}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0"
            >
              Lihat Semua
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {stokSendiriProducts.slice(0, 4).map((p) => renderProductCard(p, true))}
          </div>
        </section>

        {/* Dual Category Spotlight Grid (InstantMart bottom two-column category split) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-6">
          {/* Left Spotlight: First Category */}
          {catSpotlight1 && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setFilterCat(catSpotlight1.id);
                    setPage('daftar-produk');
                  }}
                  className="inline-flex items-center gap-1 text-sm font-display font-bold text-zinc-900 hover:text-teal-800"
                >
                  <span>{catSpotlight1.nama}</span>
                  <ChevronRight className="w-4 h-4 text-teal-800" />
                </button>
                <span className="text-xs text-zinc-500">Pilihan terlaris</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {catSpotlight1Items.map((p) => renderProductCard(p, true))}
              </div>
            </div>
          )}

          {/* Right Spotlight: Second Category */}
          {catSpotlight2 && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setFilterCat(catSpotlight2.id);
                    setPage('daftar-produk');
                  }}
                  className="inline-flex items-center gap-1 text-sm font-display font-bold text-zinc-900 hover:text-teal-800"
                >
                  <span>{catSpotlight2.nama}</span>
                  <ChevronRight className="w-4 h-4 text-teal-800" />
                </button>
                <span className="text-xs text-zinc-500">Siap antar COD</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {catSpotlight2Items.map((p) => renderProductCard(p, true))}
              </div>
            </div>
          )}
        </section>

        {/* Google Maps Kiosk & Distance Shipping Info */}
        <StoreLocationMapCard
          mapsAvailable={mapsAvailable}
          kioskLocation={{ lat: toko.lat, lng: toko.lng }}
          namaToko={toko.nama_toko}
          alamatKios={toko.alamat_kios}
          tarifOngkir={tarifOngkir}
          onActionPinAddress={() =>
            navigateProtected('form-alamat', () => openAddressForm(null, 'daftar-alamat'))
          }
        />
      </div>
    );
  };

  const renderCatalogOrSearch = (isSearchMode: boolean) => (
    <div className={APP_UI.buyerWide}>
      <PageHeader
        title={isSearchMode ? `Hasil Pencarian${searchKeyword ? `: "${searchKeyword}"` : ''}` : 'Daftar Produk'}
        subtitle={<span className="tabular-nums">Menampilkan {filteredProducts.length} produk</span>}
        backLabel={isSearchMode ? 'Beranda' : undefined}
        onBack={isSearchMode ? () => setPage('beranda') : undefined}
      />

      {/* Mobile search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearchKeyword(headerSearch);
          setCurrentPageNum(1);
          setPage('hasil-pencarian');
        }}
        className="sm:hidden w-full flex items-center gap-2"
      >
        <input
          type="search"
          value={headerSearch}
          onChange={(e) => setHeaderSearch(e.target.value)}
          placeholder="Cari nama produk..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg"
        />
        <button type="submit" className={APP_UI.btnPrimary}>
          Cari
        </button>
      </form>

      {/* Filter & Sort Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Kategori</label>
          <select
            value={filterCat}
            onChange={(e) => {
              setFilterCat(e.target.value);
              setCurrentPageNum(1);
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="all">Semua Kategori</option>
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Harga Min</label>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setCurrentPageNum(1);
            }}
            placeholder="Rp 0"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Harga Maks</label>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setCurrentPageNum(1);
            }}
            placeholder="Tanpa batas"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Urutkan</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'terbaru' | 'termurah' | 'terlaris')}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="terbaru">Terbaru</option>
            <option value="termurah">Termurah</option>
            <option value="terlaris">Terlaris</option>
          </select>
        </div>
        <div>
          <button
            type="button"
            onClick={resetFilters}
            className="w-full px-4 py-2 text-sm font-medium text-zinc-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Product Grid or Empty State */}
      {paginatedProducts.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <Package className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-900">Produk tidak ditemukan</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-5">
            {isSearchMode
              ? 'Coba kata kunci lain atau pilih salah satu saran kategori berikut:'
              : 'Tidak ada produk yang cocok dengan filter yang dipilih.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {kategori.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  resetFilters();
                  setFilterCat(k.id);
                  setPage('daftar-produk');
                }}
                className="px-3.5 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-zinc-800 rounded-lg"
              >
                {k.nama}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedProducts.map((p) => renderProductCard(p))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-6">
              <button
                type="button"
                disabled={currentPageNum <= 1}
                onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 bg-white disabled:opacity-40 hover:bg-stone-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Halaman Sebelumnya
              </button>
              <span className="text-sm text-zinc-600 tabular-nums">
                Halaman {currentPageNum} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPageNum >= totalPages}
                onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 bg-white disabled:opacity-40 hover:bg-stone-50"
              >
                Halaman Berikutnya
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderDetailProduk = () => {
    const product =
      produk.find((p) => p.id === selectedProductId) ||
      allProdukRef.find((p) => p.id === selectedProductId);
    if (!product) {
      return (
        <div className={APP_UI.buyerFocused}>
          <div className={`${APP_UI.card} text-center space-y-3`}>
            <p className="text-sm text-zinc-600">Produk tidak ditemukan.</p>
            <div>
              <button
                type="button"
                onClick={() => setPage('daftar-produk')}
                className={APP_UI.btnPrimary}
              >
                Kembali ke Daftar Produk
              </button>
            </div>
          </div>
        </div>
      );
    }

    const photos = [...product.foto].sort((a, b) => a.urutan - b.urutan);
    const activeVariant =
      product.varian.length > 0
        ? product.varian.find((v) => v.id === selectedVariantId && v.aktif) || null
        : null;
    const effectivePrice = getProductEffectivePrice(product, activeVariant);
    const effectiveStock = getProductEffectiveStock(product, activeVariant);
    const isOutOfStock =
      !product.aktif ||
      Boolean(product.dihapus_pada) ||
      effectiveStock <= 0;
    const productReviews = ulasan.filter((u) => u.produk_id === product.id);
    const relatedProducts = produk
      .filter((p) => p.kategori_id === product.kategori_id && p.id !== product.id)
      .slice(0, 3);
    const catName = kategori.find((k) => k.id === product.kategori_id)?.nama || 'Umum';

    const handleAddToCart = async () => {
      if (product.varian.length > 0 && !activeVariant) {
        showToast('error', 'Pilih varian terlebih dahulu.');
        return;
      }
      if (!buyer) {
        onRequireAuth('detail-produk');
        return;
      }
      try {
        await api.addToCart({
          pembeliId: buyer.id,
          produk_id: product.id,
          varian_id: activeVariant?.id || null,
          jumlah: detailQty,
        });
        await onRefreshBuyer();
        showToast('success', 'Produk ditambahkan ke keranjang.');
      } catch (err: unknown) {
        showToast('error', err instanceof Error ? err.message : 'Gagal menambah ke keranjang.');
      }
    };

    const handleBuyNow = () => {
      if (product.varian.length > 0 && !activeVariant) {
        showToast('error', 'Pilih varian terlebih dahulu.');
        return;
      }
      const itemPayload = {
        produk_id: product.id,
        varian_id: activeVariant?.id || null,
        jumlah: detailQty,
      };
      if (!buyer) {
        setBuyNowItem(itemPayload);
        setCheckoutAddressId(null);
        setSelectedSlotKey('');
        setCheckoutBannerError(null);
        onRequireAuth('checkout');
        return;
      }
      startCheckout(itemPayload);
    };

    return (
      <div className={APP_UI.buyerWide}>
        <div>
          <button
            type="button"
            onClick={() => setPage('daftar-produk')}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Produk</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Gallery Left */}
          <div className="lg:col-span-6 space-y-3">
            <button
              type="button"
              onClick={() => photos.length > 0 && setLightboxOpen(true)}
              className="w-full aspect-[4/3] bg-stone-100 border border-zinc-200 rounded-xl overflow-hidden block cursor-zoom-in"
            >
              <ProductImage
                src={photos[activePhotoIdx]?.url}
                alt={product.nama}
                className="w-full h-full object-cover"
              />
            </button>
            {photos.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {photos.map((ft, idx) => (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors shrink-0 ${
                      idx === activePhotoIdx ? 'border-teal-800' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <ProductImage src={ft.url} alt={`${product.nama} ${idx + 1}`} className="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contiguous Purchase Module Right */}
          <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                <span>{catName}</span>
                <span aria-hidden="true">·</span>
                <span className="text-teal-800 font-semibold">Stok Kios</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Terjual {product.jumlah_terjual}</span>
              </div>
              <h1 className="text-2xl font-display font-bold text-zinc-900 mt-1.5">
                {product.nama}
              </h1>
              <div className="mt-3 text-2xl font-bold text-zinc-900 tabular-nums">
                {formatRupiah(effectivePrice)}
              </div>
            </div>

            {/* Availability info */}
            <div className="p-3.5 rounded-lg bg-stone-50 border border-zinc-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Ketersediaan Stok Kios</span>
                <span className={`font-semibold tabular-nums ${effectiveStock <= 0 ? 'text-rose-700' : 'text-zinc-900'}`}>
                  {effectiveStock <= 0 ? 'Stok Habis' : `${effectiveStock} unit tersedia`}
                </span>
              </div>
            </div>

            {/* Variant selector */}
            {product.varian.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-700 mb-2">Pilih Varian</div>
                <div className="flex flex-wrap gap-2">
                  {product.varian
                    .filter((v) => v.aktif)
                    .map((v) => {
                      const vOos = (v.stok ?? 0) <= 0;
                      const isSel = selectedVariantId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVariantId(v.id);
                            setDetailQty(1);
                          }}
                          className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                            isSel
                              ? 'border-teal-800 bg-teal-50 text-teal-900 font-semibold'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                          } ${vOos ? 'opacity-60' : ''}`}
                        >
                          {v.nama_varian}
                          {product.tipe === 'Stok Sendiri' && ` (${v.stok ?? 0})`}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Quantity Stepper */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-zinc-700">Jumlah</span>
              <div className="inline-flex items-center border border-zinc-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-zinc-900 disabled:opacity-30"
                  disabled={detailQty <= 1}
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">
                  {detailQty}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (product.tipe === 'Stok Sendiri' && detailQty >= effectiveStock) {
                      showToast('info', `Stok maksimal tersedia adalah ${effectiveStock}.`);
                      return;
                    }
                    setDetailQty((q) => q + 1);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-zinc-900"
                  aria-label="Tambah jumlah"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Primary CTAs */}
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
                className="px-4 py-3 text-sm font-semibold rounded-lg border border-teal-800 text-teal-900 hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isOutOfStock ? 'Stok Habis' : 'Tambah ke Keranjang'}
              </button>
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleBuyNow}
                className="px-4 py-3 text-sm font-semibold rounded-lg bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isOutOfStock ? 'Stok Habis' : 'Beli Sekarang'}
              </button>
            </div>
          </div>
        </div>

        {/* Deskripsi & Ulasan Tabs */}
        <div className="mt-12 bg-white border border-zinc-200 rounded-xl p-6">
          <div className="flex items-center gap-6 border-b border-zinc-200 mb-6">
            <button
              type="button"
              onClick={() => setDetailTab('deskripsi')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                detailTab === 'deskripsi'
                  ? 'border-teal-800 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Deskripsi Produk
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('ulasan')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors tabular-nums ${
                detailTab === 'ulasan'
                  ? 'border-teal-800 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Ulasan Pembeli ({productReviews.length})
            </button>
          </div>

          {detailTab === 'deskripsi' ? (
            <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-line">
              {product.deskripsi || 'Tidak ada deskripsi tambahan.'}
            </div>
          ) : productReviews.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              Belum ada ulasan untuk produk ini.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {productReviews.map((rev) => (
                <div key={rev.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900">{rev.nama_pembeli}</span>
                    <span className="text-xs text-zinc-400">{formatTanggal(rev.dibuat_pada)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300'
                        }`}
                      />
                    ))}
                  </div>
                  {rev.komentar && <p className="text-sm text-zinc-700 mt-2">{rev.komentar}</p>}
                  {rev.fotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {rev.fotos.map((f) => (
                        <img
                          key={f.id}
                          src={f.url}
                          alt="Foto ulasan"
                          className="w-16 h-16 object-cover rounded-lg border border-zinc-200"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Produk Terkait */}
        {relatedProducts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-display font-semibold text-zinc-900 mb-4">Produk Terkait</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {relatedProducts.map((p) => renderProductCard(p))}
            </div>
          </section>
        )}

        {/* Fullscreen Lightbox (No 115) */}
        {lightboxOpen && photos.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-5 right-5 p-2 text-white/80 hover:text-white bg-white/10 rounded-full"
              aria-label="Tutup foto besar"
            >
              <X className="w-6 h-6" />
            </button>
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setActivePhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="p-3 text-white/80 hover:text-white bg-white/10 rounded-full mr-4"
                aria-label="Foto sebelumnya"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <img
              src={photos[activePhotoIdx]?.url}
              alt={product.nama}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
            />
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setActivePhotoIdx((i) => (i + 1) % photos.length)}
                className="p-3 text-white/80 hover:text-white bg-white/10 rounded-full ml-4"
                aria-label="Foto berikutnya"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderKeranjang = () => {
    if (!buyer) return null;
    const enriched = cart.map((c) => {
      const p = allProdukRef.find((pr) => pr.id === c.produk_id) || null;
      const v = p && c.varian_id ? p.varian.find((vr) => vr.id === c.varian_id) || null : null;
      const isAvail = Boolean(
        p &&
          p.aktif &&
          !p.dihapus_pada &&
          (!c.varian_id || (v && v.aktif))
      );
      const maxStock = p ? getProductEffectiveStock(p, v) : 0;
      const stockInsufficient = isAvail && c.jumlah > maxStock;
      const price = p ? getProductEffectivePrice(p, v) : 0;
      return { item: c, product: p, variant: v, isAvail, maxStock, stockInsufficient, price };
    });

    const selectedItems = enriched.filter((e) => e.item.dipilih && e.isAvail);
    const subtotal = selectedItems.reduce((sum, e) => sum + e.price * e.item.jumlah, 0);
    const allAvailChecked =
      enriched.some((e) => e.isAvail) &&
      enriched.filter((e) => e.isAvail).every((e) => e.item.dipilih);
    const hasStockProblem = selectedItems.some((e) => e.stockInsufficient || e.maxStock <= 0);

    return (
      <div className={APP_UI.buyerWide}>
        <PageHeader
          title="Keranjang Belanja"
          subtitle={<span className="tabular-nums">{enriched.length} item di keranjang</span>}
          backLabel="Belanja"
          onBack={() => setPage('daftar-produk')}
        />

        {enriched.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
            <ShoppingBag className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-zinc-900">Keranjang Anda masih kosong</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-5">
              Tambahkan produk kebutuhan harian ke keranjang untuk melanjutkan ke checkout COD.
            </p>
            <button
              type="button"
              onClick={() => setPage('daftar-produk')}
              className="px-5 py-2.5 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Mulai Belanja
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200">
              <div className="px-5 py-3.5 flex items-center justify-between">
                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allAvailChecked}
                    onChange={async (e) => {
                      await api.selectAllCart(buyer.id, e.target.checked);
                      await onRefreshBuyer();
                    }}
                    className="w-4 h-4 accent-teal-800 rounded"
                  />
                  Pilih Semua ({enriched.filter((e) => e.isAvail).length})
                </label>
              </div>

              {enriched.map(({ item, product, variant, isAvail, maxStock, stockInsufficient, price }) => {
                const thumb = product ? [...product.foto].sort((a, b) => a.urutan - b.urutan)[0]?.url : undefined;
                return (
                  <div key={item.id} className="p-5 flex gap-4 items-start">
                    <input
                      type="checkbox"
                      disabled={!isAvail}
                      checked={isAvail && item.dipilih}
                      onChange={async (e) => {
                        await api.updateCartItem(item.id, {
                          pembeliId: buyer.id,
                          dipilih: e.target.checked,
                        });
                        await onRefreshBuyer();
                      }}
                      className="mt-2 w-4 h-4 accent-teal-800 rounded disabled:opacity-40"
                    />
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                      <ProductImage src={thumb} alt={product?.nama || 'Produk'} className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => product && openProductDetail(product.id)}
                            className="text-sm font-semibold text-zinc-900 hover:text-teal-800 text-left"
                          >
                            {product?.nama || 'Produk Tidak Tersedia'}
                          </button>
                          {variant && (
                            <div className="text-xs text-zinc-500 mt-0.5">{variant.nama_varian}</div>
                          )}
                          <div className="text-xs text-zinc-500 mt-0.5">
                            Stok Kios · Tersedia {maxStock} unit
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.removeCartItem(item.id, buyer.id);
                            await onRefreshBuyer();
                          }}
                          className="text-zinc-400 hover:text-rose-700 p-1"
                          aria-label="Hapus Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {!isAvail && (
                        <div className="mt-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded">
                          Tidak Tersedia — Produk telah dinonaktifkan atau dihapus penjual.
                        </div>
                      )}
                      {stockInsufficient && (
                        <div className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded">
                          Stok tidak cukup (tersisa {maxStock}). Kurangi jumlah untuk melanjutkan.
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                          {formatRupiah(price)}
                        </span>
                        {isAvail && (
                          <div className="inline-flex items-center border border-zinc-300 rounded-lg">
                            <button
                              type="button"
                              onClick={async () => {
                                if (item.jumlah <= 1) {
                                  showToast('info', 'Jumlah minimal 1. Gunakan tombol hapus untuk menghapus item.');
                                  return;
                                }
                                await api.updateCartItem(item.id, {
                                  pembeliId: buyer.id,
                                  jumlah: item.jumlah - 1,
                                });
                                await onRefreshBuyer();
                              }}
                              className="min-w-[38px] min-h-[38px] flex items-center justify-center text-zinc-600 hover:text-zinc-900"
                              aria-label="Kurangi"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold tabular-nums">
                              {item.jumlah}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (item.jumlah >= maxStock) {
                                  showToast('info', `Stok maksimal tersedia ${maxStock}.`);
                                  return;
                                }
                                await api.updateCartItem(item.id, {
                                  pembeliId: buyer.id,
                                  jumlah: item.jumlah + 1,
                                });
                                await onRefreshBuyer();
                              }}
                              className="min-w-[38px] min-h-[38px] flex items-center justify-center text-zinc-600 hover:text-zinc-900"
                              aria-label="Tambah"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-zinc-900">Ringkasan Belanja</h2>
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Item terpilih</span>
                <span className="tabular-nums font-medium">{selectedItems.length} item</span>
              </div>
              <div className="flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatRupiah(subtotal)}</span>
              </div>
              <button
                type="button"
                disabled={selectedItems.length === 0 || hasStockProblem}
                onClick={() => startCheckout(null)}
                className="w-full py-3 text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Checkout ({selectedItems.length})
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCheckout = () => {
    if (!buyer) return null;

    const sourceList = buyNowItem
      ? [buyNowItem]
      : cart
          .filter((c) => c.dipilih)
          .map((c) => ({ produk_id: c.produk_id, varian_id: c.varian_id, jumlah: c.jumlah }));

    const resolvedItems = sourceList
      .map((s) => {
        const p = produk.find((pr) => pr.id === s.produk_id);
        if (!p) return null;
        const v = s.varian_id ? p.varian.find((vr) => vr.id === s.varian_id && vr.aktif) || null : null;
        return {
          product: p,
          variant: v,
          jumlah: s.jumlah,
          price: getProductEffectivePrice(p, v),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.jumlah, 0);

    const activeAddr =
      addresses.find((a) => a.id === checkoutAddressId) ||
      addresses.find((a) => {
        const d = getAddressDistanceKm(a);
        return a.is_utama && d !== null && isAddressWithinRadius(d, tarifOngkir);
      }) ||
      addresses.find((a) => {
        const d = getAddressDistanceKm(a);
        return d !== null && isAddressWithinRadius(d, tarifOngkir);
      }) ||
      addresses[0] ||
      null;
    const activeDistanceKm = getAddressDistanceKm(activeAddr);
    const activeWithinRadius =
      activeDistanceKm !== null && isAddressWithinRadius(activeDistanceKm, tarifOngkir);
    const ongkir =
      activeDistanceKm !== null
        ? calculateDistanceShipping(subtotal, activeDistanceKm, tarifOngkir)
        : 0;
    const totalCod = subtotal + ongkir;

    const availableSlots = getAvailableDeliverySlots(jadwalAntar, 0);
    const firstSlotKey = availableSlots[0]
      ? `${availableSlots[0].dateStr}|${availableSlots[0].jam_antar}`
      : '';
    const effectiveSlotKey =
      selectedSlotKey && availableSlots.some((s) => `${s.dateStr}|${s.jam_antar}` === selectedSlotKey)
        ? selectedSlotKey
        : firstSlotKey;

    const handlePlaceOrder = async () => {
      if (placingOrder) return;
      setCheckoutBannerError(null);
      if (resolvedItems.length === 0) {
        const msg = 'Tidak ada item yang dipilih untuk checkout.';
        setCheckoutBannerError(msg);
        showToast('error', msg);
        return;
      }
      if (!activeAddr || activeDistanceKm === null) {
        const msg = 'Pin lokasi Google Maps pada alamat belum ditentukan. Ubah atau lengkapi alamat terlebih dahulu.';
        setCheckoutBannerError(msg);
        showToast('error', msg);
        return;
      }
      if (!activeWithinRadius) {
        const msg = `Alamat berjarak ${activeDistanceKm.toFixed(1)} km (melebihi batas radius ${tarifOngkir.batas_radius_km} km). Pilih alamat lain.`;
        setCheckoutBannerError(msg);
        showToast('error', msg);
        return;
      }
      if (!effectiveSlotKey) {
        const msg = 'Jadwal pengantaran belum tersedia saat ini.';
        setCheckoutBannerError(msg);
        showToast('error', msg);
        return;
      }
      const [tanggal_antar, jam_antar] = effectiveSlotKey.split('|');

      setPlacingOrder(true);
      try {
        const res = await api.createOrder({
          pembeliId: buyer.id,
          alamatId: activeAddr.id,
          tanggal_antar,
          jam_antar,
          catatan_pembeli: catatanPenjual,
          expectedOngkir: ongkir,
          buyNowItem,
        });
        setLastCreatedOrder(res.pesanan);
        setBuyNowItem(null);
        setCatatanPenjual('');
        setSelectedSlotKey('');
        await Promise.all([onRefreshBuyer(), onRefreshPublic()]);
        showToast('success', `Pesanan ${res.pesanan.nomor_pesanan} berhasil dibuat!`);
        setPage('pesanan-berhasil');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        const msg = e.message || 'Gagal membuat pesanan.';
        if (
          e.code === 'ONGKIR_CHANGED' ||
          e.code === 'OUT_OF_RADIUS' ||
          e.code === 'ADDRESS_PIN_MISSING' ||
          e.code === 'SCHEDULE_INVALID'
        ) {
          await onRefreshPublic();
          setCheckoutBannerError(msg);
          showToast('error', msg);
          return;
        }
        if (e.code === 'STOCK_INSUFFICIENT' || e.code === 'ITEM_UNAVAILABLE') {
          showToast('error', msg);
          await onRefreshPublic();
          await onRefreshBuyer();
          setPage('keranjang');
          return;
        }
        setCheckoutBannerError(msg);
        showToast('error', msg);
      } finally {
        setPlacingOrder(false);
      }
    };

    return (
      <div className={APP_UI.buyerWide}>
        <PageHeader
          title="Checkout Pesanan (COD)"
          subtitle={
            <span className="tabular-nums">{resolvedItems.length} item · Bayar tunai saat barang diterima</span>
          }
          backLabel="Kembali"
          onBack={() => setPage(buyNowItem ? 'detail-produk' : 'keranjang')}
        />

        {checkoutBannerError && (
          <div className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-xs sm:text-sm font-medium text-rose-800">
            {checkoutBannerError}
          </div>
        )}

        {/* Balanced 2-Column Workspace — Full Data Visible */}
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Address + Delivery Schedule & Note */}
          <div className="lg:col-span-7 space-y-4">
            {/* Alamat Pengantaran + Google Maps Route Pin */}
            <div className={`${APP_UI.card} space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900">Alamat Pengantaran &amp; Pin Peta</h2>
                <button
                  type="button"
                  onClick={() => setPage('pilih-alamat')}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors shrink-0"
                >
                  Ubah Alamat
                </button>
              </div>
              {activeAddr && activeDistanceKm !== null ? (
                <>
                  <div className="text-xs sm:text-sm text-zinc-700 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-zinc-900">{activeAddr.nama_penerima}</span>
                      <span aria-hidden="true" className="text-zinc-300">·</span>
                      <span className="font-mono text-zinc-700">{activeAddr.no_telepon}</span>
                      <span aria-hidden="true" className="text-zinc-300">·</span>
                      <span
                        className={`font-medium ${
                          activeWithinRadius ? 'text-teal-800' : 'text-rose-700'
                        }`}
                      >
                        {activeAddr.nama_wilayah} · {activeDistanceKm.toFixed(1)} km (
                        {activeWithinRadius
                          ? ongkir === 0
                            ? 'Gratis Ongkir'
                            : `Ongkir ${formatRupiah(ongkir)}`
                          : `Di luar radius ${tarifOngkir.batas_radius_km} km`}
                        )
                      </span>
                    </div>
                    <div className="text-zinc-600 leading-relaxed">
                      {activeAddr.alamat_lengkap}
                      {activeAddr.patokan ? ` · Patokan: ${activeAddr.patokan}` : ''}
                    </div>
                  </div>
                  {typeof activeAddr.lat === 'number' && typeof activeAddr.lng === 'number' && (
                    <DeliveryRoutePreviewMap
                      mapsAvailable={mapsAvailable}
                      origin={{ lat: toko.lat, lng: toko.lng }}
                      destination={{ lat: activeAddr.lat, lng: activeAddr.lng }}
                      kioskLabel={toko.nama_toko}
                      destinationLabel={activeAddr.nama_penerima}
                      heightClass="h-[160px]"
                    />
                  )}
                </>
              ) : (
                <div className="text-xs sm:text-sm text-rose-700">
                  Alamat pengantaran belum memiliki pin lokasi Google Maps.{' '}
                  <button
                    type="button"
                    onClick={() => setPage('pilih-alamat')}
                    className="underline font-semibold"
                  >
                    Pilih atau Pin Alamat
                  </button>
                </div>
              )}
            </div>

            {/* Jadwal Antar & Catatan */}
            <div className={`${APP_UI.card} space-y-4`}>
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Pilih Jadwal Antar</h2>
                  <span className="text-xs text-zinc-500">
                    Sesuai jam operasional &amp; estimasi pesanan
                  </span>
                </div>

                {availableSlots.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    Jadwal pengantaran belum tersedia saat ini.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {availableSlots.map((slot) => {
                      const key = `${slot.dateStr}|${slot.jam_antar}`;
                      const isSel = effectiveSlotKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedSlotKey(key)}
                          className={`text-left px-3.5 py-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 min-h-[54px] ${
                            isSel
                              ? 'border-teal-800 bg-teal-50/90 text-teal-950 font-semibold'
                              : 'border-zinc-200 hover:border-zinc-400 text-zinc-700 bg-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="leading-snug">{slot.label}</div>
                            <div className="text-[11px] text-zinc-500 font-normal mt-0.5">
                              Batas pesan: {slot.jam_batas_pesan}
                            </div>
                          </div>
                          <span
                            aria-hidden="true"
                            className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                              isSel ? 'border-teal-800 bg-teal-800' : 'border-zinc-300 bg-white'
                            }`}
                          >
                            {isSel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100">
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Catatan untuk Penjual (Opsional)
                </label>
                <input
                  type="text"
                  value={catatanPenjual}
                  onChange={(e) => setCatatanPenjual(e.target.value)}
                  placeholder="Contoh: Tolong hubungi WhatsApp saat kurir berangkat..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Unified Order Items + COD Summary & Primary CTA */}
          <div className="lg:col-span-5">
            <div className={`${APP_UI.card} space-y-4`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">Rincian Barang &amp; Tagihan COD</h2>
                <span className="text-xs text-zinc-500 tabular-nums">{resolvedItems.length} item</span>
              </div>

              <div className="divide-y divide-zinc-100">
                {resolvedItems.map((item, idx) => (
                  <div key={idx} className="py-3 first:pt-0 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                        <ProductImage
                          src={[...item.product.foto].sort((a, b) => a.urutan - b.urutan)[0]?.url}
                          alt={item.product.nama}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openProductDetail(item.product.id)}
                          className="text-xs sm:text-sm font-semibold text-zinc-900 hover:text-teal-800 text-left block"
                        >
                          {item.product.nama}
                        </button>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {item.variant ? `${item.variant.nama_varian} · ` : ''}
                          {item.jumlah} × {formatRupiah(item.price)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-900 tabular-nums shrink-0">
                      {formatRupiah(item.price * item.jumlah)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3.5 border-t border-zinc-200 space-y-3">
                <div className="space-y-1.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal Produk</span>
                    <span className="tabular-nums">{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>
                      Ongkos Kirim
                      {activeDistanceKm !== null ? ` (${activeDistanceKm.toFixed(1)} km)` : ''}
                    </span>
                    <span className="tabular-nums">
                      {activeDistanceKm !== null && activeWithinRadius
                        ? ongkir === 0
                          ? 'Gratis (Rp0)'
                          : formatRupiah(ongkir)
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-100">
                    <span>Total Bayar COD</span>
                    <span className="tabular-nums text-teal-900">{formatRupiah(totalCod)}</span>
                  </div>
                </div>

                <div className={APP_UI.cardSubtle}>
                  <p className="text-xs leading-relaxed text-zinc-600">
                    Bayar tunai (COD) saat barang diterima. Siapkan uang pas{' '}
                    <span className="font-semibold text-zinc-900 tabular-nums">{formatRupiah(totalCod)}</span>.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={placingOrder || availableSlots.length === 0 || resolvedItems.length === 0}
                  onClick={handlePlaceOrder}
                  className={`${APP_UI.btnPrimary} w-full min-h-[46px]`}
                >
                  {placingOrder
                    ? 'Memproses Pesanan...'
                    : `Buat Pesanan · ${formatRupiah(totalCod)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPilihAlamat = () => {
    if (!buyer) return null;
    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Pilih Alamat Pengantaran"
          backLabel="Checkout"
          onBack={() => setPage('checkout')}
          rightSlot={
            <button
              type="button"
              onClick={() => openAddressForm(null, 'pilih-alamat')}
              className={APP_UI.btnPrimary}
            >
              + Tambah Alamat Baru
            </button>
          }
        />

        <div className="space-y-3">
          {addresses.map((addr) => {
            const distKm = getAddressDistanceKm(addr);
            const withinRadius =
              distKm !== null && isAddressWithinRadius(distKm, tarifOngkir);
            const estOngkir =
              distKm !== null ? calculateDistanceShipping(0, distKm, tarifOngkir) : 0;
            return (
              <div
                key={addr.id}
                className={`${APP_UI.card} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span>{addr.nama_penerima}</span>
                    {addr.is_utama && (
                      <span className="text-xs font-medium text-teal-800">· Alamat Utama</span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-zinc-600">{addr.no_telepon}</div>
                  <div className="text-sm text-zinc-700">{addr.alamat_lengkap}</div>
                  <div className="text-xs">
                    {distKm === null ? (
                      <span className="text-amber-800 font-medium">
                        {addr.nama_wilayah} · Pin Google Maps belum diatur (klik Edit)
                      </span>
                    ) : withinRadius ? (
                      <span className="text-teal-800 font-medium">
                        {addr.nama_wilayah} · {distKm.toFixed(1)} km · Ongkir mulai {formatRupiah(estOngkir)}
                      </span>
                    ) : (
                      <span className="text-rose-700 font-medium">
                        {addr.nama_wilayah} · {distKm.toFixed(1)} km (Melebihi radius maks{' '}
                        {tarifOngkir.batas_radius_km} km)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openAddressForm(addr, 'pilih-alamat')}
                    className={APP_UI.btnSecondary}
                  >
                    Edit Pin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (distKm === null) {
                        showToast('error', 'Pin lokasi Google Maps belum diatur. Klik Edit Pin terlebih dahulu.');
                        return;
                      }
                      if (!withinRadius) {
                        showToast(
                          'error',
                          `Alamat (${distKm.toFixed(1)} km) melebihi radius pengantaran ${tarifOngkir.batas_radius_km} km.`
                        );
                        return;
                      }
                      setCheckoutAddressId(addr.id);
                      setPage('checkout');
                    }}
                    className={withinRadius ? APP_UI.btnPrimary : APP_UI.btnSecondary}
                  >
                    Pilih
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFormAlamat = () => {
    if (!buyer) return null;

    const checkoutSampleSubtotal =
      addressReturnPage === 'checkout'
        ? (buyNowItem
            ? [buyNowItem]
            : cart
                .filter((c) => c.dipilih)
                .map((c) => ({ produk_id: c.produk_id, varian_id: c.varian_id, jumlah: c.jumlah }))
          ).reduce((sum, s) => {
            const p = produk.find((pr) => pr.id === s.produk_id);
            if (!p) return sum;
            const v = s.varian_id ? p.varian.find((vr) => vr.id === s.varian_id && vr.aktif) || null : null;
            return sum + getProductEffectivePrice(p, v) * s.jumlah;
          }, 0)
        : 0;

    const handleMapValueChange = (next: AddressMapValue) => {
      setAddrForm((prev) => ({
        ...prev,
        alamat_lengkap: next.alamat_lengkap,
        nama_wilayah: next.nama_wilayah,
        lat: next.lat,
        lng: next.lng,
        jarak_km: next.jarak_km,
      }));
    };

    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setAddrError(null);
      if (addrForm.lat === null || addrForm.lng === null) {
        setAddrError(
          'Pin lokasi pada Google Maps belum muncul. Masukkan alamat atau klik langsung pada peta untuk menandai titik pengantaran.'
        );
        return;
      }
      try {
        let saved: Alamat;
        const payload = {
          pembeliId: buyer.id,
          nama_penerima: addrForm.nama_penerima,
          no_telepon: addrForm.no_telepon,
          nama_wilayah: addrForm.nama_wilayah || 'Lokasi Terpin',
          alamat_lengkap: addrForm.alamat_lengkap,
          patokan: addrForm.patokan,
          lat: addrForm.lat,
          lng: addrForm.lng,
          jarak_km: addrForm.jarak_km,
        };
        if (editingAddress) {
          const r = await api.updateAddress(editingAddress.id, payload);
          saved = r.alamat;
        } else {
          const r = await api.createAddress(payload);
          saved = r.alamat;
        }
        await onRefreshBuyer();
        showToast('success', 'Alamat dan pin Google Maps berhasil disimpan.');

        if (addressReturnPage === 'checkout') {
          const savedDist = getAddressDistanceKm(saved);
          if (savedDist !== null && isAddressWithinRadius(savedDist, tarifOngkir)) {
            setCheckoutAddressId(saved.id);
            setPage('checkout');
          } else {
            showToast(
              'info',
              `Alamat berjarak ${savedDist?.toFixed(1) ?? '?'} km (di luar radius ${tarifOngkir.batas_radius_km} km). Pilih alamat dalam jangkauan.`
            );
            setPage('pilih-alamat');
          }
        } else {
          setPage(addressReturnPage);
        }
      } catch (err: unknown) {
        setAddrError(err instanceof Error ? err.message : 'Gagal menyimpan alamat.');
      }
    };

    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title={editingAddress ? 'Edit Alamat & Pin Peta' : 'Tambah Alamat & Pin Google Maps'}
          backLabel="Kembali"
          onBack={() => setPage(addressReturnPage)}
        />

        <form onSubmit={handleSave} className={`${APP_UI.card} space-y-4`}>
          {addrError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {addrError}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nama Penerima *</label>
              <input
                type="text"
                value={addrForm.nama_penerima}
                onChange={(e) => setAddrForm({ ...addrForm, nama_penerima: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Nomor Telepon / WhatsApp *
              </label>
              <input
                type="tel"
                value={addrForm.no_telepon}
                onChange={(e) => setAddrForm({ ...addrForm, no_telepon: e.target.value })}
                placeholder="6281234567890"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <AddressMapPicker
            mode="buyer"
            mapsAvailable={mapsAvailable}
            kioskLocation={{ lat: toko.lat, lng: toko.lng, alamat_kios: toko.alamat_kios }}
            kioskName={toko.nama_toko}
            tarifOngkir={tarifOngkir}
            sampleSubtotal={checkoutSampleSubtotal}
            value={{
              alamat_lengkap: addrForm.alamat_lengkap,
              nama_wilayah: addrForm.nama_wilayah,
              lat: addrForm.lat,
              lng: addrForm.lng,
              jarak_km: addrForm.jarak_km,
            }}
            onChange={handleMapValueChange}
          />

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Patokan (Opsional)</label>
            <input
              type="text"
              value={addrForm.patokan}
              onChange={(e) => setAddrForm({ ...addrForm, patokan: e.target.value })}
              placeholder="Mis. Sebelah warung / pagar hijau"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setPage(addressReturnPage)}
              className="px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Simpan Alamat &amp; Pin
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderPesananBerhasil = () => {
    const ord = lastCreatedOrder || orders[0];
    if (!ord) return null;
    return (
      <div className={APP_UI.buyerFocused}>
        <div className="max-w-xl mx-auto bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-zinc-900">
              Pesanan Berhasil Dibuat
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600">
              Pesanan Anda sedang menunggu konfirmasi penjual. Pembayaran COD dilakukan saat barang diterima.
            </p>
          </div>

          <div className={`${APP_UI.cardSubtle} text-left text-xs sm:text-sm space-y-2`}>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Nomor Pesanan</span>
              <span className="font-mono font-semibold text-zinc-900">{ord.nomor_pesanan}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Penerima &amp; Jarak</span>
              <span className="font-medium text-zinc-900 text-right">
                {ord.nama_penerima} · {ord.nama_wilayah}
                {ord.jarak_km ? ` (${ord.jarak_km.toFixed(1)} km)` : ''}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Jadwal Antar</span>
              <span className="font-medium text-zinc-900 text-right">
                {ord.tanggal_antar} · {ord.jam_antar}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-zinc-200">
              <span className="text-zinc-700 font-medium">Total COD Disiapkan</span>
              <span className="font-bold text-teal-900 tabular-nums">{formatRupiah(ord.total_cod)}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setSelectedOrderId(ord.id);
                setPage('detail-pesanan');
              }}
              className={APP_UI.btnSecondary}
            >
              Lihat Detail Pesanan
            </button>
            <button
              type="button"
              onClick={() => setPage('beranda')}
              className={APP_UI.btnPrimary}
            >
              Lanjut Belanja
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOrderActions = (ord: Pesanan, showDetailLink = false) => {
    const orderReturn =
      returns.find((r) => r.pesanan_id === ord.id && r.status !== 'Dibatalkan') ||
      returns.find((r) => r.pesanan_id === ord.id);
    const hasActiveReturn = returns.some(
      (r) => r.pesanan_id === ord.id && (r.status === 'Menunggu' || r.status === 'Disetujui')
    );
    const inReturnWindow = isWithinReturnWindow(ord.selesai_pada, pengaturan.batas_waktu_retur_hari);
    const unreviewedItems = ord.items.filter(
      (item) => !ulasan.some((u) => u.pesanan_id === ord.id && u.produk_id === item.produk_id)
    );

    const waUrl = buildWhatsAppUrl(
      toko.no_whatsapp,
      `Halo ${toko.nama_toko}, saya ingin menanyakan pesanan ${ord.nomor_pesanan}.`
    );

    return (
      <div className="flex flex-wrap items-center gap-2">
        {showDetailLink && (
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(ord.id);
              setPage('detail-pesanan');
            }}
            className={APP_UI.btnSecondary}
          >
            Lihat Detail
          </button>
        )}

        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className={APP_UI.btnSecondary}
        >
          <WhatsAppIcon className="w-4 h-4 shrink-0" />
          Hubungi Penjual
        </a>

        {ord.status === 'Baru' && (
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(ord.id);
              setCancelOrderConfirmOpen(true);
            }}
            className={APP_UI.btnDanger}
          >
            Batalkan Pesanan
          </button>
        )}

        {(ord.status === 'Diproses' || ord.status === 'Siap Diantar' || ord.status === 'Diantar') && (
          <button
            type="button"
            disabled
            title="Hubungi penjual lewat WhatsApp untuk pembatalan pesanan yang sudah diproses"
            className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold bg-zinc-200 text-zinc-500 rounded-lg cursor-not-allowed whitespace-nowrap"
          >
            Batal (Hubungi Penjual)
          </button>
        )}

        {ord.status === 'Selesai' && (
          <>
            <button
              type="button"
              onClick={async () => {
                const res = await api.reorderBuyerOrder(ord.id, buyer!.id);
                await onRefreshBuyer();
                if (res.skipped.length > 0) {
                  showToast(
                    'info',
                    `${res.addedCount} item ditambahkan. Dilewati: ${res.skipped.join(', ')}`
                  );
                } else {
                  showToast('success', 'Item pesanan dimasukkan kembali ke keranjang.');
                }
                setPage('keranjang');
              }}
              className={APP_UI.btnPrimary}
            >
              Beli Lagi
            </button>

            {unreviewedItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderId(ord.id);
                  setReviewTargetProductId(unreviewedItems[0].produk_id);
                  setReviewRating(0);
                  setReviewComment('');
                  setReviewPhotos([]);
                  setReviewError(null);
                  setPage('form-ulasan');
                }}
                className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold border border-teal-800 text-teal-900 rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap"
              >
                Beri Ulasan ({unreviewedItems.length})
              </button>
            )}

            {orderReturn && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderId(ord.id);
                  setSelectedReturnId(orderReturn.id);
                  setPage('status-retur');
                }}
                className={APP_UI.btnSecondary}
              >
                Status Retur
              </button>
            )}

            {!hasActiveReturn && (
              <button
                type="button"
                disabled={!inReturnWindow}
                onClick={() => {
                  setSelectedOrderId(ord.id);
                  setReturnReason('barang_rusak');
                  setReturnNote('');
                  setReturnPhotos([]);
                  setReturnError(null);
                  setPage('form-retur');
                }}
                className={APP_UI.btnSecondary}
              >
                {inReturnWindow ? 'Ajukan Retur' : 'Retur Ditutup'}
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderOrderDetailBody = (ord: Pesanan) => (
    <div className="grid lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Banners, Complete Recipient & Schedule Info, Full Item List */}
      <div className="lg:col-span-7 space-y-4">
        {ord.status === 'Dibatalkan' && ord.alasan_batal && (
          <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800">
            <span className="font-semibold">Alasan Pembatalan:</span> {ord.alasan_batal}
          </div>
        )}
        {ord.status === 'Diantar' && (
          <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs sm:text-sm text-indigo-900">
            Kurir sedang mengantar pesanan Anda. Harap siapkan uang pas COD sebesar{' '}
            <span className="font-bold tabular-nums">{formatRupiah(ord.total_cod)}</span>.
          </div>
        )}

        <div className={`${APP_UI.card} space-y-3 text-xs sm:text-sm`}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500">Penerima &amp; Alamat Antar</div>
              <div className="font-semibold text-zinc-900">{ord.nama_penerima}</div>
              <div className="font-mono text-xs text-zinc-600">{ord.no_telepon_penerima}</div>
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
              heightClass="h-[160px]"
            />
          )}
        </div>

        <div className={`${APP_UI.card} space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Item Pesanan</h2>
            <span className="text-xs text-zinc-500 tabular-nums">{ord.items.length} item</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {ord.items.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                    <ProductImage src={item.foto_url} alt={item.nama_produk} className="w-full h-full" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => openProductDetail(item.produk_id)}
                      className="text-sm font-semibold text-zinc-900 hover:text-teal-800 text-left block"
                    >
                      {item.nama_produk}
                    </button>
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
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Payment Summary, Actions & Complete Status History */}
      <div className="lg:col-span-5 space-y-4">
        <div className={`${APP_UI.card} space-y-4`}>
          <h2 className="text-sm font-semibold text-zinc-900">Ringkasan Pembayaran COD</h2>
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
              <span>Total COD</span>
              <span className="tabular-nums text-teal-900">{formatRupiah(ord.total_cod)}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100">{renderOrderActions(ord)}</div>
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
  );

  const renderPesananSaya = () => {
    if (!buyer) return null;
    const tabs: Array<typeof orderStatusTab> = [
      'Semua',
      'Menunggu Konfirmasi',
      'Diproses',
      'Diantar',
      'Selesai',
      'Dibatalkan',
    ];

    const filteredOrders = orders.filter((o) => {
      if (orderStatusTab === 'Semua') return true;
      if (orderStatusTab === 'Menunggu Konfirmasi') return o.status === 'Baru';
      if (orderStatusTab === 'Diproses') return o.status === 'Diproses' || o.status === 'Siap Diantar';
      return o.status === orderStatusTab;
    });

    const modalOrder = orders.find((o) => o.id === selectedOrderId) || null;

    return (
      <div className={APP_UI.buyerWide}>
        <PageHeader
          title="Pesanan Saya"
          subtitle={<span className="tabular-nums">{filteredOrders.length} pesanan ditampilkan</span>}
          backLabel="Beranda"
          onBack={() => setPage('beranda')}
          rightSlot={
            <button
              type="button"
              onClick={() => setPage('daftar-produk')}
              className={APP_UI.btnSecondary}
            >
              Belanja Produk
            </button>
          }
        />

        {/* Status Filter Bar */}
        <div className={APP_UI.tabBar}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOrderStatusTab(tab)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                orderStatusTab === tab
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-8 sm:p-10 text-center space-y-3">
            <Package className="w-10 h-10 text-zinc-400 mx-auto" />
            <h3 className="text-base font-semibold text-zinc-900">Belum ada pesanan pada status ini</h3>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
              Mulai belanja produk kebutuhan harian untuk membuat pesanan COD pertama Anda.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setPage('daftar-produk')}
                className={APP_UI.btnPrimary}
              >
                Mulai Belanja
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((ord) => (
              <article key={ord.id} className={`${APP_UI.card} space-y-4`}>
                {/* Band 1: Order Number, Created Timestamp, Status & Payment */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-sm sm:text-base font-bold text-zinc-900">
                      {ord.nomor_pesanan}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span className="text-xs text-zinc-500">
                      Dibuat {formatTanggalWaktu(ord.dibuat_pada)}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span className="text-xs text-zinc-600">
                      Pembayaran: <strong className="text-zinc-900">{ord.status_pembayaran}</strong>
                    </span>
                  </div>
                  <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="buyer" />
                </div>

                {/* Status Callout (if cancelled or out for delivery) */}
                {ord.status === 'Dibatalkan' && ord.alasan_batal && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    <span className="font-semibold">Alasan Pembatalan:</span> {ord.alasan_batal}
                  </div>
                )}
                {ord.status === 'Diantar' && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                    Kurir sedang mengantar pesanan Anda. Siapkan uang pas COD{' '}
                    <span className="font-bold tabular-nums">{formatRupiah(ord.total_cod)}</span>.
                  </div>
                )}

                {/* Band 2: Full Items + Full Recipient/Delivery Info Side by Side on Desktop */}
                <div className="grid lg:grid-cols-12 gap-4 items-start">
                  {/* All Items Listed Clearly */}
                  <div className="lg:col-span-7 divide-y divide-zinc-100">
                    {ord.items.map((item) => (
                      <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-zinc-200 shrink-0">
                            <ProductImage src={item.foto_url} alt={item.nama_produk} className="w-full h-full" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <button
                              type="button"
                              onClick={() => openProductDetail(item.produk_id)}
                              className="text-xs sm:text-sm font-semibold text-zinc-900 hover:text-teal-800 text-left block"
                            >
                              {item.nama_produk}
                            </button>
                            <div className="text-xs text-zinc-500">
                              {item.nama_varian ? `${item.nama_varian} · ` : ''}
                              {item.jumlah} × {formatRupiah(item.harga_satuan)}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-zinc-900 tabular-nums shrink-0">
                          {formatRupiah(item.harga_satuan * item.jumlah)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Full Recipient, Address, Schedule & Note */}
                  <div className={`lg:col-span-5 ${APP_UI.cardSubtle} space-y-2 text-xs`}>
                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">Penerima &amp; Alamat Antar</div>
                      <div className="font-semibold text-zinc-900 mt-0.5">
                        {ord.nama_penerima} · <span className="font-mono font-normal">{ord.no_telepon_penerima}</span>
                      </div>
                      <div className="text-zinc-700 leading-relaxed mt-0.5">
                        {ord.alamat_lengkap} · {ord.nama_wilayah}
                        {ord.jarak_km ? ` (${ord.jarak_km.toFixed(1)} km)` : ''}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-zinc-200/80">
                      <div className="text-[11px] font-medium text-zinc-500">Jadwal Antar &amp; Catatan</div>
                      <div className="font-semibold text-zinc-900 mt-0.5">
                        {ord.tanggal_antar} · {ord.jam_antar}
                      </div>
                      <div className="text-zinc-600 mt-0.5">
                        Catatan: {ord.catatan_pembeli || 'Tidak ada catatan'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Band 3: Totals & Quick Actions */}
                <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-zinc-600 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span>
                      Subtotal <strong className="text-zinc-900 tabular-nums">{formatRupiah(ord.subtotal)}</strong>
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span>
                      Ongkir{' '}
                      <strong className="text-zinc-900 tabular-nums">
                        {ord.ongkir === 0 ? 'Gratis' : formatRupiah(ord.ongkir)}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span>
                      Total COD{' '}
                      <strong className="text-base font-bold text-teal-900 tabular-nums">
                        {formatRupiah(ord.total_cod)}
                      </strong>
                    </span>
                  </div>
                  {renderOrderActions(ord, true)}
                </div>
              </article>
            ))}
          </div>
        )}

        {modalOrder && (
          <ConfirmModal
            open={cancelOrderConfirmOpen}
            title="Batalkan Pesanan?"
            description={`Anda yakin ingin membatalkan pesanan ${modalOrder.nomor_pesanan}?`}
            confirmLabel="Ya, Batalkan"
            cancelLabel="Tidak"
            danger
            onCancel={() => setCancelOrderConfirmOpen(false)}
            onConfirm={async () => {
              setCancelOrderConfirmOpen(false);
              try {
                await api.cancelBuyerOrder(modalOrder.id, buyer.id);
                await onRefreshBuyer();
                showToast('success', 'Pesanan berhasil dibatalkan.');
              } catch (err: unknown) {
                await onRefreshBuyer();
                showToast('error', err instanceof Error ? err.message : 'Gagal membatalkan pesanan.');
              }
            }}
          />
        )}
      </div>
    );
  };

  const renderDetailPesanan = () => {
    if (!buyer) return null;
    const ord = orders.find((o) => o.id === selectedOrderId);
    if (!ord) {
      return (
        <div className={APP_UI.buyerFocused}>
          <div className={`${APP_UI.card} text-center space-y-3`}>
            <h1 className="text-lg font-display font-bold text-zinc-900">Pesanan Tidak Ditemukan</h1>
            <p className="text-xs sm:text-sm text-zinc-500">
              Pilih pesanan dari daftar Pesanan Saya untuk melihat detail lengkapnya.
            </p>
            <div>
              <button type="button" onClick={() => setPage('pesanan-saya')} className={APP_UI.btnPrimary}>
                Kembali ke Pesanan Saya
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={APP_UI.buyerWide}>
        <PageHeader
          title={<span className="font-mono">{ord.nomor_pesanan}</span>}
          subtitle={`Dibuat ${formatTanggalWaktu(ord.dibuat_pada)}`}
          backLabel="Pesanan Saya"
          onBack={() => setPage('pesanan-saya')}
          rightSlot={
            <div className="text-right space-y-0.5">
              <OrderStatusLabel status={ord.status} subStatus={ord.sub_status} perspective="buyer" />
              <div className="text-xs text-zinc-500">
                Pembayaran: <span className="font-semibold text-zinc-800">{ord.status_pembayaran}</span>
              </div>
            </div>
          }
        />

        {renderOrderDetailBody(ord)}

        <ConfirmModal
          open={cancelOrderConfirmOpen}
          title="Batalkan Pesanan?"
          description={`Anda yakin ingin membatalkan pesanan ${ord.nomor_pesanan}?`}
          confirmLabel="Ya, Batalkan"
          cancelLabel="Tidak"
          danger
          onCancel={() => setCancelOrderConfirmOpen(false)}
          onConfirm={async () => {
            setCancelOrderConfirmOpen(false);
            try {
              await api.cancelBuyerOrder(ord.id, buyer.id);
              await onRefreshBuyer();
              showToast('success', 'Pesanan berhasil dibatalkan.');
              setPage('pesanan-saya');
            } catch (err: unknown) {
              await onRefreshBuyer();
              showToast('error', err instanceof Error ? err.message : 'Gagal membatalkan pesanan.');
            }
          }}
        />
      </div>
    );
  };

  const renderFormUlasan = () => {
    if (!buyer) {
      return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-3">
            <h1 className="text-lg font-display font-bold text-zinc-900">Masuk untuk Memberi Ulasan</h1>
            <p className="text-xs sm:text-sm text-zinc-500">
              Silakan masuk terlebih dahulu untuk mengirim ulasan pesanan Anda.
            </p>
            <button
              type="button"
              onClick={() => onRequireAuth('pesanan-saya')}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Masuk
            </button>
          </div>
        </div>
      );
    }

    const ord =
      orders.find((o) => o.id === selectedOrderId) ||
      orders.find(
        (o) =>
          o.status === 'Selesai' &&
          o.items.some(
            (item) => !ulasan.some((u) => u.pesanan_id === o.id && u.produk_id === item.produk_id)
          )
      ) ||
      null;

    if (!ord) {
      return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-3">
            <h1 className="text-lg font-display font-bold text-zinc-900">Pesanan Tidak Ditemukan</h1>
            <p className="text-xs sm:text-sm text-zinc-500">
              Pilih pesanan berstatus Selesai dari daftar pesanan untuk memberi ulasan.
            </p>
            <button
              type="button"
              onClick={() => setPage('pesanan-saya')}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Kembali ke Pesanan Saya
            </button>
          </div>
        </div>
      );
    }

    const uniqueUnreviewed = ord.items.filter(
      (item, index, arr) =>
        arr.findIndex((other) => other.produk_id === item.produk_id) === index &&
        !ulasan.some((u) => u.pesanan_id === ord.id && u.produk_id === item.produk_id)
    );

    if (ord.status !== 'Selesai' || uniqueUnreviewed.length === 0) {
      return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-3">
            <h1 className="text-lg font-display font-bold text-zinc-900">
              {ord.status !== 'Selesai'
                ? 'Ulasan Belum Tersedia'
                : 'Semua Produk Sudah Diulas'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500">
              {ord.status !== 'Selesai'
                ? 'Ulasan hanya dapat dikirim setelah pesanan selesai diterima.'
                : `Anda sudah memberikan ulasan untuk semua produk di pesanan ${ord.nomor_pesanan}.`}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedOrderId(ord.id);
                setPage('detail-pesanan');
              }}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900"
            >
              Kembali ke Detail Pesanan
            </button>
          </div>
        </div>
      );
    }

    const targetProductId = uniqueUnreviewed.some((i) => i.produk_id === reviewTargetProductId)
      ? reviewTargetProductId
      : uniqueUnreviewed[0].produk_id;
    const targetItem =
      uniqueUnreviewed.find((i) => i.produk_id === targetProductId) || uniqueUnreviewed[0];

    const ratingLabels: Record<number, string> = {
      1: 'Sangat Kurang',
      2: 'Kurang',
      3: 'Cukup',
      4: 'Bagus',
      5: 'Sangat Bagus',
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (reviewSubmitting) return;
      setReviewError(null);
      if (!targetProductId) {
        setReviewError('Pilih produk yang ingin diulas terlebih dahulu.');
        return;
      }
      if (reviewRating < 1 || reviewRating > 5) {
        setReviewError('Pilih rating bintang 1 sampai 5 terlebih dahulu.');
        return;
      }
      setReviewSubmitting(true);
      try {
        await api.submitReview({
          pembeliId: buyer.id,
          pesanan_id: ord.id,
          produk_id: targetProductId,
          rating: reviewRating,
          komentar: reviewComment,
          fotos: reviewPhotos,
        });
        await Promise.all([onRefreshPublic(), onRefreshBuyer()]);
        setReviewRating(0);
        setReviewComment('');
        setReviewPhotos([]);
        setSelectedOrderId(ord.id);
        showToast('success', 'Ulasan berhasil dikirim!');
        setPage('detail-pesanan');
      } catch (err: unknown) {
        setReviewError(err instanceof Error ? err.message : 'Gagal mengirim ulasan.');
      } finally {
        setReviewSubmitting(false);
      }
    };

    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Beri Ulasan Produk"
          subtitle={<span className="font-mono">{ord.nomor_pesanan}</span>}
          backLabel="Detail"
          onBack={() => {
            setSelectedOrderId(ord.id);
            setPage('detail-pesanan');
          }}
        />

        <form onSubmit={handleSubmit} className={`${APP_UI.card} space-y-4`}>
          {reviewError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {reviewError}
            </div>
          )}

          {/* Product Preview & Selector */}
          <div className="space-y-2">
            {uniqueUnreviewed.length > 1 ? (
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Pilih Produk</label>
                <select
                  value={targetProductId}
                  onChange={(e) => {
                    setReviewTargetProductId(e.target.value);
                    setReviewError(null);
                  }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
                >
                  {uniqueUnreviewed.map((item) => (
                    <option key={item.produk_id} value={item.produk_id}>
                      {item.nama_produk}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {targetItem && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-stone-50 border border-zinc-200">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-zinc-200 shrink-0">
                  <ProductImage
                    src={targetItem.foto_url}
                    alt={targetItem.nama_produk}
                    className="w-full h-full"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                    {targetItem.nama_produk}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {targetItem.nama_varian ? `${targetItem.nama_varian} · ` : ''}
                    {targetItem.jumlah} × {formatRupiah(targetItem.harga_satuan)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-medium text-zinc-700">Rating Bintang *</label>
              {reviewRating > 0 && (
                <span className="text-xs font-semibold text-amber-700">
                  {reviewRating}/5 · {ratingLabels[reviewRating]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setReviewRating(star);
                    setReviewError(null);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-amber-50/60 transition-colors"
                  aria-label={`${star} bintang`}
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      star <= reviewRating ? 'fill-amber-500 text-amber-500' : 'text-zinc-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Komentar Ulasan</label>
            <textarea
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Ceritakan kualitas produk dan pengalaman pengantaran..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Foto Ulasan (Opsional, maks {pengaturan.maks_foto_ulasan} foto, maks{' '}
              {pengaturan.ukuran_maks_foto_mb} MB)
            </label>
            <label className="inline-flex items-center gap-2 min-h-[38px] px-3.5 py-2 text-xs font-medium bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer">
              <Upload className="w-4 h-4" />
              Unggah Foto
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  try {
                    const res = await readImageFilesAsDataUrls(
                      files,
                      pengaturan.ukuran_maks_foto_mb,
                      pengaturan.maks_foto_ulasan,
                      reviewPhotos.length
                    );
                    if (res.error) {
                      setReviewError(res.error);
                    } else {
                      setReviewError(null);
                    }
                    if (res.urls.length > 0) {
                      setReviewPhotos((prev) => [...prev, ...res.urls]);
                    }
                  } catch {
                    setReviewError('Gagal memproses file foto yang dipilih.');
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
            </label>
            {reviewPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-3">
                {reviewPhotos.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16">
                    <img src={url} alt="Pratinjau" className="w-full h-full object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => setReviewPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 bg-zinc-900 text-white rounded-full p-1"
                      aria-label="Hapus foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
            <button
              type="button"
              disabled={reviewSubmitting}
              onClick={() => {
                setSelectedOrderId(ord.id);
                setPage('detail-pesanan');
              }}
              className="min-h-[42px] px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={reviewSubmitting}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900 disabled:opacity-60"
            >
              {reviewSubmitting ? 'Mengirim...' : 'Kirim Ulasan'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderFormRetur = () => {
    if (!buyer) return null;
    const ord = orders.find((o) => o.id === selectedOrderId);
    if (!ord) return null;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setReturnError(null);
      if (returnPhotos.length === 0) {
        setReturnError('Unggah minimal 1 foto bukti kondisi barang.');
        return;
      }
      try {
        const res = await api.submitReturn({
          pembeliId: buyer.id,
          pesanan_id: ord.id,
          alasan: returnReason,
          keterangan: returnNote,
          bukti: returnPhotos,
        });
        await onRefreshBuyer();
        setSelectedReturnId(res.retur.id);
        showToast('success', 'Pengajuan retur berhasil dikirim.');
        setPage('status-retur');
      } catch (err: unknown) {
        setReturnError(err instanceof Error ? err.message : 'Gagal mengajukan retur.');
      }
    };

    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Ajukan Retur"
          subtitle={<span className="font-mono">{ord.nomor_pesanan}</span>}
          backLabel="Detail"
          onBack={() => setPage('detail-pesanan')}
        />
        <form onSubmit={handleSubmit} className={`${APP_UI.card} space-y-4`}>
          {returnError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {returnError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Alasan Retur *</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value as AlasanRetur)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
            >
              {Object.entries(ALASAN_RETUR_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Keterangan Tambahan</label>
            <textarea
              rows={3}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="Jelaskan kendala produk yang diterima..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Unggah Foto Bukti * (Maks {pengaturan.maks_foto_retur} foto, maks {pengaturan.ukuran_maks_foto_mb} MB)
            </label>
            <label className="inline-flex items-center gap-2 min-h-[38px] px-3.5 py-2 text-xs font-medium bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer">
              <Upload className="w-4 h-4" />
              Unggah Bukti
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const res = await readImageFilesAsDataUrls(
                    e.target.files,
                    pengaturan.ukuran_maks_foto_mb,
                    pengaturan.maks_foto_retur,
                    returnPhotos.length
                  );
                  if (res.error) setReturnError(res.error);
                  if (res.urls.length > 0) setReturnPhotos((prev) => [...prev, ...res.urls]);
                  e.target.value = '';
                }}
              />
            </label>
            {returnPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-3">
                {returnPhotos.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16">
                    <img src={url} alt="Bukti retur" className="w-full h-full object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => setReturnPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 bg-zinc-900 text-white rounded-full p-1"
                      aria-label="Hapus bukti"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setPage('detail-pesanan')}
              className={APP_UI.btnSecondary}
            >
              Batal
            </button>
            <button
              type="submit"
              className={APP_UI.btnPrimary}
            >
              Kirim Pengajuan
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderStatusRetur = () => {
    if (!buyer) return null;
    const ret = returns.find((r) => r.id === selectedReturnId) || returns.find((r) => r.pesanan_id === selectedOrderId);
    if (!ret) return null;
    const waUrl = buildWhatsAppUrl(
      toko.no_whatsapp,
      `Halo ${toko.nama_toko}, saya ingin koordinasi retur pesanan ${ret.nomor_pesanan || ''}.`
    );

    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Status Pengajuan Retur"
          subtitle={
            <span>
              <span className="font-mono font-semibold text-zinc-700">{ret.nomor_pesanan}</span> · Diajukan{' '}
              {formatTanggalWaktu(ret.diajukan_pada)}
            </span>
          }
          backLabel="Detail Pesanan"
          onBack={() => {
            setSelectedOrderId(ret.pesanan_id);
            setPage('detail-pesanan');
          }}
          rightSlot={<ReturnStatusLabel status={ret.status} />}
        />

        <div className={`${APP_UI.card} space-y-5`}>
          <div className="text-sm space-y-2">
            <div>
              <span className="text-zinc-500">Alasan: </span>
              <span className="font-semibold text-zinc-900">{ALASAN_RETUR_LABELS[ret.alasan]}</span>
            </div>
            {ret.keterangan && (
              <div>
                <span className="text-zinc-500">Keterangan: </span>
                <span className="text-zinc-800">{ret.keterangan}</span>
              </div>
            )}
          </div>

          {ret.status === 'Disetujui' && (
            <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900">
              Retur disetujui penjual. Silakan hubungi penjual via WhatsApp untuk menyepakati pengambilan barang dan pengembalian uang COD.
            </div>
          )}

          {ret.status === 'Ditolak' && ret.alasan_penolakan && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <span className="font-semibold">Alasan Penolakan:</span> {ret.alasan_penolakan}
            </div>
          )}

          {ret.bukti.length > 0 && (
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-2">Foto Bukti</div>
              <div className="flex flex-wrap gap-2.5">
                {ret.bukti.map((b) => (
                  <img
                    key={b.id}
                    src={b.url}
                    alt="Bukti retur"
                    className="w-20 h-20 object-cover rounded-lg border border-zinc-200"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2 border-t border-zinc-100">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className={APP_UI.btnSecondary}
            >
              <WhatsAppIcon className="w-4 h-4 shrink-0" />
              Hubungi Penjual
            </a>
            {ret.status === 'Menunggu' && (
              <button
                type="button"
                onClick={() => setCancelReturnConfirmOpen(true)}
                className={APP_UI.btnDanger}
              >
                Batalkan Pengajuan
              </button>
            )}
          </div>
        </div>

        <ConfirmModal
          open={cancelReturnConfirmOpen}
          title="Batalkan Pengajuan Retur?"
          description="Pengajuan retur akan dibatalkan. Anda dapat mengajukan kembali jika masih dalam batas waktu retur."
          confirmLabel="Ya, Batalkan"
          cancelLabel="Tidak"
          danger
          onCancel={() => setCancelReturnConfirmOpen(false)}
          onConfirm={async () => {
            setCancelReturnConfirmOpen(false);
            await api.cancelReturn(ret.id, buyer.id);
            await onRefreshBuyer();
            showToast('success', 'Pengajuan retur dibatalkan.');
            setSelectedOrderId(ret.pesanan_id);
            setPage('detail-pesanan');
          }}
        />
      </div>
    );
  };

  const renderProfilSaya = () => {
    if (!buyer) return null;
    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Profil Saya"
          backLabel="Beranda"
          onBack={() => setPage('beranda')}
        />

        <div className={`${APP_UI.card} space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{buyer.nama}</h2>
              <div className="text-sm text-zinc-600">{buyer.email}</div>
              <div className="text-sm font-mono text-zinc-700 mt-1">WA: {buyer.no_whatsapp}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditProfileNama(buyer.nama);
                setEditProfileWa(buyer.no_whatsapp);
                setEditProfileError(null);
                setPage('edit-profil');
              }}
              className={APP_UI.btnSecondary}
            >
              Edit Data Diri
            </button>
          </div>

          <div className="border-t border-zinc-100 pt-4 grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPage('daftar-alamat')}
              className="text-left p-4 rounded-lg border border-zinc-200 hover:border-teal-700 transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-zinc-900">
                <MapPin className="w-4 h-4 text-teal-800" />
                Alamat Saya ({addresses.length})
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Kelola alamat pengantaran &amp; alamat utama COD
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPage('pesanan-saya')}
              className="text-left p-4 rounded-lg border border-zinc-200 hover:border-teal-700 transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-zinc-900">
                <Package className="w-4 h-4 text-teal-800" />
                Riwayat Pesanan ({orders.length})
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Lihat status pengantaran, ulasan, dan retur
              </p>
            </button>
          </div>

          <div className="border-t border-zinc-100 pt-4 flex justify-end">
            <button
              type="button"
              onClick={onLogoutBuyer}
              className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Keluar dari Akun
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditProfil = () => {
    if (!buyer) return null;
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setEditProfileError(null);
      try {
        await api.updateBuyerProfile({
          pembeliId: buyer.id,
          nama: editProfileNama,
          no_whatsapp: editProfileWa,
        });
        await onRefreshBuyer();
        showToast('success', 'Data diri berhasil diperbarui.');
        setPage('profil-saya');
      } catch (err: unknown) {
        setEditProfileError(err instanceof Error ? err.message : 'Gagal memperbarui profil.');
      }
    };

    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Edit Data Diri"
          backLabel="Profil"
          onBack={() => setPage('profil-saya')}
        />
        <form onSubmit={handleSave} className={`${APP_UI.card} space-y-4`}>
          {editProfileError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {editProfileError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Email Google</label>
            <input
              type="email"
              value={buyer.email}
              disabled
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Nama Lengkap *</label>
            <input
              type="text"
              value={editProfileNama}
              onChange={(e) => setEditProfileNama(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Nomor WhatsApp (Format 628xxx) *
            </label>
            <input
              type="tel"
              value={editProfileWa}
              onChange={(e) => setEditProfileWa(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Nomor WhatsApp diubah langsung tanpa verifikasi OTP.
            </p>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setPage('profil-saya')}
              className={APP_UI.btnSecondary}
            >
              Batal
            </button>
            <button
              type="submit"
              className={APP_UI.btnPrimary}
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderDaftarAlamat = () => {
    if (!buyer) return null;
    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Daftar Alamat Saya"
          backLabel="Profil"
          onBack={() => setPage('profil-saya')}
          rightSlot={
            <button
              type="button"
              onClick={() => openAddressForm(null, 'daftar-alamat')}
              className={APP_UI.btnPrimary}
            >
              + Tambah Alamat
            </button>
          }
        />

        {addresses.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center text-sm text-zinc-500">
            Belum ada alamat tersimpan.
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => {
              const distKm = getAddressDistanceKm(addr);
              const withinRadius =
                distKm !== null && isAddressWithinRadius(distKm, tarifOngkir);
              const estOngkir =
                distKm !== null ? calculateDistanceShipping(0, distKm, tarifOngkir) : 0;
              return (
                <div
                  key={addr.id}
                  className={`${APP_UI.card} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <span>{addr.nama_penerima}</span>
                      {addr.is_utama && (
                        <span className="text-xs font-semibold text-teal-800">· Alamat Utama</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-zinc-600">{addr.no_telepon}</div>
                    <div className="text-sm text-zinc-700">{addr.alamat_lengkap}</div>
                    <div className="text-xs text-zinc-500">
                      {addr.nama_wilayah} ·{' '}
                      {distKm === null ? (
                        <span className="text-amber-800 font-medium">
                          Pin Google Maps belum diatur (klik Edit)
                        </span>
                      ) : withinRadius ? (
                        <span className="text-teal-800 font-medium">
                          {distKm.toFixed(1)} km · Ongkir mulai {formatRupiah(estOngkir)}
                        </span>
                      ) : (
                        <span className="text-rose-700 font-medium">
                          {distKm.toFixed(1)} km · Di luar radius maks {tarifOngkir.batas_radius_km} km
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!addr.is_utama && (
                      <button
                        type="button"
                        onClick={async () => {
                          await api.setPrimaryAddress(addr.id, buyer.id);
                          await onRefreshBuyer();
                          showToast('success', 'Alamat utama diperbarui.');
                        }}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-teal-800 text-teal-900 rounded-lg hover:bg-teal-50"
                      >
                        Jadikan Utama
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openAddressForm(addr, 'daftar-alamat')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-zinc-300 rounded-lg hover:bg-stone-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={addr.is_utama}
                      title={
                        addr.is_utama
                          ? 'Jadikan alamat lain sebagai utama terlebih dahulu sebelum menghapus'
                          : 'Hapus alamat'
                      }
                      onClick={() => setDeleteAddrTarget(addr)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ConfirmModal
          open={Boolean(deleteAddrTarget)}
          title="Hapus Alamat?"
          description={`Anda yakin ingin menghapus alamat "${deleteAddrTarget?.nama_penerima}"?`}
          confirmLabel="Ya, Hapus"
          cancelLabel="Tidak"
          danger
          onCancel={() => setDeleteAddrTarget(null)}
          onConfirm={async () => {
            if (!deleteAddrTarget) return;
            try {
              await api.deleteAddress(deleteAddrTarget.id, buyer.id);
              await onRefreshBuyer();
              showToast('success', 'Alamat dihapus.');
            } catch (err: unknown) {
              showToast('error', err instanceof Error ? err.message : 'Gagal menghapus alamat.');
            } finally {
              setDeleteAddrTarget(null);
            }
          }}
        />
      </div>
    );
  };

  const renderNotifikasi = () => {
    if (!buyer) return null;
    return (
      <div className={APP_UI.buyerFocused}>
        <PageHeader
          title="Notifikasi"
          backLabel="Beranda"
          onBack={() => setPage('beranda')}
          rightSlot={
            unreadCount > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await api.markAllNotificationsRead('pembeli', buyer.id);
                  await onRefreshBuyer();
                }}
                className="text-xs font-semibold text-teal-800 hover:text-teal-950"
              >
                Tandai Semua Dibaca
              </button>
            ) : undefined
          }
        />

        {notifications.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-500">
            Belum ada notifikasi.
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={async () => {
                  if (!n.sudah_dibaca) {
                    await api.markNotificationRead(n.id);
                    await onRefreshBuyer();
                  }
                  if (n.tujuan_tipe === 'pesanan' && n.tujuan_id) {
                    setSelectedOrderId(n.tujuan_id);
                    setPage('detail-pesanan');
                  } else if (n.tujuan_tipe === 'retur' && n.tujuan_id) {
                    setSelectedReturnId(n.tujuan_id);
                    setPage('status-retur');
                  }
                }}
                className={`w-full text-left p-4 hover:bg-stone-50 transition-colors flex items-start justify-between gap-4 ${
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] pt-[calc(52px+env(safe-area-inset-top,0px))] lg:pt-16 pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:pb-0">
      {renderHeader()}

      <main className="flex-1 min-w-0">
        {page === 'beranda' && renderBeranda()}
        {page === 'daftar-produk' && renderCatalogOrSearch(false)}
        {page === 'hasil-pencarian' && renderCatalogOrSearch(true)}
        {page === 'detail-produk' && renderDetailProduk()}
        {page === 'keranjang' && renderKeranjang()}
        {page === 'checkout' && renderCheckout()}
        {page === 'pilih-alamat' && renderPilihAlamat()}
        {page === 'form-alamat' && renderFormAlamat()}
        {page === 'pesanan-berhasil' && renderPesananBerhasil()}
        {page === 'pesanan-saya' && renderPesananSaya()}
        {page === 'detail-pesanan' && renderDetailPesanan()}
        {page === 'form-ulasan' && renderFormUlasan()}
        {page === 'form-retur' && renderFormRetur()}
        {page === 'status-retur' && renderStatusRetur()}
        {page === 'profil-saya' && renderProfilSaya()}
        {page === 'edit-profil' && renderEditProfil()}
        {page === 'daftar-alamat' && renderDaftarAlamat()}
        {page === 'notifikasi' && renderNotifikasi()}
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-8 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            <span className="font-semibold text-zinc-900">{toko.nama_toko}</span> · {toko.alamat_kios}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={buildWhatsAppUrl(toko.no_whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-700 hover:text-zinc-900 font-medium inline-flex items-center gap-1.5 min-h-[36px]"
            >
              <WhatsAppIcon className="w-4 h-4 shrink-0" />
              <span>WhatsApp Toko</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          </div>
        </div>
      </footer>

      {renderMobileBottomNav()}
    </div>
  );
}
