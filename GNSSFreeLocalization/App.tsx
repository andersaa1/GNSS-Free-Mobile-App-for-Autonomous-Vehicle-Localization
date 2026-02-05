import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import MapScreen from './src/screens/MapScreen';
import { bootstrapRoads } from './src/app/bootstrapRoads';

function App() {
  const [roads, setRoads] = useState<any>(null);

  useEffect(() => {
    bootstrapRoads().then(setRoads);
  }, []);

  if (!roads) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <MapScreen roadsGeoJSON={roads} />;
}

export default App;
