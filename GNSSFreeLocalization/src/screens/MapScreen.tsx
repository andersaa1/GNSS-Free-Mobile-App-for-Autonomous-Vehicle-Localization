import React from 'react';
import { 
  MapView,
  Camera,
} from "@maplibre/maplibre-react-native";

export default function MapScreen() {
  return (
    <MapView 
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty" // OpenFreeMap Liberty style
    >
    <Camera
      defaultSettings={{
        centerCoordinate: [25.0, 58.6],
        zoomLevel: 7,
      }}
      maxBounds={{
        ne: [28.2, 59.8],
        sw: [21.5, 57.4],
      }}
      minZoomLevel={7}
    />
    </MapView>
  );
}
