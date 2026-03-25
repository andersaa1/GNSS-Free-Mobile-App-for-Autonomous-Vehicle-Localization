import React from "react";
import { MapView, Camera, ShapeSource, CircleLayer, FillLayer } from '@maplibre/maplibre-react-native';

type Props = {
  // Map style
  mapStyle: any;
  // Particles
  particlesGeoJSON: any;
  particlesColor: { r: number; g: number; b: number };
  particlesRadius: number;
  // Milestone boards
  milestoneBoardsGeoJSON: any;
  onPressMilestoneBoard: (featire: any) => void;
};

function MapComponent({
  // Map style
  mapStyle,
  // Particles
  particlesGeoJSON,
  particlesColor,
  particlesRadius,
  // Milestone boards
  milestoneBoardsGeoJSON,
  onPressMilestoneBoard
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
        maxBounds={{         // relative to screen:
          ne: [28.21, 59.8],  // RIGHT |  TOP 
          sw: [21.5, 57.51],  // LEFT  |  BOTTOM
        }}
        minZoomLevel={6.5}
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

      {/* Milestone board Layer */}
      {milestoneBoardsGeoJSON && (
        <ShapeSource
          id="milestone-boards"
          shape={milestoneBoardsGeoJSON}
          onPress={(event) => {
            const feature = event.features?.[0];
            if (feature) {
              onPressMilestoneBoard(feature);
            }
          }}
        >
          <FillLayer
            id="milestone-boards-square"
            style={{
              fillColor: "rgba(255, 165, 0, 0.9)",
              fillOutlineColor: "rgba(120, 80, 0, 1)",
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
    prev.particlesRadius === next.particlesRadius &&
    prev.milestoneBoardsGeoJSON === next.milestoneBoardsGeoJSON &&
    prev.onPressMilestoneBoard === next.onPressMilestoneBoard,
);

export default Map;
