import { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MapView, Polyline, Marker } from '@/components/MapView';

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

const ROUTE_COLORS = ['#003087', '#d32f2f', '#2e7d32'];

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
  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
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
        setError('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setGpsCoords(coords);
      setOrigin('My Location');
      setOriginCoords(coords);
      mapRef.current?.animateToRegion({
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }, 500);
    } catch {
      setError('Could not get GPS location');
    } finally {
      setGpsLoading(false);
    }
  }, []);

  const planRoute = useCallback(async () => {
    if (!originCoords || !destCoords) {
      setError('Please select locations from the suggestions');
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
          mapRef.current?.animateToRegion({
            latitude: avgLat,
            longitude: avgLng,
            latitudeDelta: Math.max(dlat, 0.1),
            longitudeDelta: Math.max(dlng, 0.1),
          }, 500);
        }
      }
    } catch (err: any) {
      if (err.status === 401) { router.replace('/login'); return; }
      setError(err.detail || 'Failed to plan route');
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
      mapRef.current?.animateToRegion({
        ...mid,
        latitudeDelta: Math.max(dlat, 0.05),
        longitudeDelta: Math.max(dlng, 0.05),
      }, 500);
    }
  }, [originCoords, destCoords]);

  const displayPoints = [];
  if (gpsCoords) displayPoints.push({ coordinate: { latitude: gpsCoords.lat, longitude: gpsCoords.lng }, title: 'You are here', color: '#003087' });
  if (originCoords && origin !== 'My Location') displayPoints.push({ coordinate: { latitude: originCoords.lat, longitude: originCoords.lng }, title: origin, color: '#2e7d32' });
  if (destCoords) displayPoints.push({ coordinate: { latitude: destCoords.lat, longitude: destCoords.lng }, title: destination, color: '#d32f2f' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🗺️</Text>
          <Text style={styles.headerTitle}>Routes</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="From (e.g. Port Louis)"
              placeholderTextColor="#747683"
              value={origin}
              onChangeText={onOriginChange}
              onFocus={() => originSuggestions.length > 0 && setShowSuggestions('origin')}
            />
            <TouchableOpacity style={styles.gpsBtn} onPress={useGps} disabled={gpsLoading}>
              {gpsLoading ? <ActivityIndicator size="small" color="#003087" /> : <Text style={styles.gpsIcon}>📍</Text>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.swapBtn} onPress={swapLocations}>
            <Text style={styles.swapIcon}>⇄</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="To (e.g. Curepipe)"
            placeholderTextColor="#747683"
            value={destination}
            onChangeText={onDestChange}
            onFocus={() => destSuggestions.length > 0 && setShowSuggestions('destination')}
          />
        </View>

        {showSuggestions === 'origin' && originSuggestions.length > 0 && (
          <View style={styles.suggestions}>
            {originSuggestions.slice(0, 5).map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => pickOrigin(s)}>
                <Text style={styles.suggestionText} numberOfLines={1}>{s.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {showSuggestions === 'destination' && destSuggestions.length > 0 && (
          <View style={styles.suggestions}>
            {destSuggestions.slice(0, 5).map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => pickDest(s)}>
                <Text style={styles.suggestionText} numberOfLines={1}>{s.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.fuelRow}>
          <TouchableOpacity
            style={[styles.fuelBtn, selectedFuel === 'petrol' && styles.fuelBtnActive]}
            onPress={() => setSelectedFuel('petrol')}
          >
            <Text style={[styles.fuelBtnText, selectedFuel === 'petrol' && styles.fuelBtnTextActive]}>Petrol</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fuelBtn, selectedFuel === 'diesel' && styles.fuelBtnActive]}
            onPress={() => setSelectedFuel('diesel')}
          >
            <Text style={[styles.fuelBtnText, selectedFuel === 'diesel' && styles.fuelBtnTextActive]}>Diesel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.planBtn, (!originCoords || !destCoords || loading) && styles.buttonDisabled]}
            onPress={planRoute}
            disabled={!originCoords || !destCoords || loading}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.planBtnText}>Plan</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
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
              strokeColor={ROUTE_COLORS[i % ROUTE_COLORS.length]}
              strokeWidth={i === 0 ? 5 : 3}
              strokeOpacity={i === 0 ? 1 : 0.5}
            />
          ))}
          {gasStations.map((s) => (
            <Marker
              key={`gs-${s.id}`}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={`⛽ ${s.name}`}
              description={`${s.brand} · ${s.distance_km.toFixed(1)} km`}
              pinColor="#f57c00"
            />
          ))}
        </MapView>
        {routes.length > 0 && (
          <TouchableOpacity style={styles.fitBtn} onPress={fitMapToRoutes}>
            <Text style={styles.fitBtnText}>⊞ Fit</Text>
          </TouchableOpacity>
        )}
      </View>

      {routes.length > 0 && (
        <ScrollView style={styles.routesContainer} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routesContent}>
          {routes.map((route, i) => (
            <View key={i} style={[styles.routeCard, i === 0 && styles.routeCardBest]}>
              <View style={styles.routeCardHeader}>
                <Text style={styles.routeRank}>#{route.rank}</Text>
                {i === 0 && <Text style={styles.bestBadge}>★ Best</Text>}
                <Text style={[styles.routeScore, { color: route.ai_score > 70 ? '#2e7d32' : route.ai_score > 50 ? '#f57c00' : '#d32f2f' }]}>
                  {route.ai_score}%
                </Text>
              </View>
              <Text style={styles.routeRecommendation}>{route.recommendation}</Text>
              <View style={styles.routeStats}>
                <Text style={styles.routeStat}>{route.distance_km} km</Text>
                <Text style={styles.routeStat}>{Math.round(route.duration_min + route.traffic_delay_min)} min</Text>
                <Text style={styles.routeStat}>${route.fuel_cost_usd.toFixed(2)}</Text>
              </View>
              {route.traffic_delay_min > 0 && (
                <Text style={[styles.trafficText, { color: route.congestion === 'heavy' ? '#d32f2f' : '#f57c00' }]}>
                  🚦 +{route.traffic_delay_min} min delay ({route.congestion})
                </Text>
              )}
              {route.gas_stations.length > 0 && (
                <Text style={styles.gasText}>⛽ {route.gas_stations.length} station{route.gas_stations.length > 1 ? 's' : ''} nearby</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9fc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56, backgroundColor: '#f9f9fc',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#003087' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 22 },
  inputCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    marginHorizontal: 12, padding: 12, gap: 8, marginBottom: 8,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrapper: { flex: 1, position: 'relative' },
  input: {
    height: 40, borderWidth: 1, borderColor: '#c4c6d4', borderRadius: 8,
    paddingHorizontal: 12, fontSize: 14, color: '#1a1c1e', backgroundColor: '#f9f9fc',
  },
  gpsBtn: { position: 'absolute', right: 6, top: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  gpsIcon: { fontSize: 16 },
  swapBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f3f3f6', alignItems: 'center', justifyContent: 'center' },
  swapIcon: { fontSize: 18, color: '#003087' },
  suggestions: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c4c6d4', borderRadius: 8,
    maxHeight: 180,
  },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f3f6' },
  suggestionText: { fontSize: 13, color: '#1a1c1e' },
  fuelRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fuelBtn: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6,
    backgroundColor: '#f9f9fc', borderWidth: 1, borderColor: '#c4c6d4',
  },
  fuelBtnActive: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
  fuelBtnText: { fontSize: 12, fontWeight: '600', color: '#747683' },
  fuelBtnTextActive: { color: '#003087' },
  planBtn: {
    flex: 1, height: 34, backgroundColor: '#003087', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  planBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  buttonDisabled: { opacity: 0.6 },
  errorBanner: { backgroundColor: '#ffdad6', marginHorizontal: 12, padding: 10, borderRadius: 8, marginBottom: 8 },
  errorText: { fontSize: 13, color: '#93000a' },
  mapContainer: { flex: 1, marginHorizontal: 12, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  fitBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#dee5ef',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  fitBtnText: { fontSize: 12, fontWeight: '600', color: '#003087' },
  routesContainer: { position: 'absolute', bottom: 8, left: 0, right: 0 },
  routesContent: { paddingHorizontal: 12, gap: 8 },
  routeCard: {
    backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#dee5ef',
    padding: 14, width: 220, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  routeCardBest: { borderColor: '#003087', borderWidth: 2 },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeRank: { fontSize: 16, fontWeight: '700', color: '#1a1c1e' },
  bestBadge: { fontSize: 10, fontWeight: '700', color: '#003087', backgroundColor: '#dbe1ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  routeScore: { marginLeft: 'auto', fontSize: 14, fontWeight: '700' },
  routeRecommendation: { fontSize: 11, color: '#747683', fontStyle: 'italic' },
  routeStats: { flexDirection: 'row', gap: 12 },
  routeStat: { fontSize: 12, fontWeight: '600', color: '#444652' },
  trafficText: { fontSize: 11, fontWeight: '500' },
  gasText: { fontSize: 11, color: '#f57c00', fontWeight: '500' },
});
