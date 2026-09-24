const { withAndroidManifest } = require('@expo/config-plugins');

// Google Play flags apps that start a restricted foreground-service type from a
// BOOT_COMPLETED receiver — on Android 15+ that combination crashes. Our app
// never schedules LOCAL notifications (it uses remote push only) and never starts
// a foreground service on boot, so the boot receiver that expo-notifications /
// track-player add is dead weight. This plugin removes the RECEIVE_BOOT_COMPLETED
// permission and strips the BOOT_COMPLETED trigger from any receiver, clearing
// the warning with no loss of functionality (playback still starts on user tap,
// push still arrives).
const BOOT = 'android.intent.action.BOOT_COMPLETED';

module.exports = function withAndroidFixes(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // 1) Drop the RECEIVE_BOOT_COMPLETED permission.
    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p?.$?.['android:name'] !== 'android.permission.RECEIVE_BOOT_COMPLETED',
      );
    }

    // 2) In every receiver, remove the BOOT_COMPLETED action; disable a receiver
    //    whose only trigger was boot.
    const app = manifest.application?.[0];
    if (app && Array.isArray(app.receiver)) {
      for (const receiver of app.receiver) {
        const filters = receiver['intent-filter'];
        if (!Array.isArray(filters)) continue;
        let touchedBoot = false;
        for (const f of filters) {
          if (Array.isArray(f.action)) {
            const before = f.action.length;
            f.action = f.action.filter((a) => a?.$?.['android:name'] !== BOOT);
            if (f.action.length !== before) touchedBoot = true;
          }
        }
        // Drop now-empty intent-filters, and disable a receiver left with none.
        receiver['intent-filter'] = filters.filter((f) => Array.isArray(f.action) && f.action.length > 0);
        if (touchedBoot && receiver['intent-filter'].length === 0) {
          receiver.$ = receiver.$ || {};
          receiver.$['android:enabled'] = 'false';
          receiver.$['android:exported'] = 'false';
        }
      }
    }

    return cfg;
  });
};
