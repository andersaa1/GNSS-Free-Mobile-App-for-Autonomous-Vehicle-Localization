import React from 'react';
import { 
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
} from "@maplibre/maplibre-react-native";

type Props = {
  roadsGeoJSON: any;
}

export default function MapScreen({ roadsGeoJSON }: Props) {
  return (
    <MapView 
      style={{ flex: 1 }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty" // OpenFreeMap Liberty style
    >
    {/* Camera settings */}
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
      maxZoomLevel={19}
    />

    <ShapeSource id="roads" shape={roadsGeoJSON}>
      <LineLayer
        id="road-lines"
        style={{
          lineColor: '#ff0000',
          lineWidth: 2,
        }}
      />
    </ShapeSource>
    </MapView>
  );
}