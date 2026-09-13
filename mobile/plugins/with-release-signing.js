const { withAppBuildGradle } = require('@expo/config-plugins');

// Adds a `release` signing config that reads the Play upload keystore from Gradle
// properties (ALMASEED_UPLOAD_*), which CI sets from GitHub secrets. When those
// properties are absent (e.g. a plain test APK build) it falls back to debug
// signing, so nothing breaks. This lets GitHub Actions produce a Play-valid,
// upload-key-signed AAB without needing an EAS cloud build.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('ALMASEED_UPLOAD_STORE_FILE')) return cfg;
    // 1) Add a `release` entry inside signingConfigs { ... }.
    src = src.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        release {
            if (project.hasProperty('ALMASEED_UPLOAD_STORE_FILE')) {
                storeFile file(project.property('ALMASEED_UPLOAD_STORE_FILE'))
                storePassword project.property('ALMASEED_UPLOAD_STORE_PASSWORD')
                keyAlias project.property('ALMASEED_UPLOAD_KEY_ALIAS')
                keyPassword project.property('ALMASEED_UPLOAD_KEY_PASSWORD')
            }
        }`
    );
    // 2) Point the release buildType at it when the property is present.
    src = src.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{\s*)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('ALMASEED_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
