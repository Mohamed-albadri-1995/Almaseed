// OS push notifications for the أرشيف المسيد app (Firebase Cloud Messaging).
//
// Gets the device's native FCM token and registers it with the backend, which
// sends pushes straight through FCM. Everything is wrapped defensively: on a
// device/emulator without push support (or before google-services.json is in
// the build) this simply no-ops and the app keeps working normally.

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { getAuth } from './storage';

const LAST_TOKEN_KEY = 'almaseed:pushToken';

// Show notifications while the app is in the foreground too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Ask for permission, get the native FCM token, and register it with the server.
export async function registerForPush() {
  try {
    if (!Device.isDevice) return null; // no push on simulators/emulators

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'إشعارات الأرشيف',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C9A227',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    // Native FCM (Android) / APNs (iOS) token — needs only google-services.json,
    // no Expo account or projectId.
    const resp = await Notifications.getDevicePushTokenAsync();
    const token = resp?.data;
    if (!token) return null;

    // Re-register when the device token OR the signed-in user changes, so the
    // server always has the current role for this device.
    const auth = await getAuth().catch(() => null);
    const marker = `${token}|${auth?.user?.id || 'anon'}`;
    const last = await AsyncStorage.getItem(LAST_TOKEN_KEY).catch(() => null);
    if (last !== marker) {
      await api.registerPush(token, Platform.OS, auth?.token).catch(() => {});
      await AsyncStorage.setItem(LAST_TOKEN_KEY, marker).catch(() => {});
    }
    return token;
  } catch (e) {
    // FCM not configured yet, no network, etc. — never crash the app for this.
    console.warn('[push] register skipped:', e?.message || e);
    return null;
  }
}

// Re-register after a sign-in/sign-out so the device's role is refreshed.
export async function reregisterPush() {
  try { await AsyncStorage.removeItem(LAST_TOKEN_KEY); } catch {}
  return registerForPush();
}

// Wire tap-to-open: when the user taps a «new material» notification, call
// onOpenMaterial(materialId). Returns a cleanup function.
export function attachNotificationTap(onOpenMaterial) {
  const handle = (response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (data.materialId) onOpenMaterial(String(data.materialId));
  };

  // Cold start: app opened by tapping a notification.
  Notifications.getLastNotificationResponseAsync()
    .then((resp) => { if (resp) handle(resp); })
    .catch(() => {});

  // Warm: tapped while app is running/backgrounded.
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
