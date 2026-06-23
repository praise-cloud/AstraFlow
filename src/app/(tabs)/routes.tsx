import { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';

import { api } from '@/services/api';

type Leg = { distance_km: number; duration_min: number; summary: string };
type RouteOption = {
  id: number;
  distance_km: number;
  duration_min: number;
  fuel_liters: number;
  cost_now: number;
  cost_future: number;
  savings_if_wait: number;
  geometry: { type: string; coordinates: [number, number][] };
  legs: Leg[];
};

type OptimizeResult = {
  origin: { query: string; lat: number; lng: number };
  destination: { query: string; lat: number; lng: number };
  fuel_type: string;
  current_price: number;
  avg_future_price: number;
  trend: string;
  change_pct: number;
  routes: RouteOption[];
};

const TREND_COLORS: Record<string, string> = {
  up: '#d32f2f', down: '#2e7d32', stable: '#f57c00',
};

function buildMapHtml(route: RouteOption | null, origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): string {
  const routeData = route ? JSON.stringify(route.geometry) : 'null';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; }
    body { overflow: hidden; }
    #map { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    L.marker([${origin.lat}, ${origin.lng}]).addTo(map)
      .bindPopup('Origin');

    L.marker([${dest.lat}, ${dest.lng}]).addTo(map)
      .bindPopup('Destination');

    var routeData = ${routeData};
    if (routeData) {
      var polyline = L.geoJSON(routeData, {
        style: { color: '#003087', weight: 4, opacity: 0.8 }
      }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else {
      var group = L.featureGroup([
        L.marker([${origin.lat}, ${origin.lng}]),
        L.marker([${dest.lat}, ${dest.lng}])
      ]);
      map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }
  </script>
</body>
</html>`;
}

export default function RoutesScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [fuelType, setFuelType] = useState<'petrol' | 'diesel'>('petrol');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!origin.trim() || !destination.trim()) {
      setError('Please enter both origin and destination');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedRoute(null);
    try {
      const res = await api.routes.optimize(origin.trim(), destination.trim(), fuelType);
      setResult(res);
      if (res.routes.length > 0) setSelectedRoute(res.routes[0].id);
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err.detail || 'Unable to find route');
    } finally {
      setLoading(false);
    }
  };

  const activeRoute = result?.routes.find(r => r.id === selectedRoute);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🗺️</Text>
          <Text style={styles.headerTitle}>Route Planner</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inputCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ORIGIN</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Port Louis"
              placeholderTextColor="#747683"
              value={origin}
              onChangeText={setOrigin}
              editable={!loading}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>DESTINATION</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grand Baie"
              placeholderTextColor="#747683"
              value={destination}
              onChangeText={setDestination}
              editable={!loading}
            />
          </View>
          <View style={styles.fuelToggle}>
            <TouchableOpacity
              style={[styles.fuelBtn, fuelType === 'petrol' && styles.fuelBtnActive]}
              onPress={() => setFuelType('petrol')}
            >
              <Text style={[styles.fuelBtnText, fuelType === 'petrol' && styles.fuelBtnTextActive]}>Petrol</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fuelBtn, fuelType === 'diesel' && styles.fuelBtnActive]}
              onPress={() => setFuelType('diesel')}
            >
              <Text style={[styles.fuelBtnText, fuelType === 'diesel' && styles.fuelBtnTextActive]}>Diesel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.searchButton, (!origin || !destination || loading) && styles.buttonDisabled]}
            onPress={handleSearch}
            disabled={!origin || !destination || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.searchButtonText}>Find Best Route</Text>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <>
            {result.origin.lat && (
              <View style={styles.mapCard}>
                <WebView
                  source={{ html: buildMapHtml(activeRoute || null, result.origin, result.destination) }}
                  style={styles.mapWebView}
                  scrollEnabled={false}
                  bounces={false}
                />
                <View style={styles.mapLabels}>
                  <Text style={styles.mapLabel}>📍 {result.origin.query}</Text>
                  <Text style={styles.mapLabel}>🏁 {result.destination.query}</Text>
                </View>
              </View>
            )}

            <View style={styles.priceBar}>
              <View>
                <Text style={styles.priceBarLabel}>Current Price</Text>
                <Text style={styles.priceBarValue}>Rs {result.current_price.toFixed(2)}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.priceBarLabel}>Forecast (30d)</Text>
                <Text style={[styles.priceBarValue, { color: TREND_COLORS[result.trend] }]}>
                  Rs {result.avg_future_price.toFixed(2)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.priceBarLabel}>Change</Text>
                <Text style={[styles.priceBarValue, { color: TREND_COLORS[result.trend] }]}>
                  {result.change_pct > 0 ? '+' : ''}{result.change_pct.toFixed(1)}%
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              {result.routes.length} Route{result.routes.length !== 1 ? 's' : ''} Found
            </Text>

            {result.routes.map(route => (
              <TouchableOpacity
                key={route.id}
                style={[styles.routeCard, selectedRoute === route.id && styles.routeCardSelected]}
                onPress={() => setSelectedRoute(route.id)}
              >
                <View style={styles.routeHeader}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>Route {route.id}</Text>
                  </View>
                  <Text style={styles.routeDistance}>{route.distance_km} km</Text>
                  <Text style={styles.routeDuration}>{route.duration_min} min</Text>
                </View>

                <View style={styles.routeCostRow}>
                  <View style={styles.costBox}>
                    <Text style={styles.costLabel}>Cost Now</Text>
                    <Text style={styles.costValue}>Rs {route.cost_now.toFixed(2)}</Text>
                  </View>
                  <View style={styles.costBox}>
                    <Text style={styles.costLabel}>Cost in 30d</Text>
                    <Text style={[styles.costValue, { color: route.savings_if_wait > 0 ? '#2e7d32' : '#d32f2f' }]}>
                      Rs {route.cost_future.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.costBox}>
                    <Text style={styles.costLabel}>Fuel</Text>
                    <Text style={styles.costValue}>{route.fuel_liters} L</Text>
                  </View>
                </View>

                {route.savings_if_wait > 0 && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>
                      Save Rs {route.savings_if_wait.toFixed(2)} if you wait 30 days
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 16 },
  inputCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#c4c6d4',
    padding: 20, gap: 12,
  },
  fieldGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#444652', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    height: 48, borderWidth: 1, borderColor: '#c4c6d4', borderRadius: 8,
    paddingHorizontal: 16, fontSize: 14, color: '#1a1c1e', backgroundColor: '#f9f9fc',
  },
  fuelToggle: { flexDirection: 'row', gap: 8 },
  fuelBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: '#f9f9fc',
    borderWidth: 1, borderColor: '#c4c6d4', alignItems: 'center',
  },
  fuelBtnActive: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
  fuelBtnText: { fontSize: 13, fontWeight: '600', color: '#747683' },
  fuelBtnTextActive: { color: '#003087' },
  searchButton: {
    height: 48, backgroundColor: '#003087', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  searchButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  errorBanner: { backgroundColor: '#ffdad6', padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, color: '#93000a' },
  mapCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    overflow: 'hidden',
  },
  mapWebView: { width: '100%', height: 240, backgroundColor: '#e2e2e5' },
  mapLabels: { padding: 12, gap: 4 },
  mapLabel: { fontSize: 13, color: '#444652' },
  priceBar: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, flexDirection: 'row', justifyContent: 'space-between',
  },
  priceBarLabel: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  priceBarValue: { fontSize: 16, fontWeight: '700', color: '#1a1c1e', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1c1e' },
  routeCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, gap: 12,
  },
  routeCardSelected: { borderColor: '#003087', borderWidth: 2 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeBadge: {
    backgroundColor: '#003087', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  routeBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  routeDistance: { fontSize: 14, fontWeight: '600', color: '#1a1c1e' },
  routeDuration: { fontSize: 14, color: '#747683' },
  routeCostRow: { flexDirection: 'row', gap: 12 },
  costBox: { flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#f3f3f6', borderRadius: 8 },
  costLabel: { fontSize: 10, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  costValue: { fontSize: 16, fontWeight: '700', color: '#1a1c1e', marginTop: 2 },
  savingsBadge: {
    backgroundColor: 'rgba(46,125,50,0.1)', borderWidth: 1, borderColor: 'rgba(46,125,50,0.2)',
    borderRadius: 6, padding: 10, alignItems: 'center',
  },
  savingsText: { fontSize: 13, fontWeight: '600', color: '#2e7d32' },
});
