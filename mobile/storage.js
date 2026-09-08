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
