import { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppColor } from '@/hooks/useAppColor';
import { MapView, Polyline, Marker, MapViewHandle } from '@/components/MapView';

import { api } from '@/services/api';

type RouteResult = {
  rank: number;
  distance_km: number;
  duration_min: number;
  traffic_delay_min: number;
  congestion: string;
  polyline: string;
  gas_stations: Array<{
    id: number;
    name: string;
    lat: number;
    lng: number;
    brand: string;
    distance_from_route_km: number;
  }>;
  fuel_cost_usd: number;
  ai_score: number;
  recommendation: string;
  legs: Array<{ distance_km: number; duration_min: number; summary: string }>;
};

type GeocodeResult = {
  display_name: string;
  lat: number;
  lng: number;
};

type GasStation = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  brand: string;
  operator: string;
  distance_km: number;
};

const MAURITIUS_REGION = {
  latitude: -20.25,
  longitude: 57.5,
  latitudeDelta: 0.7,
  longitudeDelta: 0.7,
};

function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const poly = [] as Array<{ latitude: number; longitude: number }>;
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}

export default function RoutesScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState<'origin' | 'destination' | null>(null);
  const [originSuggestions, setOriginSuggestions] = useState<GeocodeResult[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GeocodeResult[]>([]);
  const [selectedFuel, setSelectedFuel] = useState<'petrol' | 'diesel'>('petrol');
  const [error, setError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<'origin' | 'destination' | null>(null);
  const mapRef = useRef<MapViewHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = useAppColor();
  const { t } = useTranslation();
  const routeColors = [colors.accentPetrol, colors.trendUp, colors.trendDown];

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // Location unavailable or denied — user can tap GPS button to retry
      }
    })();
  }, []);

  const handleGeocode = useCallback(async (q: string, type: 'origin' | 'destination') => {
    if (!q || q.length < 3) {
      if (type === 'origin') setOriginSuggestions([]);
      else setDestSuggestions([]);
      return;
    }
    setGeocoding(type);
    try {
      const results = await api.routes.geocode(q);
      if (type === 'origin') setOriginSuggestions(results);
      else setDestSuggestions(results);
    } catch {
      if (type === 'origin') setOriginSuggestions([]);
      else setDestSuggestions([]);
    } finally {
      setGeocoding(null);
    }
  }, []);

  const onOriginChange = useCallback((v: string) => {
    setOrigin(v);
    setOriginCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleGeocode(v, 'origin'), 400);
    setShowSuggestions('origin');
  }, [handleGeocode]);

  const onDestChange = useCallback((v: string) => {
    setDestination(v);
    setDestCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleGeocode(v, 'destination'), 400);
    setShowSuggestions('destination');
  }, [handleGeocode]);

  const pickOrigin = useCallback((r: GeocodeResult) => {
    setOrigin(r.display_name.split(',')[0]);
    setOriginCoords({ lat: r.lat, lng: r.lng });
    setOriginSuggestions([]);
    setShowSuggestions(null);
  }, []);

  const pickDest = useCallback((r: GeocodeResult) => {
    setDestination(r.display_name.split(',')[0]);
    setDestCoords({ lat: r.lat, lng: r.lng });
    setDestSuggestions([]);
    setShowSuggestions(null);
  }, []);

  const useGps = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('routes.permissionDenied'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setGpsCoords(coords);
      setOrigin(t('routes.myLocation'));
      setOriginCoords(coords);
      mapRef.current?.animateToRegion?.({
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }, 500);
    } catch {
      setError(t('routes.gpsError'));
    } finally {
      setGpsLoading(false);
    }
  }, []);

  const planRoute = useCallback(async () => {
    if (!originCoords || !destCoords) {
      setError(t('routes.selectLocations'));
      return;
    }
    setLoading(true);
    setError(null);
    setRoutes([]);
    setGasStations([]);
    try {
      const res = await api.routes.plan({
        origin: origin || 'Origin',
        destination: destination || 'Destination',
        origin_lat: originCoords.lat,
        origin_lng: originCoords.lng,
        destination_lat: destCoords.lat,
        destination_lng: destCoords.lng,
        fuel_type: selectedFuel,
      });
      setRoutes(res.routes);

      const allStations = res.routes.flatMap(r => r.gas_stations);
      const seen = new Set<number>();
      const unique = allStations.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      setGasStations(unique);

      if (res.routes.length > 0) {
        const coords = res.routes[0].gas_stations;
        if (coords.length > 0) {
          const avgLat = (originCoords.lat + destCoords.lat) / 2;
          const avgLng = (originCoords.lng + destCoords.lng) / 2;
          const dlat = Math.abs(originCoords.lat - destCoords.lat) * 1.5;
          const dlng = Math.abs(originCoords.lng - destCoords.lng) * 1.5;
          mapRef.current?.animateToRegion?.({
            latitude: avgLat,
            longitude: avgLng,
            latitudeDelta: Math.max(dlat, 0.1),
            longitudeDelta: Math.max(dlng, 0.1),
          }, 500);
        }
      }
    } catch (err: any) {
      if (err.status === 401) { router.replace('/login'); return; }
      setError(err.detail || t('routes.routeError'));
    } finally {
      setLoading(false);
    }
  }, [origin, destination, originCoords, destCoords, selectedFuel]);

  const swapLocations = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
    setOriginCoords(destCoords);
    setDestCoords(originCoords);
  }, [origin, destination, originCoords, destCoords]);

  const fitMapToRoutes = useCallback(() => {
    if (originCoords && destCoords) {
      const mid = { latitude: (originCoords.lat + destCoords.lat) / 2, longitude: (originCoords.lng + destCoords.lng) / 2 };
      const dlat = Math.abs(originCoords.lat - destCoords.lat) * 1.8;
      const dlng = Math.abs(originCoords.lng - destCoords.lng) * 1.8;
      mapRef.current?.animateToRegion?.({
        ...mid,
        latitudeDelta: Math.max(dlat, 0.05),
        longitudeDelta: Math.max(dlng, 0.05),
      }, 500);
    }
  }, [originCoords, destCoords]);

  const displayPoints = [];
  if (gpsCoords) displayPoints.push({ coordinate: { latitude: gpsCoords.lat, longitude: gpsCoords.lng }, title: t('routes.youAreHere'), color: colors.accentPetrol });
  if (originCoords && origin !== t('routes.myLocation')) displayPoints.push({ coordinate: { latitude: originCoords.lat, longitude: originCoords.lng }, title: origin, color: colors.trendDown });
  if (destCoords) displayPoints.push({ coordinate: { latitude: destCoords.lat, longitude: destCoords.lng }, title: destination, color: colors.trendUp });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: colors.bg }]}>
          <View style={styles.headerLeft}>
            
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
            <Ionicons name="person-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.inputCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.borderInput }]}
                  placeholder={t('routes.fromPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={origin}
                  onChangeText={onOriginChange}
                  onFocus={() => originSuggestions.length > 0 && setShowSuggestions('origin')}
                />
                <TouchableOpacity style={styles.gpsBtn} onPress={useGps} disabled={gpsLoading}>
                  {gpsLoading ? <ActivityIndicator size="small" color={colors.accentPetrol} /> : <Ionicons name="locate-outline" size={18} color={colors.accentPetrol} />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.swapBtn, { backgroundColor: colors.bgSurface }]} onPress={swapLocations}>
                <Ionicons name="swap-horizontal-outline" size={20} color={colors.accentPetrol} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.borderInput }]}
                placeholder={t('routes.toPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={destination}
                onChangeText={onDestChange}
                onFocus={() => destSuggestions.length > 0 && setShowSuggestions('destination')}
              />
            </View>

            {showSuggestions === 'origin' && originSuggestions.length > 0 && (
              <View style={[styles.suggestions, { backgroundColor: colors.bgCard, borderColor: colors.borderInput }]}>
                {originSuggestions.slice(0, 5).map((s, i) => (
                  <TouchableOpacity key={i} style={[styles.suggestionItem, { borderBottomColor: colors.bgSurface }]} onPress={() => pickOrigin(s)}>
                    <Text style={[styles.suggestionText, { color: colors.textPrimary }]} numberOfLines={1}>{s.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {showSuggestions === 'destination' && destSuggestions.length > 0 && (
              <View style={[styles.suggestions, { backgroundColor: colors.bgCard, borderColor: colors.borderInput }]}>
                {destSuggestions.slice(0, 5).map((s, i) => (
                  <TouchableOpacity key={i} style={[styles.suggestionItem, { borderBottomColor: colors.bgSurface }]} onPress={() => pickDest(s)}>
                    <Text style={[styles.suggestionText, { color: colors.textPrimary }]} numberOfLines={1}>{s.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.fuelRow}>
              <TouchableOpacity
                style={[styles.fuelBtn, { backgroundColor: colors.bg, borderColor: colors.borderInput }, selectedFuel === 'petrol' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight }]}
                onPress={() => setSelectedFuel('petrol')}
              >
                <Text style={[styles.fuelBtnText, { color: selectedFuel === 'petrol' ? colors.accentPetrol : colors.textMuted }]}>{t('routes.petrol')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fuelBtn, { backgroundColor: colors.bg, borderColor: colors.borderInput }, selectedFuel === 'diesel' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight }]}
                onPress={() => setSelectedFuel('diesel')}
              >
                <Text style={[styles.fuelBtnText, { color: selectedFuel === 'diesel' ? colors.accentPetrol : colors.textMuted }]}>{t('routes.diesel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planBtn, { backgroundColor: colors.accentPetrol }, (!originCoords || !destCoords || loading) && styles.buttonDisabled]}
                onPress={planRoute}
                disabled={!originCoords || !destCoords || loading}
              >
                {loading ? <ActivityIndicator size="small" color={colors.textWhite} /> : <Text style={[styles.planBtnText, { color: colors.textWhite }]}>{t('routes.plan')}</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.trendUp + '20' }]}>
              <Text style={[styles.errorText, { color: colors.textError }]}>{error}</Text>
            </View>
          )}

          <View style={[styles.mapContainer, { backgroundColor: '#1c1c22' }]}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={MAURITIUS_REGION}
              showsUserLocation={false}
              showsTraffic={true}
            >
              {displayPoints.map((p, i) => (
                <Marker key={i} coordinate={p.coordinate} title={p.title} pinColor={p.color} />
              ))}
              {routes.map((route, i) => (
                <Polyline
                  key={i}
                  coordinates={decodePolyline(route.polyline)}
                  strokeColor={routeColors[i % routeColors.length]}
                  strokeWidth={i === 0 ? 5 : 3}
                  strokeOpacity={i === 0 ? 1 : 0.5}
                />
              ))}
              {gasStations.map((s) => (
                <Marker
                  key={`gs-${s.id}`}
                  coordinate={{ latitude: s.lat, longitude: s.lng }}
                  title={s.name}
                  description={t('routes.stationInfo', { brand: s.brand, distance: s.distance_km.toFixed(1) })}
                  pinColor={colors.accentPetrol}
                />
              ))}
            </MapView>
            {routes.length > 0 && (
              <TouchableOpacity style={[styles.fitBtn, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={fitMapToRoutes}>
                <Text style={[styles.fitBtnText, { color: colors.accentPetrol }]}>{t('routes.fitMap')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {routes.length > 0 && (
            <>
              <View style={[styles.fuelDetailCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: colors.accentPetrol }]}>
                <View style={styles.fuelDetailHeader}>
                  <Ionicons name="flame-outline" size={18} color={colors.accentPetrol} />
                  <Text style={[styles.fuelDetailTitle, { color: colors.textPrimary }]}>Fuel Estimate</Text>
                </View>
                <View style={styles.fuelDetailGrid}>
                  <View style={styles.fuelDetailItem}>
                    <Text style={[styles.fuelDetailLabel, { color: colors.textMuted }]}>Distance</Text>
                    <Text style={[styles.fuelDetailValue, { color: colors.textPrimary }]}>{routes[0].distance_km.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.fuelDetailItem}>
                    <Text style={[styles.fuelDetailLabel, { color: colors.textMuted }]}>Duration</Text>
                    <Text style={[styles.fuelDetailValue, { color: colors.textPrimary }]}>{Math.round(routes[0].duration_min + routes[0].traffic_delay_min)} min</Text>
                  </View>
                  <View style={styles.fuelDetailItem}>
                    <Text style={[styles.fuelDetailLabel, { color: colors.textMuted }]}>Est. Fuel</Text>
                    <Text style={[styles.fuelDetailValue, { color: colors.textPrimary }]}>{(routes[0].distance_km * 0.08).toFixed(1)} L</Text>
                  </View>
                  <View style={styles.fuelDetailItem}>
                    <Text style={[styles.fuelDetailLabel, { color: colors.textMuted }]}>Fuel Cost</Text>
                    <Text style={[styles.fuelDetailValue, { color: colors.accentDiesel }]}>${routes[0].fuel_cost_usd.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.routeCardsWrapper}>
                {routes.map((route, i) => (
                  <View key={i} style={[styles.routeCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: colors.shadow }, i === 0 && styles.routeCardBest, i === 0 && { borderColor: colors.accentPetrol }]}>
                    <View style={styles.routeCardHeader}>
                      <View style={styles.rankRow}>
                        <View style={[styles.rankBadge, { backgroundColor: i === 0 ? colors.accentPetrol : colors.bgSurface }]}>
                          <Text style={[styles.rankBadgeText, { color: i === 0 ? '#fff' : colors.textPrimary }]}>#{route.rank}</Text>
                        </View>
                        {i === 0 && (
                          <View style={[styles.bestBadge, { backgroundColor: colors.accentPetrol + '20' }]}>
                            <Ionicons name="star" size={13} color={colors.accentPetrol} />
                            <Text style={[styles.bestBadgeText, { color: colors.accentPetrol }]}>{t('routes.best')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.routeScore, { color: route.ai_score > 70 ? colors.trendDown : route.ai_score > 50 ? colors.trendStable : colors.trendUp }]}>
                        {route.ai_score}%
                      </Text>
                    </View>

                    <Text style={[styles.routeRecommendation, { color: colors.textMuted }]}>{route.recommendation}</Text>

                    <View style={styles.routeStatsRow}>
                      <View style={styles.routeStatItem}>
                        <Ionicons name="resize-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.routeStatValue, { color: colors.textPrimary }]}>{route.distance_km.toFixed(1)}</Text>
                        <Text style={[styles.routeStatUnit, { color: colors.textMuted }]}>km</Text>
                      </View>
                      <View style={[styles.routeStatDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.routeStatItem}>
                        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.routeStatValue, { color: colors.textPrimary }]}>{Math.round(route.duration_min + route.traffic_delay_min)}</Text>
                        <Text style={[styles.routeStatUnit, { color: colors.textMuted }]}>min</Text>
                      </View>
                      <View style={[styles.routeStatDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.routeStatItem}>
                        <Ionicons name="flame-outline" size={16} color={colors.accentDiesel} />
                        <Text style={[styles.routeStatValue, { color: colors.accentDiesel }]}>${route.fuel_cost_usd.toFixed(2)}</Text>
                        <Text style={[styles.routeStatUnit, { color: colors.textMuted }]}>fuel</Text>
                      </View>
                    </View>

                    <View style={styles.routeMetaRow}>
                      {route.traffic_delay_min > 0 && (
                        <View style={[styles.metaChip, { backgroundColor: colors.bgSurface }]}>
                          <Ionicons name="car-outline" size={13} color={route.congestion === 'heavy' ? colors.trendUp : colors.trendStable} />
                          <Text style={[styles.metaChipText, { color: route.congestion === 'heavy' ? colors.trendUp : colors.trendStable }]}>
                            +{route.traffic_delay_min}min {route.congestion}
                          </Text>
                        </View>
                      )}
                      {route.gas_stations.length > 0 && (
                        <View style={[styles.metaChip, { backgroundColor: colors.bgPrimaryLight }]}>
                          <Ionicons name="flame-outline" size={13} color={colors.accentPetrol} />
                          <Text style={[styles.metaChipText, { color: colors.accentPetrol }]}>
                            {route.gas_stations.length} station{route.gas_stations.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inputCard: {
    borderRadius: 14, borderWidth: 1,
    marginHorizontal: 15, marginTop: 4,
    padding: 16, gap: 14,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputWrapper: { flex: 1, position: 'relative' },
  input: {
    height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingRight: 36, fontSize: 14,
  },
  gpsBtn: { position: 'absolute', right: 6, top: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  swapBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  suggestions: {
    borderWidth: 1, borderRadius: 10,
    maxHeight: 180,
  },
  suggestionItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  suggestionText: { fontSize: 13 },
  fuelRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  fuelBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8,
    borderWidth: 1,
  },
  fuelBtnText: { fontSize: 13, fontWeight: '600' },
  planBtn: {
    flex: 1, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  planBtnText: { fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  errorBanner: { marginHorizontal: 15, padding: 10, borderRadius: 8, marginBottom: 4 },
  errorText: { fontSize: 13 },
  mapContainer: { height: 260, marginHorizontal: 15, marginTop: 12, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  fitBtn: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  fitBtnText: { fontSize: 12, fontWeight: '600' },
  fuelDetailCard: {
    borderRadius: 12, borderWidth: 1, borderLeftWidth: 4,
    marginHorizontal: 15, marginTop: 12,
    padding: 16, gap: 10,
  },
  fuelDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fuelDetailTitle: { fontSize: 14, fontWeight: '700' },
  fuelDetailGrid: { flexDirection: 'row' },
  fuelDetailItem: { flex: 1, alignItems: 'center', gap: 2 },
  fuelDetailLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  fuelDetailValue: { fontSize: 16, fontWeight: '700' },
  routeCardsWrapper: { gap: 10, marginHorizontal: 15, marginTop: 8 },
  routeCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, gap: 10,
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  routeCardBest: { borderWidth: 2 },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge: {
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  rankBadgeText: { fontSize: 13, fontWeight: '700' },
  bestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  bestBadgeText: { fontSize: 12, fontWeight: '700' },
  routeScore: { fontSize: 16, fontWeight: '800' },
  routeRecommendation: { fontSize: 12, fontStyle: 'italic' },
  routeStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
  },
  routeStatItem: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 2 },
  routeStatValue: { fontSize: 16, fontWeight: '700' },
  routeStatUnit: { fontSize: 10, fontWeight: '500' },
  routeStatDivider: { width: 1, height: 28 },
  routeMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6,
  },
  metaChipText: { fontSize: 11, fontWeight: '600' },
});
