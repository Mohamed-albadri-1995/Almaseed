const { withMainApplication } = require('@expo/config-plugins');

// Force right-to-left layout in native Android code, in MainApplication.onCreate,
// BEFORE React Native initializes. Doing it here (instead of only via JS
// I18nManager.forceRTL, which needs an app restart to take effect) makes the very
// first launch — and every launch — render RTL consistently. No JS reload is
// needed, so there is no LTR flash and no first-launch hang.
const RTL_IMPORT = 'import com.facebook.react.modules.i18nmanager.I18nUtil';
const RTL_CALLS =
  'I18nUtil.getInstance().allowRTL(applicationContext, true)\n' +
  '    I18nUtil.getInstance().forceRTL(applicationContext, true)';

module.exports = function withForceRtl(config) {
  return withMainApplication(config, (cfg) => {
    // Only the Kotlin template is handled (Expo SDK 54 generates MainApplication.kt).
    if (cfg.modResults.language !== 'kt') return cfg;
    let src = cfg.modResults.contents;
    if (!src.includes(RTL_IMPORT)) {
      src = src.replace(/^(package .+)$/m, `$1\n\n${RTL_IMPORT}`);
    }
    if (!src.includes('forceRTL(applicationContext')) {
      src = src.replace(/super\.onCreate\(\)/, `super.onCreate()\n    ${RTL_CALLS}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
