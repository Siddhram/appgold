import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar, Dimensions, BackHandler, RefreshControl, ScrollView, Alert } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { ThemedView } from '@/components/ThemedView';

// Get device dimensions for responsive layout
const { width, height } = Dimensions.get('window');

export default function AppScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Meta viewport tag to ensure proper scaling but allow zooming
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

  // Handle pull to refresh with confirmation
  const onRefresh = () => {
    // Stop the refresh animation immediately
    setRefreshing(false);
    
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
      <ScrollView
        contentContainerStyle={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
      >
        <ThemedView style={styles.container}>
          <WebView 
            ref={webViewRef}
            source={{ uri: 'http://192.168.19.47:5173/' }} 
            style={styles.webview}
            injectedJavaScript={injectedJavaScript}
            onMessage={() => {}}
            scalesPageToFit={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={true}
            bounces={true}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
            automaticallyAdjustContentInsets={true}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
          />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    width: width,
    height: height,
  },
  container: {
    flex: 1,
    width: width,
    height: height,
  },
  webview: {
    flex: 1,
  },
}); 