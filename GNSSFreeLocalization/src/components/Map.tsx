import React from "react";
import { MapView, Camera, ShapeSource, LineLayer, CircleLayer } from '@maplibre/maplibre-react-native';
import { buildStyleWithRoadOverrides, loadBaseLibertyStyle } from "../services/maps/style";

type Props = {
  // Map style
  mapStyle: any;
  // Particles
  particlesGeoJSON: any;
  particlesColor: { r: number; g: number; b: number };
  particlesRadius: number;
};

function MapComponent({
  // Map style
  mapStyle,
  // Particles
  particlesGeoJSON,
  particlesColor,
  particlesRadius,
}: Props) {
  // Converts RGB to css string
  const particlesColorString = `rgba(${particlesColor.r}, ${particlesColor.g}, ${particlesColor.b})`;

  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle={mapStyle} // OpenFreeMap Liberty style
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
    </MapView>
  );
}

// Memorize the Map component to prevent unnecessary re-renders
const Map = React.memo(
  MapComponent,
  (prev, next) =>
    prev.mapStyle === next.mapStyle &&
    prev.particlesGeoJSON === next.particlesGeoJSON &&
    prev.particlesColor.r === next.particlesColor.r &&
    prev.particlesColor.g === next.particlesColor.g &&
    prev.particlesColor.b === next.particlesColor.b &&
    prev.particlesRadius === next.particlesRadius,
);

export default Map;
