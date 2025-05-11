import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar, Dimensions, BackHandler, Alert, TouchableOpacity, Text, ActivityIndicator, View, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemedView } from '@/components/ThemedView';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Permissions from 'expo-permissions';

// Get device dimensions for responsive layout
const { width, height } = Dimensions.get('window');

export default function AppScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Meta viewport tag to ensure proper scaling but allow zooming
  const injectedJavaScript = `
    const meta = document.createElement('meta'); 
    meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=0.1, maximum-scale=10.0, user-scalable=yes'); 
    meta.setAttribute('name', 'viewport'); 
    document.getElementsByTagName('head')[0].appendChild(meta);

    // Intercept PDF download links
    document.addEventListener('click', function(e) {
      var target = e.target;
      // Find if the clicked element or its parent is a link
      while(target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      
      if (target && target.tagName === 'A') {
        var href = target.getAttribute('href');
        if (href && (href.endsWith('.pdf') || target.getAttribute('download') || 
            target.getAttribute('type') === 'application/pdf' ||
            target.textContent.toLowerCase().includes('download') ||
            target.className.toLowerCase().includes('download'))) {
          
          // Prevent default behavior
          e.preventDefault();
          
          // Send message to React Native with the download URL
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'download',
            url: href
          }));
          
          return false;
        }
      }
    });
    
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

  // Handle WebView messages (for downloads)
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'download') {
        const { url } = data;
        
        // Show download confirmation
        Alert.alert(
          "Download PDF",
          "Do you want to download this PDF?",
          [
            {
              text: "Cancel",
              style: "cancel"
            },
            {
              text: "Download",
              onPress: async () => {
                try {
                  // Show download started message
                  Alert.alert("Download Started", "The PDF download has started.");
                  
                  // Get filename from URL
                  const filename = url.substring(url.lastIndexOf('/') + 1);
                  const fileUri = `${FileSystem.documentDirectory}${filename}`;
                  
                  // Download the file
                  const downloadResult = await FileSystem.downloadAsync(
                    url,
                    fileUri
                  );
                  
                  // Check if download was successful
                  if (downloadResult.status === 200) {
                    // Share the file
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(fileUri);
                    } else {
                      Alert.alert(
                        "File Downloaded",
                        `File saved to: ${fileUri}`,
                        [{ text: "OK" }]
                      );
                    }
                  } else {
                    Alert.alert("Download Failed", "Could not download the file.");
                  }
                } catch (error) {
                  console.error("Download error:", error);
                  Alert.alert("Download Error", "An error occurred during download.");
                  
                  // Fallback: open in browser
                  Linking.canOpenURL(url).then(supported => {
                    if (supported) {
                      Linking.openURL(url);
                    }
                  });
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.log("Error parsing WebView message:", error);
    }
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
          source={{ uri: 'http://192.168.19.47:5173/' }} 
          style={styles.webview}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleWebViewMessage}
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
          onLoadEnd={() => setLoading(false)}
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