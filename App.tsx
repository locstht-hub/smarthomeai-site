import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { DataProvider } from './src/contexts/DataContext';
import { ForecastProvider } from './src/contexts/ForecastContext';
import { SmartHomeServerProvider } from './src/contexts/SmartHomeServerContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <AuthProvider>
        <SmartHomeServerProvider>
          <DataProvider>
            <ForecastProvider>
              <AppNavigator />
            </ForecastProvider>
          </DataProvider>
        </SmartHomeServerProvider>
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
