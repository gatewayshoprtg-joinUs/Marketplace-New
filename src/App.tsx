/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APIProvider } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, BootstrapResponse, BuyerStateResponse, SellerOverviewResponse } from './api';
import { BuyerPage, BuyerStorefront } from './components/BuyerStorefront';
import { SellerDashboard } from './components/SellerDashboard';
import { GoogleAuthModal, ToastBanner } from './components/SharedUI';

const STORAGE_BUYER_ID = 'rmstore_buyer_id';
const STORAGE_SELLER_EMAIL = 'rmstore_seller_email';
const STORAGE_MODE = 'rmstore_mode';

export default function App() {
  const [mode, setMode] = useState<'buyer' | 'seller'>(() => {
    const saved = localStorage.getItem(STORAGE_MODE);
    return saved === 'seller' && localStorage.getItem(STORAGE_SELLER_EMAIL) ? 'seller' : 'buyer';
  });

  const [publicData, setPublicData] = useState<BootstrapResponse | null>(null);
  const [buyerData, setBuyerData] = useState<BuyerStateResponse | null>(null);
  const [sellerData, setSellerData] = useState<SellerOverviewResponse | null>(null);
  const [sellerEmail, setSellerEmail] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_SELLER_EMAIL)
  );
  const [sellerForceProfile, setSellerForceProfile] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Buyer navigation state
  const [buyerPage, setBuyerPage] = useState<BuyerPage>('beranda');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRoleIntent, setAuthRoleIntent] = useState<'buyer' | 'seller'>('buyer');
  const [authPendingProfile, setAuthPendingProfile] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const pendingTargetPageRef = useRef<BuyerPage | undefined>(undefined);
  const pendingAfterAuthRef = useRef<(() => void) | undefined>(undefined);

  // Toast state
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      setToast({ type, message });
    },
    []
  );

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshPublic = useCallback(async () => {
    const boot = await api.getBootstrap();
    setPublicData(boot);
  }, []);

  const refreshBuyer = useCallback(async (overrideId?: string) => {
    const id = overrideId || localStorage.getItem(STORAGE_BUYER_ID);
    if (!id) {
      setBuyerData(null);
      return;
    }
    try {
      const state = await api.getBuyerState(id);
      setBuyerData(state);
    } catch {
      localStorage.removeItem(STORAGE_BUYER_ID);
      setBuyerData(null);
      showToast('info', 'Sesi login berakhir, silakan masuk kembali.');
    }
  }, [showToast]);

  const refreshSeller = useCallback(async () => {
    const ov = await api.getSellerOverview();
    setSellerData(ov);
  }, []);

  // Initial load
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const boot = await api.getBootstrap();
        if (!active) return;
        setPublicData(boot);

        const savedBuyerId = localStorage.getItem(STORAGE_BUYER_ID);
        if (savedBuyerId) {
          await refreshBuyer(savedBuyerId);
        }
        const savedSellerEmail = localStorage.getItem(STORAGE_SELLER_EMAIL);
        if (savedSellerEmail) {
          await refreshSeller();
        }
      } catch (err: unknown) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Gagal memuat data toko.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshBuyer, refreshSeller]);

  // Background polling for real-time notification badge & order updates (No 187, Penjual 117-119)
  useEffect(() => {
    const timer = setInterval(() => {
      if (mode === 'seller' && sellerEmail) {
        refreshSeller().catch(() => {});
      } else if (mode === 'buyer' && buyerData?.pembeli.id) {
        refreshBuyer(buyerData.pembeli.id).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [mode, sellerEmail, buyerData?.pembeli.id, refreshBuyer, refreshSeller]);

  const openBuyerAuth = (targetPage?: BuyerPage, afterAction?: () => void) => {
    pendingTargetPageRef.current = targetPage;
    pendingAfterAuthRef.current = afterAction;
    setAuthRoleIntent('buyer');
    setAuthPendingProfile(null);
    setAuthError(null);
    setAuthModalOpen(true);
  };

  const handleSwitchToSeller = useCallback(async () => {
    if (sellerEmail) {
      await refreshSeller();
      setMode('seller');
      localStorage.setItem(STORAGE_MODE, 'seller');
      return;
    }
    setAuthRoleIntent('seller');
    setAuthPendingProfile(null);
    setAuthError(null);
    setAuthModalOpen(true);
  }, [sellerEmail, refreshSeller]);

  useEffect(() => {
    const checkSellerRoute = () => {
      const params = new URLSearchParams(window.location.search);
      if (window.location.hash === '#seller' || params.has('seller')) {
        handleSwitchToSeller().catch(() => {});
      }
    };
    checkSellerRoute();
    window.addEventListener('hashchange', checkSellerRoute);
    return () => window.removeEventListener('hashchange', checkSellerRoute);
  }, [handleSwitchToSeller]);

  const handleSelectGoogleAccount = async (email: string, name: string) => {
    setAuthError(null);
    try {
      const res = await api.googleLogin(email, name, authRoleIntent);
      if (res.role === 'seller') {
        localStorage.setItem(STORAGE_SELLER_EMAIL, res.email!);
        localStorage.setItem(STORAGE_MODE, 'seller');
        setSellerEmail(res.email!);
        setSellerForceProfile(!res.storeComplete);
        await refreshSeller();
        setAuthModalOpen(false);
        setMode('seller');
        showToast('success', `Masuk sebagai penjual (${res.email}).`);
        return;
      }

      if (res.needsProfile && res.googleAccount) {
        setAuthPendingProfile(res.googleAccount);
        return;
      }

      if (res.pembeli) {
        localStorage.setItem(STORAGE_BUYER_ID, res.pembeli.id);
        await refreshBuyer(res.pembeli.id);
        setAuthModalOpen(false);
        showToast('success', `Selamat datang, ${res.pembeli.nama}.`);
        if (pendingAfterAuthRef.current) {
          pendingAfterAuthRef.current();
          pendingAfterAuthRef.current = undefined;
        } else if (pendingTargetPageRef.current) {
          setBuyerPage(pendingTargetPageRef.current);
          pendingTargetPageRef.current = undefined;
        }
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Autentikasi Google gagal.');
    }
  };

  const handleSubmitBuyerProfile = async (nama: string, noWhatsapp: string) => {
    if (!authPendingProfile) return;
    setAuthError(null);
    try {
      const res = await api.completeBuyerProfile({
        email: authPendingProfile.email,
        nama,
        no_whatsapp: noWhatsapp,
      });
      localStorage.setItem(STORAGE_BUYER_ID, res.pembeli.id);
      await refreshBuyer(res.pembeli.id);
      setAuthPendingProfile(null);
      setAuthModalOpen(false);
      showToast('success', `Akun dibuat. Selamat datang, ${res.pembeli.nama}.`);
      if (pendingAfterAuthRef.current) {
        pendingAfterAuthRef.current();
        pendingAfterAuthRef.current = undefined;
      } else if (pendingTargetPageRef.current) {
        setBuyerPage(pendingTargetPageRef.current);
        pendingTargetPageRef.current = undefined;
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Gagal menyimpan data diri.');
    }
  };

  const handleLogoutBuyer = () => {
    localStorage.removeItem(STORAGE_BUYER_ID);
    setBuyerData(null);
    setBuyerPage('beranda');
    showToast('info', 'Anda telah keluar. Sekarang menelusuri sebagai tamu.');
  };

  const handleLogoutSeller = () => {
    localStorage.removeItem(STORAGE_SELLER_EMAIL);
    localStorage.setItem(STORAGE_MODE, 'buyer');
    setSellerEmail(null);
    setSellerData(null);
    setMode('buyer');
    setBuyerPage('beranda');
    if (window.location.hash === '#seller') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    showToast('info', 'Sesi penjual diakhiri.');
  };

  if (loading || !publicData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] p-6">
        <div className="text-center space-y-2">
          {loadError ? (
            <>
              <p className="text-sm text-rose-700 font-medium">{loadError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-semibold bg-teal-800 text-white rounded-lg"
              >
                Muat Ulang
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Memuat RMStore...</p>
          )}
        </div>
      </div>
    );
  }

  const mapsApiKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
    publicData.maps_api_key ||
    '';
  const mapsAvailable = Boolean(mapsApiKey);

  const appTree = (
    <>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {mode === 'seller' && sellerEmail && sellerData ? (
        <SellerDashboard
          sellerEmail={sellerEmail}
          data={sellerData}
          mapsAvailable={mapsAvailable}
          forceCompleteProfile={sellerForceProfile}
          onProfileCompleted={() => setSellerForceProfile(false)}
          onRefreshSeller={refreshSeller}
          onRefreshPublic={refreshPublic}
          onLogoutSeller={handleLogoutSeller}
          onSwitchToBuyer={async () => {
            await refreshPublic();
            setMode('buyer');
            localStorage.setItem(STORAGE_MODE, 'buyer');
            if (window.location.hash === '#seller') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
          showToast={showToast}
        />
      ) : (
        <BuyerStorefront
          toko={publicData.toko}
          kategori={publicData.kategori}
          tarifOngkir={publicData.tarif_ongkir}
          mapsAvailable={mapsAvailable}
          jadwalAntar={publicData.jadwal_antar}
          produk={publicData.produk}
          allProdukRef={publicData.all_produk_public_ref}
          ulasan={publicData.ulasan}
          pengaturan={publicData.pengaturan}
          buyer={buyerData?.pembeli || null}
          addresses={buyerData?.alamat || []}
          cart={buyerData?.keranjang || []}
          orders={buyerData?.pesanan || []}
          returns={buyerData?.retur || []}
          notifications={buyerData?.notifikasi || []}
          page={buyerPage}
          setPage={setBuyerPage}
          selectedProductId={selectedProductId}
          setSelectedProductId={setSelectedProductId}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
          selectedReturnId={selectedReturnId}
          setSelectedReturnId={setSelectedReturnId}
          onRequireAuth={openBuyerAuth}
          onLogoutBuyer={handleLogoutBuyer}
          onRefreshPublic={refreshPublic}
          onRefreshBuyer={() => refreshBuyer()}
          showToast={showToast}
        />
      )}

      <GoogleAuthModal
        open={authModalOpen}
        roleIntent={authRoleIntent}
        pendingProfile={authPendingProfile}
        authError={authError}
        onSelectGoogleAccount={handleSelectGoogleAccount}
        onCancelAuth={() => {
          setAuthModalOpen(false);
          setAuthPendingProfile(null);
          pendingTargetPageRef.current = undefined;
          pendingAfterAuthRef.current = undefined;
          showToast('info', 'Login dibatalkan.');
        }}
        onSubmitProfile={handleSubmitBuyerProfile}
        onCancelProfile={() => {
          setAuthPendingProfile(null);
          setAuthModalOpen(false);
          showToast('info', 'Pendaftaran dibatalkan. Data diri belum disimpan.');
        }}
      />

      <ToastBanner toast={toast} onClose={() => setToast(null)} />
    </>
  );

  if (mapsAvailable) {
    return (
      <APIProvider
        apiKey={mapsApiKey}
        language="id"
        region="ID"
        libraries={['places', 'marker', 'routes', 'core']}
      >
        {appTree}
      </APIProvider>
    );
  }

  return appTree;
}
