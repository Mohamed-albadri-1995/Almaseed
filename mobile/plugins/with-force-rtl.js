const { withMainApplication } = require('@expo/config-plugins');

// Force a fixed LAYOUT DIRECTION in native Android code, in MainApplication.onCreate,
// BEFORE React Native initializes. Forcing RTL on this device rendered
// inconsistently (some launches everything drifted left, and a JS reload used to
// force it hung the app). Forcing LTR natively here makes every launch identical:
// the Arabic text keeps its explicit textAlign:'right' and sits on the right,
// with no flip, no flash and no first-launch hang.
const RTL_IMPORT = 'import com.facebook.react.modules.i18nmanager.I18nUtil';
const RTL_CALLS =
  'I18nUtil.getInstance().allowRTL(applicationContext, false)\n' +
  '    I18nUtil.getInstance().forceRTL(applicationContext, false)';

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
