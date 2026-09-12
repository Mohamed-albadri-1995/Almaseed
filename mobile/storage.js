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

// The folder the user picked (once) for «تنزيل إلى الجهاز». We remember its SAF
// tree URI so downloads go straight there without re-prompting every time.
const SAF_DIR_KEY = 'almaseed.safDir.v1';

export async function getSafDir() {
  try { return (await AsyncStorage.getItem(SAF_DIR_KEY)) || null; } catch { return null; }
}

export async function setSafDir(uri) {
  try {
    if (uri) await AsyncStorage.setItem(SAF_DIR_KEY, uri);
    else await AsyncStorage.removeItem(SAF_DIR_KEY);
  } catch {}
}
