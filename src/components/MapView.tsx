import React, { useState, useImperativeHandle } from 'react';
import { Platform, View, Text, StyleSheet, ViewProps } from 'react-native';

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

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

let NativeMapView: any = null;
let NativeMarker: any = null;
let NativePolyline: any = null;
let PROVIDER_GOOGLE: any = null;
let mapLoaded = false;

if (isNative) {
  try {
    const Maps = require('react-native-maps');
    NativeMapView = Maps.default || Maps.MapView;
    NativeMarker = Maps.Marker;
    NativePolyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
    mapLoaded = true;
  } catch (e) {
    console.warn('react-native-maps failed to load:', e);
  }
}

const MapViewComponent = React.forwardRef<MapViewHandle, MapViewProps>(
  ({ style, initialRegion, showsUserLocation, showsTraffic, children, ...props }, ref) => {
    const [loadFailed] = useState(!mapLoaded);
    const nativeRef = React.useRef<any>(null);

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region, duration?: number) => {
        if (nativeRef.current?.animateToRegion) {
          nativeRef.current.animateToRegion(region, duration);
        }
      },
    }));

    if (isNative && loadFailed) {
      return (
        <View style={[styles.fallback, style]}>
          <Text style={styles.fallbackTitle}>Map Unavailable</Text>
          <Text style={styles.fallbackText}>The map library could not be loaded.</Text>
        </View>
      );
    }

    if (isNative && NativeMapView) {
      return React.createElement(
        NativeMapView,
        {
          ...props,
          ref: nativeRef,
          style,
          initialRegion,
          showsUserLocation,
          showsTraffic,
        },
        children
      );
    }

    if (!initialRegion) {
      return (
        <View style={[styles.fallback, style]}>
          <Text style={styles.fallbackTitle}>Map</Text>
        </View>
      );
    }

    const lat = initialRegion.latitude;
    const lng = initialRegion.longitude;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}&layer=mapnik&marker=${lat},${lng}`;

    return (
      <View style={[styles.webContainer, style]}>
        <iframe
          src={src}
          style={styles.webIframe}
          title="OpenStreetMap"
          allowFullScreen
        />
      </View>
    );
  }
);

const MarkerComponent: React.FC<MarkerProps & ViewProps> = (props) => {
  if (isNative && NativeMarker) {
    return React.createElement(NativeMarker, props);
  }
  return null;
};

const PolylineComponent: React.FC<PolylineProps & ViewProps> = (props) => {
  if (isNative && NativePolyline) {
    return React.createElement(NativePolyline, props);
  }
  return null;
};

export { PROVIDER_GOOGLE };
export const MapView = MapViewComponent;
export const Marker = MarkerComponent;
export const Polyline = PolylineComponent;

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#1c1c22',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#eeeef0',
    marginBottom: 4,
  },
  fallbackText: {
    fontSize: 12,
    color: '#6a6a7a',
    textAlign: 'center',
  },
  webContainer: {
    overflow: 'hidden',
  },
  webIframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
});
