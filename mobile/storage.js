import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const KEY = 'almaseed.downloads.v1';

// Each entry: { id, title, subtitle, person, fileKind, localPath, bodyText, savedAt }
export async function getDownloads() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addDownload(item) {
  const list = await getDownloads();
  const next = [{ ...item, savedAt: Date.now() }, ...list.filter((x) => x.id !== item.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeDownload(id) {
  const list = await getDownloads();
  const target = list.find((x) => x.id === id);
  if (target?.localPath) {
    try { await FileSystem.deleteAsync(target.localPath, { idempotent: true }); } catch {}
  }
  const next = list.filter((x) => x.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function isDownloaded(id) {
  const list = await getDownloads();
  return list.some((x) => x.id === id);
}

// In-app notifications: remember when the user last opened the bell, so we can
// mark newer published materials as unread.
const SEEN_KEY = 'almaseed.notifSeen.v1';

export async function getNotifSeen() {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export async function setNotifSeen(ts) {
  try {
    await AsyncStorage.setItem(SEEN_KEY, String(ts || Date.now()));
  } catch {}
}

// Native sign-in state, used to tag this device's push token with the user's
// role so reviewers/admins receive «مادة بانتظار المراجعة» notifications.
const AUTH_KEY = 'almaseed.auth.v1';

export async function getAuth() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setAuth(auth) {
  try { await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch {}
}

export async function clearAuth() {
  try { await AsyncStorage.removeItem(AUTH_KEY); } catch {}
}

// One-time UI flags (e.g. first-use coach-marks): getFlag returns true once the
// flag has been set, so a cue shows only on the very first encounter.
export async function getFlag(key) {
  try { return (await AsyncStorage.getItem('almaseed.flag.' + key)) === '1'; } catch { return false; }
}
export async function setFlag(key) {
  try { await AsyncStorage.setItem('almaseed.flag.' + key, '1'); } catch {}
}
// A togglable flag (can be turned OFF again) — used for the offline-mode switch.
export async function setFlagValue(key, on) {
  try {
    if (on) await AsyncStorage.setItem('almaseed.flag.' + key, '1');
    else await AsyncStorage.removeItem('almaseed.flag.' + key);
  } catch {}
}

// Anonymous per-install id for likes/dislikes (no sign-in needed). Created once
// and kept, so each install has one reaction per material.
const DEVICE_KEY = 'almaseed.device.v1';
let deviceIdP = null;
export function getDeviceId() {
  if (!deviceIdP) {
    deviceIdP = (async () => {
      try {
        const have = await AsyncStorage.getItem(DEVICE_KEY);
        if (have) return have;
      } catch {}
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 40);
      try { await AsyncStorage.setItem(DEVICE_KEY, id); } catch {}
      return id;
    })();
  }
  return deviceIdP;
}
