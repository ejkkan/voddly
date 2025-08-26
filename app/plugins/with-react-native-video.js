const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const { withGradleProperties } = require('@expo/config-plugins/build/android/Gradle');
const { withPodfile } = require('@expo/config-plugins/build/ios/Podfile');

/**
 * Expo plugin for react-native-video v6 configuration
 * This plugin configures both iOS and Android for react-native-video without ad support
 */

// Android configuration
const withAndroidVideoConfig = (config, props = {}) => {
  // Set default values for Android
  const androidProps = {
    useExoplayerSmoothStreaming: props.android?.useExoplayerSmoothStreaming ?? true,
    useExoplayerDash: props.android?.useExoplayerDash ?? true,
    useExoplayerHls: props.android?.useExoplayerHls ?? true,
    useExoplayerIMA: props.android?.useExoplayerIMA ?? false, // No ads
    useExoplayerRtsp: props.android?.useExoplayerRtsp ?? false,
  };

  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults || [];
    
    // Remove existing properties if they exist
    config.modResults = config.modResults.filter(
      (item) => !item.key.startsWith('useExoplayer')
    );
    
    // Add new properties
    Object.entries(androidProps).forEach(([key, value]) => {
      config.modResults.push({
        type: 'property',
        key,
        value: String(value),
      });
    });
    
    return config;
  });
};

// iOS configuration
const withIOSVideoConfig = (config, props = {}) => {
  return withPodfile(config, async (config) => {
    const podfileContent = config.modResults.contents;
    
    // Check if video caching is enabled
    const enableVideoCaching = props.ios?.videoCaching ?? true;
    
    // Add video caching configuration if enabled
    if (enableVideoCaching) {
      // Check if the configuration already exists
      if (!podfileContent.includes('$RNVideoUseVideoCaching')) {
        // Find the target section and add the configuration
        const targetRegex = /target\s+['"].*?['"]\s+do/;
        const match = podfileContent.match(targetRegex);
        
        if (match) {
          const insertPosition = match.index;
          const configLine = '\n# Enable Video Caching for react-native-video\n$RNVideoUseVideoCaching=true\n';
          config.modResults.contents = 
            podfileContent.slice(0, insertPosition) + 
            configLine + 
            podfileContent.slice(insertPosition);
        }
      }
    }
    
    // Note: We're NOT adding Google IMA support as requested
    // No $RNVideoUseGoogleIMA configuration
    
    return config;
  });
};

// Main plugin function
function withReactNativeVideo(config, props = {}) {
  return withPlugins(config, [
    [withAndroidVideoConfig, props],
    [withIOSVideoConfig, props],
  ]);
}

module.exports = withReactNativeVideo;