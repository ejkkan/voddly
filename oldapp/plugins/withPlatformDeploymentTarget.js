const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom Expo plugin to automatically set the correct deployment target
 * based on whether we're building for iOS or tvOS
 */
function withPlatformDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const isTV =
        process.env.EXPO_TV === '1' || process.env.EXPO_TV === 'true';

      // Update Podfile to use environment variable
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Replace the platform line with conditional logic
        const platformRegex = /platform\s+:(ios|tvos),\s*[^\n]+/;

        const conditionalPlatform = `# Set platform and deployment target based on EXPO_TV environment variable
if ENV['EXPO_TV'] == '1'
  platform :tvos, '17.0'
else
  platform :ios, '16.0'
end`;

        if (platformRegex.test(podfileContent)) {
          podfileContent = podfileContent.replace(
            platformRegex,
            conditionalPlatform
          );

          // Add use_modular_headers! for iOS builds with react-native-video
          if (!isTV && !podfileContent.includes('use_modular_headers!')) {
            const installRegex =
              /(install! 'cocoapods',[\s\S]*?:deterministic_uuids => false)/;
            podfileContent = podfileContent.replace(
              installRegex,
              '$1\n\nuse_modular_headers!'
            );
          }

          fs.writeFileSync(podfilePath, podfileContent);
          console.log('✅ Updated Podfile with conditional deployment targets');
        }
      }

      return config;
    },
  ]);
}

module.exports = withPlatformDeploymentTarget;
