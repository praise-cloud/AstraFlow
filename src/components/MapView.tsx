import React from 'react';
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
  ref?: React.Ref<any>;
  style?: any;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  showsTraffic?: boolean;
  children?: React.ReactNode;
};

type MapViewHandle = {
  animateToRegion?: (region: Region, duration?: number) => void;
};

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

let NativeMapView: any = View;
let NativeMarker: any = View;
let NativePolyline: any = View;
let PROVIDER_GOOGLE: any = null;

if (isNative) {
  try {
    const Maps = require('react-native-maps');
    NativeMapView = Maps.default || Maps.MapView;
    NativeMarker = Maps.Marker;
    NativePolyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch {
    console.warn('react-native-maps not available on native');
  }
}

const MapViewComponent = React.forwardRef<MapViewHandle, MapViewProps>(
  ({ style, initialRegion, showsUserLocation, showsTraffic, children, ...props }, ref) => {
    if (isNative) {
      return React.createElement(
        NativeMapView,
        {
          ...props,
          ref,
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
        <View style={[styles.webFallback, style]}>
          <Text style={styles.webFallbackText}>Map</Text>
        </View>
      );
    }

    const zoom = 12;
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
  if (isNative) {
    return React.createElement(NativeMarker, props);
  }
  return null;
};

const PolylineComponent: React.FC<PolylineProps & ViewProps> = (props) => {
  if (isNative) {
    return React.createElement(NativePolyline, props);
  }
  return null;
};

export { PROVIDER_GOOGLE };
export const MapView = MapViewComponent;
export const Marker = MarkerComponent;
export const Polyline = PolylineComponent;

const styles = StyleSheet.create({
  webFallback: {
    backgroundColor: '#e8ecf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFallbackText: {
    fontSize: 16,
    color: '#747683',
    fontWeight: '600',
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
