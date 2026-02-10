import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import MapScreen from './src/screens/MapScreen';
import loadStyle from './src/app/loadBaseStyle'

function App() {
  const [baseStyle, setBaseStyle] = useState<any>(null);

  // loads the style
  useEffect(() => {
    loadStyle().then(setBaseStyle);
  }, []);

  // if still waiting for style, show a loading screen
  if (!baseStyle) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large"/>
        <Text style={{ paddingTop: 20 }}>loading map style...</Text>
      </View>
    );
  }

  return <MapScreen style={baseStyle}/>;
}

export default App;
