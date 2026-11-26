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
} from './types';

export interface BootstrapResponse {
  toko: Toko;
  kategori: Kategori[];
  tarif_ongkir: TarifOngkirJarak;
  jadwal_antar: JadwalAntar[];
  produk: Produk[];
  all_produk_public_ref: Produk[];
  ulasan: Ulasan[];
  pengaturan: PengaturanToko;
  maps_api_key?: string;
}

export interface BuyerStateResponse {
  pembeli: Pembeli;
  alamat: Alamat[];
  keranjang: KeranjangItem[];
  pesanan: Pesanan[];
  retur: Retur[];
  notifikasi: Notifikasi[];
}

export interface SellerOverviewResponse {
  toko: Toko;
  tarif_ongkir: TarifOngkirJarak;
  jadwal_antar: JadwalAntar[];
  kategori: Kategori[];
  produk: Produk[];
  pesanan: Pesanan[];
  retur: Retur[];
  ulasan: Ulasan[];
  notifikasi: Notifikasi[];
  pengaturan: PengaturanToko;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429 || data?.code === 'QUOTA_EXCEEDED' || data?.status === 'RESOURCE_EXHAUSTED') {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    const fallbackMsg =
      res.status === 413
        ? 'Ukuran total foto yang diunggah terlalu besar.'
        : 'Terjadi kesalahan pada server.';
    const err = new Error(data.error || fallbackMsg) as Error & {
      code?: string;
      status?: number;
      newOngkir?: number;
    };
    err.code = data.code;
    err.status = res.status;
    err.newOngkir = data.newOngkir;
    throw err;
  }
  return data as T;
}

export function readImageFilesAsDataUrls(
  files: FileList | null,
  maxSizeMb: number,
  maxCount: number,
  currentCount: number
): Promise<{ urls: string[]; error?: string }> {
  if (!files || files.length === 0) return Promise.resolve({ urls: [] });
  const remaining = Math.max(0, maxCount - currentCount);
  if (remaining <= 0) {
    return Promise.resolve({ urls: [], error: `Maksimal ${maxCount} foto.` });
  }
  const chosen = Array.from(files).slice(0, remaining);
  const maxBytes = maxSizeMb * 1024 * 1024;
  for (const f of chosen) {
    if (f.type && !f.type.startsWith('image/')) {
      return Promise.resolve({
        urls: [],
        error: `File "${f.name}" bukan gambar yang valid.`,
      });
    }
    if (f.size > maxBytes) {
      return Promise.resolve({
        urls: [],
        error: `Ukuran file "${f.name}" melebihi batas maksimal ${maxSizeMb} MB.`,
      });
    }
  }
  return Promise.all(
    chosen.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
          reader.readAsDataURL(file);
        })
    )
  )
    .then((urls) => ({ urls: urls.filter(Boolean) }))
    .catch((err: unknown) => ({
      urls: [],
      error: err instanceof Error ? err.message : 'Gagal membaca file gambar.',
    }));
}

export const api = {
  getBootstrap: () => apiFetch<BootstrapResponse>('/api/bootstrap'),

  geocodeAddress: (address: string) =>
    apiFetch<{
      found: boolean;
      lat?: number;
      lng?: number;
      formattedAddress?: string;
      areaLabel?: string;
    }>(`/api/maps/geocode?address=${encodeURIComponent(address)}`),

  reverseGeocodeCoords: (lat: number, lng: number) =>
    apiFetch<{
      found: boolean;
      formattedAddress?: string;
      areaLabel?: string;
    }>(`/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`),

  googleLogin: (email: string, name: string, roleIntent: 'buyer' | 'seller') =>
    apiFetch<{
      role: 'buyer' | 'seller';
      needsProfile?: boolean;
      googleAccount?: { email: string; name: string };
      pembeli?: Pembeli;
      email?: string;
      storeComplete?: boolean;
      toko?: Toko;
    }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, roleIntent }),
    }),

  completeBuyerProfile: (payload: { email: string; nama: string; no_whatsapp: string }) =>
    apiFetch<{ pembeli: Pembeli }>('/api/buyer/complete-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBuyerState: (pembeliId: string) =>
    apiFetch<BuyerStateResponse>(`/api/buyer/state?pembeliId=${encodeURIComponent(pembeliId)}`),

  updateBuyerProfile: (payload: { pembeliId: string; nama: string; no_whatsapp: string }) =>
    apiFetch<{ pembeli: Pembeli }>('/api/buyer/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  createAddress: (payload: Partial<Alamat> & { pembeliId: string }) =>
    apiFetch<{ alamat: Alamat }>('/api/buyer/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAddress: (id: string, payload: Partial<Alamat> & { pembeliId: string }) =>
    apiFetch<{ alamat: Alamat }>(`/api/buyer/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  setPrimaryAddress: (id: string, pembeliId: string) =>
    apiFetch<{ alamat: Alamat[] }>(`/api/buyer/addresses/${id}/primary`, {
      method: 'POST',
      body: JSON.stringify({ pembeliId }),
    }),

  deleteAddress: (id: string, pembeliId: string) =>
    apiFetch<{ success: boolean }>(
      `/api/buyer/addresses/${id}?pembeliId=${encodeURIComponent(pembeliId)}`,
      { method: 'DELETE' }
    ),

  addToCart: (payload: {
    pembeliId: string;
    produk_id: string;
    varian_id: string | null;
    jumlah: number;
  }) =>
    apiFetch<{ keranjang: KeranjangItem[] }>('/api/buyer/cart', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCartItem: (
    id: string,
    payload: { pembeliId: string; jumlah?: number; dipilih?: boolean }
  ) =>
    apiFetch<{ keranjang: KeranjangItem[] }>(`/api/buyer/cart/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  selectAllCart: (pembeliId: string, dipilih: boolean) =>
    apiFetch<{ keranjang: KeranjangItem[] }>('/api/buyer/cart/select-all', {
      method: 'POST',
      body: JSON.stringify({ pembeliId, dipilih }),
    }),

  removeCartItem: (id: string, pembeliId: string) =>
    apiFetch<{ keranjang: KeranjangItem[] }>(
      `/api/buyer/cart/${id}?pembeliId=${encodeURIComponent(pembeliId)}`,
      { method: 'DELETE' }
    ),

  createOrder: (payload: {
    pembeliId: string;
    alamatId: string;
    tanggal_antar: string;
    jam_antar: string;
    catatan_pembeli: string;
    expectedOngkir: number;
    buyNowItem?: { produk_id: string; varian_id: string | null; jumlah: number } | null;
  }) =>
    apiFetch<{ pesanan: Pesanan }>('/api/buyer/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelBuyerOrder: (id: string, pembeliId: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/buyer/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ pembeliId }),
    }),

  reorderBuyerOrder: (id: string, pembeliId: string) =>
    apiFetch<{ addedCount: number; skipped: string[]; keranjang: KeranjangItem[] }>(
      `/api/buyer/orders/${id}/reorder`,
      {
        method: 'POST',
        body: JSON.stringify({ pembeliId }),
      }
    ),

  submitReview: (payload: {
    pembeliId: string;
    pesanan_id: string;
    produk_id: string;
    rating: number;
    komentar: string;
    fotos: string[];
  }) =>
    apiFetch<{ ulasan: Ulasan }>('/api/buyer/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitReturn: (payload: {
    pembeliId: string;
    pesanan_id: string;
    alasan: AlasanRetur;
    keterangan: string;
    bukti: string[];
  }) =>
    apiFetch<{ retur: Retur }>('/api/buyer/returns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelReturn: (id: string, pembeliId: string) =>
    apiFetch<{ retur: Retur }>(`/api/buyer/returns/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ pembeliId }),
    }),

  markNotificationRead: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: (recipientType: 'pembeli' | 'penjual', pembeliId?: string) =>
    apiFetch<{ success: boolean }>('/api/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ recipientType, pembeliId }),
    }),

  // Seller endpoints
  getSellerOverview: () => apiFetch<SellerOverviewResponse>('/api/seller/overview'),

  updateStoreProfile: (payload: Partial<Toko>) =>
    apiFetch<{ toko: Toko }>('/api/seller/store', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  createProduct: (payload: Partial<Produk>) =>
    apiFetch<{ produk: Produk }>('/api/seller/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: string, payload: Partial<Produk>) =>
    apiFetch<{ produk: Produk }>(`/api/seller/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  toggleProductActive: (id: string) =>
    apiFetch<{ produk: Produk }>(`/api/seller/products/${id}/toggle`, {
      method: 'PATCH',
    }),

  deleteProduct: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/seller/products/${id}`, {
      method: 'DELETE',
    }),

  confirmOrder: (id: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/confirm`, { method: 'POST' }),

  rejectOrder: (id: string, alasan: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ alasan }),
    }),

  markShopeeOrdered: (id: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/shopee-ordered`, { method: 'POST' }),

  markShopeeArrived: (id: string, itemId?: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/shopee-arrived`, {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),

  markOrderReady: (id: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/ready`, { method: 'POST' }),

  startDelivery: (id: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/start-delivery`, { method: 'POST' }),

  completeOrder: (id: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/complete`, { method: 'POST' }),

  cancelSellerOrder: (id: string, alasan: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ alasan }),
    }),

  failDelivery: (id: string, alasan: string) =>
    apiFetch<{ pesanan: Pesanan }>(`/api/seller/orders/${id}/fail-delivery`, {
      method: 'POST',
      body: JSON.stringify({ alasan }),
    }),

  approveReturn: (id: string) =>
    apiFetch<{ retur: Retur }>(`/api/seller/returns/${id}/approve`, { method: 'POST' }),

  rejectReturn: (id: string, alasan: string) =>
    apiFetch<{ retur: Retur }>(`/api/seller/returns/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ alasan }),
    }),

  completeReturn: (id: string) =>
    apiFetch<{ retur: Retur }>(`/api/seller/returns/${id}/complete`, { method: 'POST' }),

  updateShippingConfig: (
    payload: TarifOngkirJarak & { alamat_kios?: string; lat?: number; lng?: number }
  ) =>
    apiFetch<{ tarif_ongkir: TarifOngkirJarak; toko: Toko }>('/api/seller/shipping', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateSchedules: (jadwal_antar: JadwalAntar[]) =>
    apiFetch<{ jadwal_antar: JadwalAntar[] }>('/api/seller/schedules', {
      method: 'PUT',
      body: JSON.stringify({ jadwal_antar }),
    }),

  createCategory: (payload: { nama: string; urutan: number }) =>
    apiFetch<{ kategori: Kategori }>('/api/seller/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCategory: (id: string, payload: { nama: string; urutan: number }) =>
    apiFetch<{ kategori: Kategori }>(`/api/seller/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCategory: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/seller/categories/${id}`, { method: 'DELETE' }),

  updateSettings: (payload: PengaturanToko) =>
    apiFetch<{ pengaturan: PengaturanToko }>('/api/seller/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
