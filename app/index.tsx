import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar, Dimensions, BackHandler, Alert, TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemedView } from '@/components/ThemedView';

// Get device dimensions for responsive layout
const { width, height } = Dimensions.get('window');

export default function AppScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Meta viewport tag to ensure proper scaling but allow zooming
  // Fix the injectedJavaScript string syntax
  const injectedJavaScript = `
    const meta = document.createElement('meta');
    meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=0.1, maximum-scale=10.0, user-scalable=yes');
    meta.setAttribute('name', 'viewport');
    document.getElementsByTagName('head')[0].appendChild(meta);
    true;
  `;

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent default behavior (exiting the app)
      }
      return false; // Let the default behavior happen (exit the app)
    };

    // Add event listener for hardware back button press
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    // Clean up the event listener when component unmounts
    return () => backHandler.remove();
  }, [canGoBack]);

  // Handle refresh with confirmation
  const onRefresh = () => {
    // Show confirmation alert
    Alert.alert(
      "Refresh Application",
      "Do you want to refresh the application?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "OK", 
          onPress: () => {
            // Start refresh animation
            setRefreshing(true);
            
            // Reload WebView
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
            
            // Stop refresh animation after a delay
            setTimeout(() => {
              setRefreshing(false);
            }, 1000);
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://goldfinal3.onrender.com/' }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          originWhitelist={['*']}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onShouldStartLoadWithRequest={() => true}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            console.log('Navigating to:', navState.url);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            Alert.alert('WebView error', nativeEvent.description);
            console.warn('WebView error: ', nativeEvent);
          }}
          startInLoadingState={true}
          renderError={(errorName) => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: 'red' }}>Failed to load page: {errorName}</Text>
            </View>
          )}
        />
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    width: width,
    height: height,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
});