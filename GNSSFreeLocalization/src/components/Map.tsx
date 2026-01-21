import React from 'react';
import { 
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
} from "@maplibre/maplibre-react-native";

type Props = {
  roadsGeoJSON: any;
  showRoads: boolean;
  roadColor: { r: number; g: number; b: number; };
  roadWidth: number;
}

function MapComponent({ 
  roadsGeoJSON, 
  showRoads, 
  roadColor, 
  roadWidth 
}: Props) {
  // Converts RGB to css string
  const colorString = `rgba(${roadColor.r}, ${roadColor.g}, ${roadColor.b}, 0.9)`;

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
      {/* Roads Layer */}
      {showRoads && (
      <ShapeSource id="roads" shape={roadsGeoJSON}>
        <LineLayer
          id="road-lines"
          style={{
            lineColor: colorString,
            lineWidth: roadWidth,
          }}
        />
      </ShapeSource>
      )}
      </MapView>
  );
}

// Memorize the Map component to prevent unnecessary re-renders
const Map = React.memo(
  MapComponent,
  (prev, next) => 
    prev.roadsGeoJSON === next.roadsGeoJSON &&
    prev.showRoads === next.showRoads &&
    prev.roadColor.r === next.roadColor.r &&
    prev.roadColor.g === next.roadColor.g &&
    prev.roadColor.b === next.roadColor.b &&
    prev.roadWidth === next.roadWidth
);

export default Map;