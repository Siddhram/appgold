import { ThemedView } from '@/components/ThemedView';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { WebView } from 'react-native-webview';

// Device dimensions
const { width, height } = Dimensions.get('window');

export default function AppScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  // Inject viewport scaling
  const injectedJavaScript = `
    const meta = document.createElement('meta');
    meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=0.1, maximum-scale=10.0, user-scalable=yes');
    meta.setAttribute('name', 'viewport');
    document.getElementsByTagName('head')[0].appendChild(meta);
    true;
  `;

  // Handle back press
  useEffect(() => {
    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [canGoBack]);

  // Alternative download using Expo FileSystem (better for modern Android)
  const handleDownloadWithExpo = async (url: string) => {
    try {
      console.log('Starting Expo download for URL:', url);
      
      // Extract filename
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0] || `file_${Date.now()}.csv`;
      const fileUri = Paths.document.uri + fileName;
      
      console.log('Downloading to:', fileUri);
      
      // Show loading indicator
      Alert.alert('Download Started', 'Your file is being downloaded...');
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      
      console.log('Download result:', downloadResult);
      
      if (downloadResult.status === 200) {
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          Alert.alert(
            'Download Complete',
            'File downloaded successfully! Would you like to share it?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Share', 
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(downloadResult.uri);
                  } catch (shareError) {
                    console.error('Share error:', shareError);
                    Alert.alert('Share Failed', 'Could not share the file.');
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('Download Complete', `File saved to: ${downloadResult.uri}`);
        }
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
      
      return false;
    } catch (error) {
      console.error('Expo download error:', error);
      Alert.alert(
        'Download Failed', 
        `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      );
      return false;
    }
  };

  // Download handler with fallback strategy
  const handleDownload = async (url: string) => {
    try {
      console.log('Starting download for URL:', url);
      
      // For modern Android versions, prefer Expo FileSystem approach
      if (Platform.OS === 'android') {
        // Try Expo approach first (works better on Android 11+)
        try {
          return await handleDownloadWithExpo(url);
        } catch (expoError) {
          console.log('Expo download failed, trying RNBlobUtil:', expoError);
          // Fallback to RNBlobUtil approach
        }
      }
      
      // Original RNBlobUtil approach (fallback or iOS)
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        console.log('Permissions granted:', granted);
        
        const hasPermission = Object.values(granted).some(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );
        
        if (!hasPermission) {
          // If permissions denied, try Expo approach as fallback
          console.log('Permissions denied, trying Expo approach...');
          return await handleDownloadWithExpo(url);
        }
      }

      const { fs, config } = RNBlobUtil;
      
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      const ext = fileName.includes('.') ? fileName.split('.').pop() : 'csv';
      const timestamp = new Date().getTime();
      const downloadFileName = `file_${timestamp}.${ext}`;
      
      console.log('RNBlobUtil download config:', {
        fileName: downloadFileName,
        extension: ext,
        downloadDir: fs.dirs.DownloadDir
      });

      const downloadConfig = {
        fileCache: true,
        appendExt: ext,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          mime: getMimeType(ext || 'csv'),
          description: 'Downloading file...',
          mediaScannable: true,
        },
      };

      console.log('Starting RNBlobUtil fetch...');

      config(downloadConfig)
        .fetch('GET', url, {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        })
        .then((res) => {
          console.log('RNBlobUtil download successful:', res.path());
          Alert.alert(
            'Download Complete', 
            `File saved successfully!\nPath: ${res.path()}`,
            [{ text: 'OK' }]
          );
        })
        .catch(async (err) => {
          console.error('RNBlobUtil download error:', err);
          // Final fallback to Expo approach
          console.log('RNBlobUtil failed, final attempt with Expo...');
          try {
            return await handleDownloadWithExpo(url);
          } catch {
            Alert.alert(
              'Download Failed', 
              `All download methods failed. Error: ${err.message || 'Unknown error occurred'}`,
              [{ text: 'OK' }]
            );
          }
        });

      return false;
    } catch (error) {
      console.error('Download handler error:', error);
      // Final fallback to Expo
      try {
        return await handleDownloadWithExpo(url);
      } catch {
        Alert.alert(
          'Download Error', 
          `Failed to start download: ${error instanceof Error ? error.message : 'Unknown error'}`,
          [{ text: 'OK' }]
        );
        return false;
      }
    }
  };

  // Helper function to get MIME type based on file extension
  const getMimeType = (extension: string): string => {
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'zip': 'application/zip',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
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
          source={{ uri: 'https://wms1.vercel.app/' }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          injectedJavaScript={injectedJavaScript}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onShouldStartLoadWithRequest={(request) => {
            console.log('Intercepted URL:', request.url);

            // Enhanced file detection - check for common file extensions and download parameters
            const url = request.url.toLowerCase();
            const isDownloadFile = 
              url.includes('.csv') ||
              url.includes('.pdf') || 
              url.includes('.xlsx') ||
              url.includes('.xls') ||
              url.includes('.doc') ||
              url.includes('.docx') ||
              url.includes('.txt') ||
              url.includes('.zip') ||
              url.includes('download=') ||
              url.includes('attachment=') ||
              url.includes('export=') ||
              request.url.includes('Content-Disposition');

            if (isDownloadFile) {
              console.log('Detected download URL, initiating download...');
              handleDownload(request.url);
              return false; // prevent WebView from navigating
            }
            
            return true; // allow normal navigation
          }}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onLoadEnd={() => setLoading(false)}
          onError={({ nativeEvent }) => {
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
    width,
    height,
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
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 1,
  },
});
