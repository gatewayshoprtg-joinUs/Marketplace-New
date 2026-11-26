/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, Loader2, MapPin, Navigation, Search, Store, Truck } from 'lucide-react';
import { api } from '../api';
import { Pesanan, TarifOngkirJarak } from '../types';
import {
  calculateDistanceShipping,
  formatRupiah,
  haversineDistanceKm,
  isAddressWithinRadius,
} from '../utils/format';

const GMP_ATTRIBUTION = ['gmp_mcp_codeassist_v1_aistudio'];
const DEFAULT_CENTER = { lat: -6.1944, lng: 106.8229 };

function isQuotaError(err: unknown): boolean {
  const text = String((err as { message?: string })?.message || err || '').toUpperCase();
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('QUOTA') ||
    text.includes('429')
  );
}

function extractAreaFromPlace(place: google.maps.places.Place, fallback: string): string {
  const comps = place.addressComponents || [];
  const sub =
    comps.find((c) => c.types.includes('administrative_area_level_3'))?.longText ||
    comps.find((c) => c.types.includes('sublocality_level_1'))?.longText ||
    comps.find((c) => c.types.includes('locality'))?.longText ||
    '';
  const city =
    comps.find((c) => c.types.includes('administrative_area_level_2'))?.longText ||
    comps.find((c) => c.types.includes('administrative_area_level_1'))?.longText ||
    '';
  const joined = [sub, city].filter(Boolean).join(', ');
  return joined || fallback;
}

/**
 * Draws a driving route between origin & destination using Maps JS SDK Routes API (Route.computeRoutes)
 * and reports the computed distance in km back to the parent.
 */
function DeliveryRouteLayer({
  origin,
  destination,
  onDistanceComputed,
  fitBoth = true,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  onDistanceComputed?: (distanceKm: number, viaRoutesApi: boolean) => void;
  fitBoth?: boolean;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const coreLib = useMapsLibrary('core');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    const clearPolylines = () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };

    const haversineKm = haversineDistanceKm(origin, destination);

    if (!map) {
      onDistanceComputed?.(haversineKm, false);
      return;
    }

    if (fitBoth && coreLib) {
      const bounds = new coreLib.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      map.fitBounds(bounds, 48);
    }

    if (!routesLib || (origin.lat === destination.lat && origin.lng === destination.lng)) {
      clearPolylines();
      onDistanceComputed?.(haversineKm, false);
      return;
    }

    let cancelled = false;

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: routesLib.TravelMode.DRIVING,
      fields: ['distanceMeters', 'path', 'viewport'],
    })
      .then((res) => {
        if (cancelled) return;
        clearPolylines();
        const route = res.routes?.[0];
        if (!route) {
          onDistanceComputed?.(haversineKm, false);
          return;
        }
        const km =
          typeof route.distanceMeters === 'number'
            ? Math.round((route.distanceMeters / 1000) * 10) / 10
            : haversineKm;

        onDistanceComputed?.(km, true);

        const created = route.createPolylines({
          polylineOptions: {
            strokeColor: '#0F4C46',
            strokeOpacity: 0.9,
            strokeWeight: 4,
          },
        });
        created.forEach((line) => line.setMap(map));
        polylinesRef.current = created;

        if (fitBoth && route.viewport) {
          map.fitBounds(route.viewport, 44);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        clearPolylines();
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onDistanceComputed?.(haversineKm, false);
      });

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [map, routesLib, coreLib, origin.lat, origin.lng, destination.lat, destination.lng, fitBoth]);

  return null;
}

/**
 * Keeps the map camera centered when coordinates change in single-pin mode.
 */
function MapCameraPanner({
  target,
  zoom = 15,
}: {
  target: { lat: number; lng: number } | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    const currentZoom = map.getZoom();
    if (!currentZoom || currentZoom < 13) {
      map.setZoom(zoom);
    }
  }, [map, target?.lat, target?.lng, zoom]);
  return null;
}

export interface AddressMapValue {
  alamat_lengkap: string;
  nama_wilayah: string;
  lat: number | null;
  lng: number | null;
  jarak_km: number | null;
}

export function AddressMapPicker({
  mode,
  mapsAvailable,
  kioskLocation,
  value,
  onChange,
  tarifOngkir,
  sampleSubtotal = 0,
  kioskName = 'Kios RMStore',
}: {
  mode: 'buyer' | 'seller';
  mapsAvailable: boolean;
  kioskLocation: { lat: number; lng: number; alamat_kios?: string };
  value: AddressMapValue;
  onChange: (next: AddressMapValue) => void;
  tarifOngkir?: TarifOngkirJarak;
  sampleSubtotal?: number;
  kioskName?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [searchQuery, setSearchQuery] = useState(value.alamat_lengkap || '');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeNote, setGeocodeNote] = useState<string | null>(null);
  const [viaRoutesApi, setViaRoutesApi] = useState(false);

  const latestValueRef = useRef(value);
  latestValueRef.current = value;

  const autoGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAutoGeocodeRef = useRef(false);

  // Keep searchQuery synchronized when external value changes (e.g., editing another address or reverse geocode)
  useEffect(() => {
    setSearchQuery(value.alamat_lengkap);
  }, [value.alamat_lengkap]);

  // Fetch Places API (New) Autocomplete suggestions
  useEffect(() => {
    if (!mapsAvailable || !placesLib) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3 || suppressAutoGeocodeRef.current) {
      setSuggestions([]);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }

    let active = true;
    const timer = setTimeout(() => {
      placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current || undefined,
        includedRegionCodes: ['id'],
        language: 'id',
      })
        .then((res) => {
          if (!active) return;
          setSuggestions(res.suggestions || []);
        })
        .catch((err) => {
          if (!active) return;
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setSuggestions([]);
        });
    }, 320);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mapsAvailable, placesLib, searchQuery]);

  const applyPinnedCoordinates = useCallback(
    (lat: number, lng: number, alamat?: string, area?: string) => {
      const curr = latestValueRef.current;
      const dist =
        mode === 'buyer' ? haversineDistanceKm(kioskLocation, { lat, lng }) : 0;
      onChange({
        alamat_lengkap: alamat !== undefined ? alamat : curr.alamat_lengkap,
        nama_wilayah: area !== undefined ? area : curr.nama_wilayah,
        lat,
        lng,
        jarak_km: dist,
      });
    },
    [mode, kioskLocation.lat, kioskLocation.lng, onChange]
  );

  // Automatic debounced geocode when user types an address directly so a pin appears automatically
  const runAddressGeocode = useCallback(
    async (rawAddress: string, updateAddressText = false) => {
      const q = rawAddress.trim();
      if (q.length < 6) return;
      setGeocoding(true);
      setGeocodeNote(null);
      try {
        const res = await api.geocodeAddress(q);
        if (res.found && typeof res.lat === 'number' && typeof res.lng === 'number') {
          suppressAutoGeocodeRef.current = true;
          const nextAlamat = updateAddressText && res.formattedAddress ? res.formattedAddress : q;
          const dist =
            mode === 'buyer'
              ? haversineDistanceKm(kioskLocation, { lat: res.lat, lng: res.lng })
              : 0;
          onChange({
            alamat_lengkap: nextAlamat,
            nama_wilayah: res.areaLabel || latestValueRef.current.nama_wilayah || 'Lokasi Terpin',
            lat: res.lat,
            lng: res.lng,
            jarak_km: dist,
          });
          setDropdownOpen(false);
          setGeocodeNote('Pin Google Maps diperbarui sesuai alamat.');
          setTimeout(() => {
            suppressAutoGeocodeRef.current = false;
          }, 400);
        } else {
          setGeocodeNote('Alamat belum ditemukan di peta. Klik langsung pada peta untuk menempatkan pin.');
        }
      } catch (err: unknown) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setGeocodeNote(
          err instanceof Error
            ? err.message
            : 'Tidak dapat memetakan alamat otomatis. Klik peta untuk menandai titik.'
        );
      } finally {
        setGeocoding(false);
      }
    },
    [mode, kioskLocation.lat, kioskLocation.lng, onChange]
  );

  const handleAddressTextChange = (nextText: string) => {
    setSearchQuery(nextText);
    setDropdownOpen(true);
    setGeocodeNote(null);
    onChange({
      ...latestValueRef.current,
      alamat_lengkap: nextText,
    });

    if (autoGeocodeTimerRef.current) {
      clearTimeout(autoGeocodeTimerRef.current);
    }
    if (nextText.trim().length >= 8) {
      autoGeocodeTimerRef.current = setTimeout(() => {
        void runAddressGeocode(nextText, false);
      }, 900);
    }
  };

  useEffect(() => {
    return () => {
      if (autoGeocodeTimerRef.current) clearTimeout(autoGeocodeTimerRef.current);
    };
  }, []);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    if (autoGeocodeTimerRef.current) clearTimeout(autoGeocodeTimerRef.current);
    setDropdownOpen(false);
    setGeocoding(true);
    setGeocodeNote(null);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['formattedAddress', 'location', 'viewport', 'addressComponents'],
      });
      const loc = place.location;
      if (loc) {
        const lat = loc.lat();
        const lng = loc.lng();
        const formatted = place.formattedAddress || suggestion.placePrediction.text.text;
        const area = extractAreaFromPlace(place, formatted);
        suppressAutoGeocodeRef.current = true;
        setSearchQuery(formatted);
        setSuggestions([]);
        applyPinnedCoordinates(lat, lng, formatted, area);
        setGeocodeNote('Lokasi dipilih dari saran Google Maps.');
        setTimeout(() => {
          suppressAutoGeocodeRef.current = false;
        }, 400);
      }
      sessionTokenRef.current = null;
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setGeocodeNote('Gagal memuat detail lokasi pilihan.');
    } finally {
      setGeocoding(false);
    }
  };

  const handlePinReposition = async (lat: number, lng: number) => {
    if (autoGeocodeTimerRef.current) clearTimeout(autoGeocodeTimerRef.current);
    suppressAutoGeocodeRef.current = true;
    applyPinnedCoordinates(lat, lng);
    setGeocoding(true);
    setGeocodeNote(null);
    try {
      const rev = await api.reverseGeocodeCoords(lat, lng);
      if (rev.found && rev.formattedAddress) {
        setSearchQuery(rev.formattedAddress);
        const dist =
          mode === 'buyer' ? haversineDistanceKm(kioskLocation, { lat, lng }) : 0;
        onChange({
          alamat_lengkap: rev.formattedAddress,
          nama_wilayah: rev.areaLabel || latestValueRef.current.nama_wilayah || 'Lokasi Terpin',
          lat,
          lng,
          jarak_km: dist,
        });
      }
    } catch {
      // Keep coordinates even if reverse geocode fails
    } finally {
      setGeocoding(false);
      setTimeout(() => {
        suppressAutoGeocodeRef.current = false;
      }, 400);
    }
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      setGeocodeNote('Browser tidak mendukung deteksi lokasi GPS.');
      return;
    }
    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void handlePinReposition(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeocoding(false);
        setGeocodeNote('Izin lokasi ditolak. Masukkan alamat atau klik titik di peta.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRouteDistance = useCallback(
    (km: number, usedRoutes: boolean) => {
      setViaRoutesApi(usedRoutes);
      const curr = latestValueRef.current;
      if (curr.lat !== null && curr.lng !== null && curr.jarak_km !== km) {
        onChange({
          ...curr,
          jarak_km: km,
        });
      }
    },
    [onChange]
  );

  const hasCustomerPin = value.lat !== null && value.lng !== null;
  const activePinCoords = hasCustomerPin
    ? { lat: value.lat as number, lng: value.lng as number }
    : mode === 'seller'
    ? kioskLocation
    : null;

  const mapCenter = activePinCoords || kioskLocation || DEFAULT_CENTER;
  const distanceKm =
    mode === 'buyer' && hasCustomerPin
      ? value.jarak_km ?? haversineDistanceKm(kioskLocation, { lat: value.lat!, lng: value.lng! })
      : null;

  const estimatedOngkir =
    mode === 'buyer' && tarifOngkir && distanceKm !== null
      ? calculateDistanceShipping(sampleSubtotal, distanceKm, tarifOngkir)
      : null;
  const withinRadius =
    mode === 'buyer' && tarifOngkir && distanceKm !== null
      ? isAddressWithinRadius(distanceKm, tarifOngkir)
      : true;

  return (
    <div className="space-y-3">
      {/* Address Input + Autocomplete + Manual Geocode Button */}
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-xs font-medium text-zinc-700">
            {mode === 'seller'
              ? 'Alamat Kios (Pin Google Maps) *'
              : 'Alamat Lengkap Pengantaran (Otomatis Pin Google Maps) *'}
          </label>
          <button
            type="button"
            onClick={handleUseCurrentGps}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:text-teal-950"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Lokasi Saat Ini</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleAddressTextChange(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              placeholder={
                mode === 'seller'
                  ? 'Ketik alamat kios untuk menempatkan pin...'
                  : 'Ketik jalan, nomor rumah, kelurahan, atau nama tempat...'
              }
              className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>
          <button
            type="button"
            disabled={geocoding || searchQuery.trim().length < 4}
            onClick={() => void runAddressGeocode(searchQuery, false)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900 disabled:opacity-45 shrink-0"
          >
            {geocoding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MapPin className="w-3.5 h-3.5" />
            )}
            <span>Cari Pin di Peta</span>
          </button>
        </div>

        {dropdownOpen && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-zinc-100">
            {suggestions.map((s, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => void handleSelectSuggestion(s)}
                  className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-teal-50/70 transition-colors flex items-start gap-2.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-teal-800 shrink-0 mt-0.5" />
                  <span className="text-zinc-800 leading-snug">
                    {s.placePrediction?.text.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kecamatan / Area summary (auto-filled from Google Maps, editable) */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          Kecamatan / Kota (Terisi otomatis dari pin peta)
        </label>
        <input
          type="text"
          value={value.nama_wilayah}
          onChange={(e) =>
            onChange({
              ...value,
              nama_wilayah: e.target.value,
            })
          }
          placeholder="Contoh: Menteng, Jakarta Pusat"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Interactive Google Map Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            {mode === 'seller'
              ? 'Klik peta atau geser pin hijau untuk menentukan titik lokasi kios.'
              : 'Klik peta atau geser pin oranye untuk menyesuaikan titik pengantaran.'}
          </span>
          {geocoding && (
            <span className="inline-flex items-center gap-1 text-teal-800 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              Memetakan...
            </span>
          )}
        </div>

        {mapsAvailable ? (
          <div className="h-[260px] sm:h-[300px] w-full rounded-xl overflow-hidden border border-zinc-200 bg-stone-100">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={mapCenter}
              defaultZoom={14}
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={false}
              internalUsageAttributionIds={GMP_ATTRIBUTION}
              onClick={(ev) => {
                const ll = ev.detail.latLng;
                if (ll) {
                  void handlePinReposition(ll.lat, ll.lng);
                }
              }}
            >
              {/* Kiosk Marker (Always visible in buyer mode as origin; draggable in seller mode) */}
              {mode === 'buyer' ? (
                <AdvancedMarker
                  position={kioskLocation}
                  title={kioskName}
                >
                  <Pin
                    background="#0F4C46"
                    glyphColor="#FFFFFF"
                    borderColor="#09332F"
                  />
                </AdvancedMarker>
              ) : (
                <AdvancedMarker
                  position={activePinCoords || kioskLocation}
                  draggable
                  title={kioskName}
                  onDragEnd={(e) => {
                    const ll = e.latLng;
                    if (ll) void handlePinReposition(ll.lat(), ll.lng());
                  }}
                >
                  <Pin
                    background="#0F4C46"
                    glyphColor="#FFFFFF"
                    borderColor="#09332F"
                  />
                </AdvancedMarker>
              )}

              {/* Buyer Delivery Pin (Draggable) */}
              {mode === 'buyer' && hasCustomerPin && (
                <AdvancedMarker
                  position={{ lat: value.lat!, lng: value.lng! }}
                  draggable
                  title="Titik Alamat Pengantaran"
                  onDragEnd={(e) => {
                    const ll = e.latLng;
                    if (ll) void handlePinReposition(ll.lat(), ll.lng());
                  }}
                >
                  <Pin
                    background="#D97706"
                    glyphColor="#FFFFFF"
                    borderColor="#92400E"
                  />
                </AdvancedMarker>
              )}

              {/* Pan / Route Calculation */}
              {mode === 'buyer' && hasCustomerPin ? (
                <DeliveryRouteLayer
                  origin={kioskLocation}
                  destination={{ lat: value.lat!, lng: value.lng! }}
                  onDistanceComputed={handleRouteDistance}
                  fitBoth
                />
              ) : (
                <MapCameraPanner target={activePinCoords || kioskLocation} zoom={15} />
              )}
            </GoogleMap>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Peta Google Maps sedang memuat atau kunci API belum aktif.
          </div>
        )}

        {geocodeNote && (
          <p className="text-xs text-teal-800 font-medium">{geocodeNote}</p>
        )}

        {/* Pin & Shipping Cost Indicator Bar */}
        {mode === 'buyer' && (
          <div
            className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
              !hasCustomerPin
                ? 'bg-stone-50 border-zinc-200 text-zinc-600'
                : withinRadius
                ? 'bg-teal-50/70 border-teal-200 text-teal-950'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {!hasCustomerPin ? (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>
                  Masukkan alamat di atas atau klik peta untuk menampilkan pin &amp; menghitung ongkos kirim otomatis.
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Navigation className="w-3.5 h-3.5 text-teal-800" />
                    Jarak dari Kios: <span className="tabular-nums">{distanceKm?.toFixed(1)} km</span>
                    {viaRoutesApi && (
                      <span className="text-[11px] font-normal text-zinc-600">(rute jalan Google Maps)</span>
                    )}
                  </span>
                  {estimatedOngkir !== null && (
                    <span className="font-bold text-sm tabular-nums">
                      {withinRadius
                        ? estimatedOngkir === 0
                          ? 'Gratis Ongkir (Rp0)'
                          : `Estimasi Ongkir: ${formatRupiah(estimatedOngkir)}`
                        : `Di luar radius maks (${tarifOngkir?.batas_radius_km} km)`}
                    </span>
                  )}
                </div>
                <div className="text-[11px] opacity-80 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="font-mono">
                    Koordinat: {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)}
                  </span>
                  {tarifOngkir?.minimal_belanja_gratis_ongkir && withinRadius && (
                    <span>
                      · Gratis ongkir min. belanja {formatRupiah(tarifOngkir.minimal_belanja_gratis_ongkir)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'seller' && activePinCoords && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-950 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Store className="w-3.5 h-3.5 text-teal-800" />
              Titik Kios Terpasang
            </span>
            <span className="font-mono text-[11px]">
              {activePinCoords.lat.toFixed(5)}, {activePinCoords.lng.toFixed(5)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StoreLocationMapCard({
  mapsAvailable,
  kioskLocation,
  namaToko,
  alamatKios,
  tarifOngkir,
  onActionPinAddress,
}: {
  mapsAvailable: boolean;
  kioskLocation: { lat: number; lng: number };
  namaToko: string;
  alamatKios: string;
  tarifOngkir: TarifOngkirJarak;
  onActionPinAddress: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 grid lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-6 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-zinc-900">
              Ongkos Kirim Otomatis Berbasis Google Maps
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
              Masukkan alamat pengantaran Anda untuk menampilkan pin lokasi otomatis di Google Maps. Ongkos kirim dihitung adil berdasarkan jarak rute dari kios kami.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-200/80">
              <div className="text-zinc-500">Tarif Dasar</div>
              <div className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">
                {formatRupiah(tarifOngkir.tarif_dasar)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-200/80">
              <div className="text-zinc-500">Tarif per Kilometer</div>
              <div className="text-sm font-bold text-teal-800 tabular-nums mt-0.5">
                +{formatRupiah(tarifOngkir.tarif_per_km)} / km
              </div>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-200/80">
              <div className="text-zinc-500">Radius Pengantaran</div>
              <div className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">
                Maks. {tarifOngkir.batas_radius_km} km
              </div>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-200/80">
              <div className="text-zinc-500">Gratis Ongkir</div>
              <div className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">
                {tarifOngkir.minimal_belanja_gratis_ongkir
                  ? `Min. ${formatRupiah(tarifOngkir.minimal_belanja_gratis_ongkir)}`
                  : 'Sesuai jarak'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onActionPinAddress}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-teal-800 text-white rounded-lg hover:bg-teal-900 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            <span>Pin Alamat &amp; Cek Ongkir Sekarang</span>
          </button>
        </div>

        <div className="lg:col-span-6">
          {mapsAvailable ? (
            <div className="h-[220px] sm:h-[250px] w-full rounded-xl overflow-hidden border border-zinc-200 bg-stone-100">
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={kioskLocation}
                defaultZoom={14}
                gestureHandling="cooperative"
                streetViewControl={false}
                mapTypeControl={false}
                internalUsageAttributionIds={GMP_ATTRIBUTION}
              >
                <AdvancedMarker
                  position={kioskLocation}
                  title={namaToko}
                  onClick={() => setInfoOpen((prev) => !prev)}
                >
                  <Pin background="#0F4C46" glyphColor="#FFFFFF" borderColor="#09332F" />
                </AdvancedMarker>
                {infoOpen && (
                  <InfoWindow position={kioskLocation} onCloseClick={() => setInfoOpen(false)}>
                    <div className="text-xs max-w-[200px] space-y-0.5 p-0.5">
                      <div className="font-bold text-zinc-900">{namaToko}</div>
                      <div className="text-zinc-600 leading-snug">{alamatKios}</div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </div>
          ) : (
            <div className="h-[220px] rounded-xl bg-stone-100 border border-zinc-200 flex items-center justify-center p-4 text-center text-xs text-zinc-500">
              Lokasi Kios: {alamatKios}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function DeliveryRoutePreviewMap({
  mapsAvailable,
  origin,
  destination,
  kioskLabel = 'Kios RMStore',
  destinationLabel = 'Alamat Pengantaran',
  heightClass = 'h-[175px]',
}: {
  mapsAvailable: boolean;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  kioskLabel?: string;
  destinationLabel?: string;
  heightClass?: string;
}) {
  if (!mapsAvailable) return null;

  return (
    <div className={`${heightClass} w-full rounded-xl overflow-hidden border border-zinc-200 bg-stone-100`}>
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={destination}
        defaultZoom={13}
        gestureHandling="cooperative"
        streetViewControl={false}
        mapTypeControl={false}
        disableDefaultUI
        internalUsageAttributionIds={GMP_ATTRIBUTION}
      >
        <AdvancedMarker position={origin} title={kioskLabel}>
          <Pin background="#0F4C46" glyphColor="#FFFFFF" borderColor="#09332F" />
        </AdvancedMarker>
        <AdvancedMarker position={destination} title={destinationLabel}>
          <Pin background="#D97706" glyphColor="#FFFFFF" borderColor="#92400E" />
        </AdvancedMarker>
        <DeliveryRouteLayer origin={origin} destination={destination} fitBoth />
      </GoogleMap>
    </div>
  );
}

function DeliveryMultiBoundsFitter({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map || !coreLib || points.length === 0) return;
    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new coreLib.LatLngBounds();
    points.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, 48);
  }, [map, coreLib, points.length]);

  return null;
}

export function SellerDeliveryOverviewMap({
  mapsAvailable,
  kioskLocation,
  kioskName,
  orders,
  onSelectOrder,
}: {
  mapsAvailable: boolean;
  kioskLocation: { lat: number; lng: number };
  kioskName: string;
  orders: Pesanan[];
  onSelectOrder: (orderId: string) => void;
}) {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const pinnedOrders = orders.filter(
    (o) => typeof o.lat === 'number' && typeof o.lng === 'number'
  );

  if (!mapsAvailable || pinnedOrders.length === 0) return null;

  const allPoints = [
    kioskLocation,
    ...pinnedOrders.map((o) => ({ lat: o.lat as number, lng: o.lng as number })),
  ];
  const activeOrder = pinnedOrders.find((o) => o.id === activeOrderId) || null;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-900">
          <Truck className="w-4 h-4 text-teal-800" />
          Peta Sebaran Titik Pengantaran ({pinnedOrders.length} alamat)
        </span>
        <span className="text-zinc-500">Klik pin oranye untuk melihat detail tujuan</span>
      </div>
      <div className="h-[240px] w-full rounded-xl overflow-hidden border border-zinc-200 bg-stone-100">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={kioskLocation}
          defaultZoom={12}
          gestureHandling="cooperative"
          streetViewControl={false}
          mapTypeControl={false}
          internalUsageAttributionIds={GMP_ATTRIBUTION}
        >
          <AdvancedMarker position={kioskLocation} title={kioskName}>
            <Pin background="#0F4C46" glyphColor="#FFFFFF" borderColor="#09332F" />
          </AdvancedMarker>
          {pinnedOrders.map((ord) => (
            <AdvancedMarker
              key={ord.id}
              position={{ lat: ord.lat!, lng: ord.lng! }}
              title={`${ord.nomor_pesanan} - ${ord.nama_penerima}`}
              onClick={() => setActiveOrderId(ord.id)}
            >
              <Pin background="#D97706" glyphColor="#FFFFFF" borderColor="#92400E" />
            </AdvancedMarker>
          ))}
          {activeOrder && (
            <InfoWindow
              position={{ lat: activeOrder.lat!, lng: activeOrder.lng! }}
              onCloseClick={() => setActiveOrderId(null)}
            >
              <div className="text-xs max-w-[220px] space-y-1 p-0.5">
                <div className="font-mono font-bold text-zinc-900">{activeOrder.nomor_pesanan}</div>
                <div className="font-semibold text-zinc-800">{activeOrder.nama_penerima}</div>
                <div className="text-zinc-600 line-clamp-2">{activeOrder.alamat_lengkap}</div>
                <div className="text-teal-800 font-semibold">
                  {activeOrder.jarak_km ? `${activeOrder.jarak_km} km · ` : ''}
                  COD {formatRupiah(activeOrder.total_cod)}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectOrder(activeOrder.id)}
                  className="text-teal-800 underline font-semibold pt-0.5"
                >
                  Buka Detail Pesanan
                </button>
              </div>
            </InfoWindow>
          )}
          <DeliveryMultiBoundsFitter points={allPoints} />
        </GoogleMap>
      </div>
    </div>
  );
}
