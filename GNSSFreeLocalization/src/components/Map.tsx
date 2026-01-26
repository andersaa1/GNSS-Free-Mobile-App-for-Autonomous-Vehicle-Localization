import React from 'react';
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  CircleLayer,
} from '@maplibre/maplibre-react-native';

type Props = {
  // Data
  roadsGeoJSON: any;
  particlesGeoJSON: any;
  // Road display
  showRoads: boolean;
  roadColor: { r: number; g: number; b: number };
  roadWidth: number;
  // Particles display
  particlesColor: { r: number; g: number; b: number };
  particlesRadius: number;
};

function MapComponent({
  // Data
  roadsGeoJSON,
  particlesGeoJSON,
  // Road display
  showRoads,
  roadColor,
  roadWidth,
  // Particles display
  particlesColor,
  particlesRadius
}: Props) {
  // Converts RGB to css string
  const roadColorString = `rgba(${roadColor.r}, ${roadColor.g}, ${roadColor.b})`;
  const particlesColorString = `rgba(${particlesColor.r}, ${particlesColor.g}, ${particlesColor.b})`;

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

      {/* Particles Layer */}
      {particlesGeoJSON && (
        <ShapeSource id="particles" shape={particlesGeoJSON}>
          <CircleLayer
            id="particles"
            style={{
              circleRadius: particlesRadius,
              circleColor: particlesColorString,
            }}
          />
        </ShapeSource>
      )}

      {/* Roads Layer */}
      {showRoads && (
        <ShapeSource id="roads" shape={roadsGeoJSON}>
          <LineLayer
            id="road-lines"
            style={{
              lineColor: roadColorString,
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
    prev.particlesGeoJSON === next.particlesGeoJSON &&
    prev.showRoads === next.showRoads &&
    prev.roadColor.r === next.roadColor.r &&
    prev.roadColor.g === next.roadColor.g &&
    prev.roadColor.b === next.roadColor.b &&
    prev.roadWidth === next.roadWidth &&
    prev.particlesColor.r === next.particlesColor.r &&
    prev.particlesColor.g === next.particlesColor.g &&
    prev.particlesColor.b === next.particlesColor.b &&
    prev.particlesRadius === next.particlesRadius
);

export default Map;