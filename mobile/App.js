import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, StyleSheet, I18nManager, Alert, Image, RefreshControl, Linking, BackHandler,
  Platform, StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { Audio, Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { C } from './theme';
import { api } from './api';
import { ADMIN_URL, CONTRIBUTOR_URL } from './config';
import { getDownloads, addDownload, removeDownload } from './storage';

try { I18nManager.allowRTL(true); I18nManager.forceRTL(true); } catch {}

const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة' };

// Android's SafeAreaView doesn't inset the status bar; pad the top bars manually
// so the header (and the back button) never hide under the status bar icons.
const STATUSBAR_H = Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0;

export default function App() {
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);
  const push = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const top = stack[stack.length - 1];

  // Android hardware back → navigate back through the stack; exit only at home.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {top.name === 'home' && <Feed push={push} />}
      {top.name === 'material' && <MaterialScreen id={top.params.id} onBack={pop} />}
      {top.name === 'library' && <Library push={push} onBack={pop} />}
      {top.name === 'offline' && <OfflineScreen item={top.params.item} onBack={pop} />}
      {top.name === 'account' && <Account push={push} onBack={pop} />}
      {top.name === 'web' && <WebScreen url={top.params.url} title={top.params.title} onBack={pop} />}
    </SafeAreaView>
  );
}

// ---------------- Home feed (media-first) ----------------
function Feed({ push }) {
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState(''); // '' = all
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { api.categories().then((d) => setCats(d.items)).catch(() => {}); }, []);

  const load = useCallback((cat, query) => {
    setErr('');
    setItems(null);
    return api.materials(cat || undefined, query || undefined, 1)
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => { load(active, q); /* eslint-disable-next-line */ }, [active]);

  return (
    <View style={{ flex: 1 }}>
      {/* Top bar */}
      <View style={[styles.topbar, { paddingTop: STATUSBAR_H + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('./assets/icon.png')} style={styles.topLogo} />
          <View>
            <Text style={styles.topTitle}>الطريقة السمّانية</Text>
            <Text style={styles.topSub}>السجادة السليمانية</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconBtn label="⤓" onPress={() => push('library')} />
          <IconBtn label="☰" onPress={() => push('account')} />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="ابحث في الأرشيف…"
          placeholderTextColor="#cbd5cf"
          style={styles.search}
          returnKeyType="search"
          onSubmitEditing={() => load(active, q)}
        />
        <TouchableOpacity style={styles.searchGo} onPress={() => load(active, q)}>
          <Text style={{ color: C.brand, fontWeight: '800' }}>بحث</Text>
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="الكل" active={active === ''} onPress={() => setActive('')} />
          {cats.map((c) => (
            <Chip key={c.slug} label={c.name} active={active === c.slug} onPress={() => setActive(c.slug)} />
          ))}
        </ScrollView>
      </View>

      {/* Feed */}
      {err ? <ErrorBox msg={err} onRetry={() => load(active, q)} /> : !items ? <Loader /> : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingTop: 4 }}
          refreshControl={<RefreshControl tintColor={C.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(active, q); setRefreshing(false); }} />}
        >
          {items.length === 0 && <Text style={styles.empty}>لا توجد مواد.</Text>}
          {items.map((m) => (
            <FeedCard key={m.id} m={m} onPress={() => push('material', { id: m.id })} />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

function FeedCard({ m, onPress }) {
  const isVideo = m.fileKind === 'VIDEO';
  const isImage = m.fileKind === 'IMAGE';
  const glyph = isVideo ? '►' : isImage ? '🖼' : m.fileKind === 'DOCUMENT' ? '📄' : '♪';
  return (
    <TouchableOpacity style={styles.feedCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.thumb, isVideo && styles.thumbVideo]}>
        <Text style={styles.thumbGlyph}>{glyph}</Text>
        <View style={styles.kindBadge}><Text style={styles.kindBadgeTxt}>{KIND_LABEL[m.fileKind] || 'مادة'}</Text></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.feedTitle} numberOfLines={2}>{m.title}</Text>
        {!!(m.performer || m.speaker || m.host) && (
          <Text style={styles.feedPerson} numberOfLines={1}>{m.performer || m.speaker || m.host}</Text>
        )}
        {!!m.category && <Text style={styles.feedCat}>{m.category.name}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn}>
      <Text style={styles.iconBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------- Account (secondary logins) ----------------
function Account({ push, onBack }) {
  return (
    <View style={{ flex: 1 }}>
      <Header title="الدخول والإدارة" onBack={onBack} />
      <View style={{ padding: 20 }}>
        <TouchableOpacity style={styles.acctCard} onPress={() => push('web', { url: CONTRIBUTOR_URL, title: 'حسابي' })}>
          <Text style={styles.acctTitle}>دخول كمساهم</Text>
          <Text style={styles.acctDesc}>إرسال مادة ومتابعة موادك</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acctCard} onPress={() => push('web', { url: ADMIN_URL, title: 'لوحة الإشراف' })}>
          <Text style={styles.acctTitle}>دخول كمشرف نظام</Text>
          <Text style={styles.acctDesc}>مراجعة المحتوى وإدارة الأرشيف</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.acctCard, { backgroundColor: C.ivory50 }]} onPress={() => push('library')}>
          <Text style={styles.acctTitle}>التنزيلات المحفوظة</Text>
          <Text style={styles.acctDesc}>الاستماع دون اتصال</Text>
        </TouchableOpacity>
        <Text style={styles.footerText}>الطريقة السمّانية — السجادة السليمانية</Text>
      </View>
    </View>
  );
}

// ---------------- Header ----------------
function Header({ title, onBack }) {
  return (
    <View style={[styles.header, { paddingTop: STATUSBAR_H + 8 }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backTxt}>رجوع</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 92 }} />}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 92 }} />
    </View>
  );
}

function WebScreen({ url, title, onBack }) {
  return (
    <View style={{ flex: 1 }}>
      <Header title={title} onBack={onBack} />
      <WebView source={{ uri: url }} startInLoadingState renderLoading={() => <Loader />} />
    </View>
  );
}

// ---------------- Material detail ----------------
function MaterialScreen({ id, onBack }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.material(id).then(setM).catch((e) => setErr(e.message)); }, [id]);

  return (
    <View style={{ flex: 1 }}>
      <Header title="تفاصيل المادة" onBack={onBack} />
      {err ? <ErrorBox msg={err} /> : !m ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.detailTitle}>{m.title}</Text>
          {!!m.subtitle && <Text style={styles.detailSub}>{m.subtitle}</Text>}
          {!!(m.performer || m.speaker || m.host) && (
            <Text style={styles.detailPerson}>{m.performer || m.speaker || m.host}</Text>
          )}

          {m.fileKind === 'VIDEO' && m.fileUrl ? (
            <Video source={{ uri: m.fileUrl }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={styles.video} />
          ) : m.fileKind === 'IMAGE' && m.fileUrl ? (
            <Image source={{ uri: m.fileUrl }} style={styles.image} resizeMode="contain" />
          ) : m.fileUrl && m.fileKind === 'AUDIO' ? (
            <AudioPlayer url={m.fileUrl} title={m.title} />
          ) : null}

          {!!m.bodyText && (
            <View style={styles.article}><Text style={styles.articleText}>{m.bodyText}</Text></View>
          )}
          {!!m.description && <Text style={styles.desc}>{m.description}</Text>}

          <Downloads material={m} />
        </ScrollView>
      )}
    </View>
  );
}

function AudioPlayer({ url, title }) {
  const soundRef = useRef(null);
  const [status, setStatus] = useState({ isPlaying: false, positionMillis: 0, durationMillis: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { if (soundRef.current) soundRef.current.unloadAsync(); }, []);

  const toggle = async () => {
    try {
      if (!soundRef.current) {
        setLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true });
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => setStatus(s));
        setLoading(false);
      } else if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (e) { setLoading(false); Alert.alert('تعذّر التشغيل', String(e.message || e)); }
  };

  const pct = status.durationMillis ? Math.round((status.positionMillis / status.durationMillis) * 100) : 0;
  const fmt = (ms) => { const s = Math.floor((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  return (
    <View style={styles.player}>
      <TouchableOpacity style={styles.playBtn} onPress={toggle}>
        {loading ? <ActivityIndicator color={C.brand} /> : <Text style={styles.playIcon}>{status.isPlaying ? '❚❚' : '▶'}</Text>}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.playTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
        <View style={styles.timeRow}><Text style={styles.time}>{fmt(status.positionMillis)}</Text><Text style={styles.time}>{fmt(status.durationMillis)}</Text></View>
      </View>
    </View>
  );
}

function Downloads({ material }) {
  const [busy, setBusy] = useState('');
  const ext = (material.fileType || (material.bodyText ? 'txt' : 'dat')).toLowerCase();
  const safe = material.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'material';
  const filename = `${safe}-${material.id}.${ext}`;

  async function ensureLocal() {
    const dest = FileSystem.documentDirectory + filename;
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) return dest;
    if (material.fileUrl) { const dl = await FileSystem.downloadAsync(material.fileUrl, dest); return dl.uri; }
    await FileSystem.writeAsStringAsync(dest, material.bodyText || material.description || '');
    return dest;
  }

  const saveInApp = async () => {
    try {
      setBusy('app');
      const localPath = await ensureLocal();
      await addDownload({
        id: material.id, title: material.title, subtitle: material.subtitle || null,
        person: material.performer || material.speaker || material.host || null,
        fileKind: material.fileKind || (material.bodyText ? 'ARTICLE' : 'AUDIO'),
        localPath, bodyText: material.bodyText || null,
      });
      Alert.alert('تم الحفظ', 'حُفظت المادة داخل التطبيق، وتظهر في «التنزيلات المحفوظة».');
    } catch (e) { Alert.alert('تعذّر الحفظ', String(e.message || e)); } finally { setBusy(''); }
  };

  const saveToDevice = async () => {
    try {
      setBusy('device');
      const uri = await ensureLocal();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else if (material.fileUrl) Linking.openURL(material.fileUrl);
      else Alert.alert('غير متاح', 'المشاركة غير مدعومة على هذا الجهاز.');
    } catch (e) { Alert.alert('تعذّر التنزيل', String(e.message || e)); } finally { setBusy(''); }
  };

  if (!material.fileUrl && !material.bodyText) return null;
  return (
    <View style={styles.downloads}>
      <TouchableOpacity style={styles.dlBtn} onPress={saveInApp} disabled={!!busy}>
        <Text style={styles.dlTxt}>{busy === 'app' ? 'جارٍ…' : 'حفظ داخل التطبيق'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.dlBtn, styles.dlBtnAlt]} onPress={saveToDevice} disabled={!!busy}>
        <Text style={[styles.dlTxt, { color: C.brand }]}>{busy === 'device' ? 'جارٍ…' : 'تنزيل إلى الجهاز'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------- Offline library ----------------
function Library({ push, onBack }) {
  const [items, setItems] = useState(null);
  const reload = useCallback(() => { getDownloads().then(setItems); }, []);
  useEffect(reload, [reload]);
  const del = (id) => Alert.alert('حذف', 'حذف هذه المادة من التنزيلات؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => setItems(await removeDownload(id)) },
  ]);

  return (
    <View style={{ flex: 1 }}>
      <Header title="التنزيلات المحفوظة" onBack={onBack} />
      {!items ? <Loader /> : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>لا توجد تنزيلات محفوظة بعد.</Text>
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 6 }}>احفظ أي مادة عبر «حفظ داخل التطبيق» لتظهر هنا وتُشغَّل دون اتصال.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {items.map((it) => (
            <View key={it.id} style={styles.feedCard}>
              <TouchableOpacity style={[styles.thumb, { width: 64, height: 64 }]} onPress={() => push('offline', { item: it })}>
                <Text style={styles.thumbGlyph}>{it.fileKind === 'VIDEO' ? '►' : it.fileKind === 'IMAGE' ? '🖼' : '♪'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => push('offline', { item: it })}>
                <Text style={styles.feedTitle} numberOfLines={2}>{it.title}</Text>
                <Text style={styles.feedPerson} numberOfLines={1}>{(it.person || '') + '  ·  ' + (KIND_LABEL[it.fileKind] || 'مقال')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => del(it.id)} style={{ padding: 6 }}><Text style={{ color: C.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function OfflineScreen({ item, onBack }) {
  const isImage = item.fileKind === 'IMAGE';
  const isVideo = item.fileKind === 'VIDEO';
  return (
    <View style={{ flex: 1 }}>
      <Header title="مادة محفوظة" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.detailTitle}>{item.title}</Text>
        {!!item.subtitle && <Text style={styles.detailSub}>{item.subtitle}</Text>}
        {!!item.person && <Text style={styles.detailPerson}>{item.person}</Text>}
        {isImage && item.localPath ? (
          <Image source={{ uri: item.localPath }} style={styles.image} resizeMode="contain" />
        ) : isVideo && item.localPath ? (
          <Video source={{ uri: item.localPath }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={styles.video} />
        ) : item.localPath && item.fileKind !== 'ARTICLE' ? (
          <AudioPlayer url={item.localPath} title={item.title} />
        ) : null}
        {!!item.bodyText && <View style={styles.article}><Text style={styles.articleText}>{item.bodyText}</Text></View>}
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 16, textAlign: 'center' }}>محفوظة داخل التطبيق — متاحة دون اتصال.</Text>
      </ScrollView>
    </View>
  );
}

// ---------------- Small UI ----------------
function Loader() { return <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>; }
function ErrorBox({ msg, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: C.danger, textAlign: 'center', marginBottom: 12 }}>{msg}</Text>
      {onRetry && <TouchableOpacity style={styles.searchGo} onPress={onRetry}><Text style={{ color: C.brand, fontWeight: '800' }}>إعادة المحاولة</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ivory },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  topbar: { backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  topLogo: { width: 38, height: 38 },
  topTitle: { color: C.white, fontSize: 20, fontWeight: '900' },
  topSub: { color: C.gold300, fontSize: 12, marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { color: C.white, fontSize: 20, fontWeight: '900' },

  searchWrap: { backgroundColor: C.brand, flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  search: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, textAlign: 'right', color: C.ink },
  searchGo: { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },

  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, marginLeft: 8 },
  chipActive: { backgroundColor: C.brand, borderColor: C.brand },
  chipTxt: { color: C.brand, fontWeight: '700', fontSize: 13 },
  chipTxtActive: { color: C.white },

  feedCard: { backgroundColor: C.white, borderRadius: 16, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  thumbVideo: { width: 120, height: 78, backgroundColor: '#12241d' },
  thumbGlyph: { color: C.gold300, fontSize: 30, fontWeight: '900' },
  kindBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#00000066', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  kindBadgeTxt: { color: C.white, fontSize: 10, fontWeight: '700' },
  feedTitle: { fontSize: 16, fontWeight: '800', color: C.brand, textAlign: 'right' },
  feedPerson: { fontSize: 13, color: C.muted, marginTop: 3, textAlign: 'right' },
  feedCat: { fontSize: 11, color: C.gold, marginTop: 4, textAlign: 'right', fontWeight: '700' },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },

  acctCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  acctTitle: { fontSize: 18, fontWeight: '800', color: C.brand, textAlign: 'right' },
  acctDesc: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'right' },
  footerText: { color: C.muted, textAlign: 'center', marginTop: 20, fontSize: 12 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brand, paddingBottom: 12, paddingHorizontal: 12 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  backBtn: { width: 92, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ffffff22', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  backChevron: { color: C.white, fontSize: 20, fontWeight: '900', lineHeight: 22, marginTop: -2 },
  backTxt: { color: C.white, fontSize: 15, fontWeight: '800' },

  detailTitle: { fontSize: 24, fontWeight: '900', color: C.brand, textAlign: 'right' },
  detailSub: { fontSize: 16, color: C.brand500, marginTop: 4, textAlign: 'right' },
  detailPerson: { fontSize: 15, color: C.muted, marginTop: 4, textAlign: 'right' },
  image: { width: '100%', height: 260, borderRadius: 16, marginTop: 16, backgroundColor: '#000' },
  video: { width: '100%', height: 220, borderRadius: 16, marginTop: 16, backgroundColor: '#000' },

  player: { backgroundColor: C.brand, borderRadius: 18, padding: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 20, color: C.brand, fontWeight: '900' },
  playTitle: { color: C.white, fontWeight: '700', marginBottom: 8, textAlign: 'right' },
  progressTrack: { height: 6, backgroundColor: '#ffffff33', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: C.gold },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { color: '#cdd8d1', fontSize: 11 },

  article: { backgroundColor: C.ivory50, borderRadius: 16, padding: 16, marginTop: 18, borderWidth: 1, borderColor: C.line },
  articleText: { fontSize: 16, lineHeight: 30, color: C.ink, textAlign: 'right' },
  desc: { fontSize: 15, lineHeight: 28, color: C.ink, marginTop: 16, textAlign: 'right' },

  downloads: { flexDirection: 'row', gap: 10, marginTop: 22 },
  dlBtn: { flex: 1, backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  dlBtnAlt: { backgroundColor: C.gold },
  dlTxt: { color: C.white, fontWeight: '800' },
});
