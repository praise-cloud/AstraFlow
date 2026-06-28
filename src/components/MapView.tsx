import React, { useImperativeHandle, useRef, useCallback } from 'react';
import { Platform, View, Text, StyleSheet, ViewProps } from 'react-native';
import { WebView } from 'react-native-webview';

type LatLng = { latitude: number; longitude: number };

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
};

type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

type MapViewProps = {
  style?: any;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  showsTraffic?: boolean;
  children?: React.ReactNode;
};

export type MapViewHandle = {
  animateToRegion?: (region: Region, duration?: number) => void;
};

const isWeb = Platform.OS === 'web';

function buildLeafletHtml(region: Region, markers: any[], polylines: any[]): string {
  const center = `${region.latitude},${region.longitude}`;
  const zoom = Math.round(Math.log2(360 / Math.max(region.latitudeDelta, region.longitudeDelta)));

  const markerJs = markers.map((m: any, i: number) =>
    `L.marker([${m.coordinate.latitude}, ${m.coordinate.longitude}])` +
    `.bindPopup('${m.title || ''}')` +
    `${i === 0 ? ".addTo(map)" : ".addTo(map)"}`
  ).join(';\n');

  const polylineJs = polylines.map((p: any) => {
    const coords = p.coordinates.map((c: any) => `[${c.latitude}, ${c.longitude}]`).join(',');
    return `L.polyline([${coords}], {color: '${p.strokeColor || '#003087'}', weight: ${p.strokeWidth || 3}}).addTo(map)`;
  }).join(';\n');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100vw; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${center}], ${zoom});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
        ${markerJs};
        ${polylineJs};
      </script>
    </body>
    </html>
  `;
}

const MapViewComponent = React.forwardRef<MapViewHandle, MapViewProps>(
  (props, ref) => {
    const { style, initialRegion, children } = props;
    const webViewRef = useRef<any>(null);

    const markers: any[] = [];
    const polylines: any[] = [];
    React.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === 'Marker' || child?.type?.name === 'MarkerComponent') {
        markers.push(child.props);
      }
      if (child?.type?.displayName === 'Polyline' || child?.type?.name === 'PolylineComponent') {
        polylines.push(child.props);
      }
    });

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region, duration?: number) => {
        if (webViewRef.current) {
          const zoom = Math.round(Math.log2(360 / Math.max(region.latitudeDelta, region.longitudeDelta)));
          setTimeout(() => {
            webViewRef.current.injectJavaScript(`
              map.setView([${region.latitude}, ${region.longitude}], ${zoom});
              true;
            `);
          }, duration ?? 0);
        }
      },
    }));

    if (!initialRegion) {
      return (
        <View style={[styles.fallback, style]}>
          <Text style={styles.fallbackTitle}>Map</Text>
        </View>
      );
    }

    const html = buildLeafletHtml(initialRegion, markers, polylines);

    if (isWeb) {
      return (
        <View style={[styles.container, style]}>
          <iframe
            srcDoc={html}
            style={styles.iframe}
            title="OpenStreetMap"
            allowFullScreen
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
        />
      </View>
    );
  }
);

const MarkerComponent: React.FC<MarkerProps & ViewProps> = () => null;
MarkerComponent.displayName = 'MarkerComponent';

const PolylineComponent: React.FC<PolylineProps & ViewProps> = () => null;
PolylineComponent.displayName = 'PolylineComponent';

export const MapView = MapViewComponent;
export const Marker = MarkerComponent;
export const Polyline = PolylineComponent;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: '#1c1c22',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#eeeef0',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
});
