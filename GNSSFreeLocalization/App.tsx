import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import MapScreen from './src/screens/MapScreen';
import loadBaseStyle from './src/app/loadBaseStyle'

function App() {
  const STYLES = ["liberty", "bright", "positron"] as const;
  type MapStyleId = typeof STYLES[number];

  const [mapStyleId, setMapStyleId] = useState<MapStyleId>("liberty");
  const [baseStyles, setBaseStyles] = useState<Record<MapStyleId, any> | null>(null);

  // loads the style
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Load all styles in parallel
      const loaded = await Promise.all(
        STYLES.map((id) => loadBaseStyle(id))
      );

      const styleMap: Record<MapStyleId, any> = {
        liberty: loaded[0],
        bright: loaded[1],
        positron: loaded[2],
      };

      if (!cancelled) setBaseStyles(styleMap);
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  // if still waiting for style, show a loading screen
  if (!baseStyles) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large"/>
        <Text style={{ paddingTop: 20 }}>loading map styles...</Text>
      </View>
    );
  }

  const baseStyle = baseStyles[mapStyleId];

  return <MapScreen initialStyle={baseStyle} mapStyleId={mapStyleId} onChangeMapStyleId={setMapStyleId}/>;
}

export default App;
