import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, StyleSheet, I18nManager, Alert, Image, RefreshControl, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { C } from './theme';
import { api } from './api';
import { ADMIN_URL, CONTRIBUTOR_URL } from './config';
import { getDownloads, addDownload, removeDownload } from './storage';

// Force right-to-left layout for Arabic.
try { I18nManager.allowRTL(true); I18nManager.forceRTL(true); } catch {}

const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة' };

export default function App() {
  // Simple screen stack: [{ name, params }]
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);
  const top = stack[stack.length - 1];
  const push = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {top.name === 'home' && <Home push={push} />}
      {top.name === 'web' && <WebScreen url={top.params.url} title={top.params.title} onBack={pop} />}
      {top.name === 'player' && <Categories push={push} onBack={pop} />}
      {top.name === 'list' && <MaterialsList category={top.params.category} push={push} onBack={pop} />}
      {top.name === 'material' && <MaterialScreen id={top.params.id} onBack={pop} />}
      {top.name === 'library' && <Library push={push} onBack={pop} />}
      {top.name === 'offline' && <OfflineScreen item={top.params.item} onBack={pop} />}
    </SafeAreaView>
  );
}

// ---------------- Home (3 options) ----------------
function Home({ push }) {
  return (
    <ScrollView contentContainerStyle={styles.homeWrap}>
      <View style={styles.brandBox}>
        <Text style={styles.brandSmall}>من ذاكرة المسيد</Text>
        <Text style={styles.brandBig}>أرشيف المسيد</Text>
        <Text style={styles.brandSub}>صوتٌ يُحفظ، وأثرٌ لا يغيب</Text>
      </View>

      <Option
        title="الاستماع والتنزيل"
        desc="تصفّح المدائح والمحاضرات والمقروءات واستمع ونزّل"
        primary
        onPress={() => push('player')}
      />
      <Option
        title="دخول كمشرف نظام"
        desc="مراجعة المحتوى وإدارة الأرشيف"
        onPress={() => push('web', { url: ADMIN_URL, title: 'لوحة الإشراف' })}
      />
      <Option
        title="دخول كمساهم"
        desc="إرسال مادة ومتابعة موادك"
        onPress={() => push('web', { url: CONTRIBUTOR_URL, title: 'حسابي' })}
      />

      <TouchableOpacity onPress={() => push('library')} style={styles.libraryLink}>
        <Text style={styles.libraryLinkTxt}>التنزيلات المحفوظة ↓</Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>الطريقة السمّانية — السجادة السليمانية</Text>
    </ScrollView>
  );
}

function Option({ title, desc, onPress, primary }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.option, primary && { backgroundColor: C.gold }]}
      activeOpacity={0.85}
    >
      <Text style={[styles.optionTitle, primary && { color: C.brand }]}>{title}</Text>
      <Text style={[styles.optionDesc, primary && { color: C.brand600 }]}>{desc}</Text>
    </TouchableOpacity>
  );
}

// ---------------- Header ----------------
function Header({ title, onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>رجوع ›</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 60 }} />}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}

// ---------------- Web screen (admin / contributor) ----------------
function WebScreen({ url, title, onBack }) {
  return (
    <View style={{ flex: 1 }}>
      <Header title={title} onBack={onBack} />
      <WebView source={{ uri: url }} startInLoadingState renderLoading={() => <Loader />} />
    </View>
  );
}

// ---------------- Categories ----------------
function Categories({ push, onBack }) {
  const [cats, setCats] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr('');
    api.categories().then((d) => setCats(d.items)).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <View style={{ flex: 1 }}>
      <Header title="أقسام الأرشيف" onBack={onBack} />
      {err ? <ErrorBox msg={err} onRetry={load} /> : !cats ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {cats.map((c) => (
            <TouchableOpacity key={c.slug} style={styles.catCard} onPress={() => push('list', { category: c })} activeOpacity={0.85}>
              <View>
                <Text style={styles.catName}>{c.name}</Text>
                {!!c.description && <Text style={styles.catDesc}>{c.description}</Text>}
              </View>
              <Text style={styles.catCount}>{c.count} مادة</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------- Materials list ----------------
function MaterialsList({ category, push, onBack }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((query) => {
    setErr('');
    return api.materials(category.slug, query || undefined, 1)
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e.message));
  }, [category.slug]);

  useEffect(() => { load(''); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <Header title={category.name} onBack={onBack} />
      <View style={{ padding: 12 }}>
        <View style={styles.searchRow}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="ابحث…"
            placeholderTextColor={C.muted}
            style={styles.search}
            onSubmitEditing={() => load(q)}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => load(q)}>
            <Text style={{ color: C.white, fontWeight: '700' }}>بحث</Text>
          </TouchableOpacity>
        </View>
      </View>
      {err ? <ErrorBox msg={err} onRetry={() => load(q)} /> : !items ? <Loader /> : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(q); setRefreshing(false); }} />}
        >
          {items.length === 0 && <Text style={styles.empty}>لا توجد مواد.</Text>}
          {items.map((m) => (
            <TouchableOpacity key={m.id} style={styles.matRow} onPress={() => push('material', { id: m.id })} activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={styles.matTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={styles.matSub} numberOfLines={1}>
                  {(m.performer || m.speaker || m.host || '') + '  ·  ' + (KIND_LABEL[m.fileKind] || '')}
                </Text>
              </View>
              <Text style={styles.matArrow}>‹</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------- Material detail + player + downloads ----------------
function MaterialScreen({ id, onBack }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.material(id).then(setM).catch((e) => setErr(e.message));
  }, [id]);

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

          {m.fileKind === 'IMAGE' && m.fileUrl ? (
            <Image source={{ uri: m.fileUrl }} style={styles.image} resizeMode="contain" />
          ) : m.fileUrl && (m.fileKind === 'AUDIO' || m.fileKind === 'VIDEO') ? (
            <AudioPlayer url={m.fileUrl} title={m.title} />
          ) : null}

          {!!m.bodyText && (
            <View style={styles.article}>
              <Text style={styles.articleText}>{m.bodyText}</Text>
            </View>
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
  const [status, setStatus] = useState({ isLoaded: false, isPlaying: false, positionMillis: 0, durationMillis: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { if (soundRef.current) soundRef.current.unloadAsync(); }, []);

  const toggle = async () => {
    try {
      if (!soundRef.current) {
        setLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => setStatus(s));
        setLoading(false);
      } else if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('تعذّر التشغيل', String(e.message || e));
    }
  };

  const pct = status.durationMillis ? Math.round((status.positionMillis / status.durationMillis) * 100) : 0;
  const fmt = (ms) => {
    const s = Math.floor((ms || 0) / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={styles.player}>
      <TouchableOpacity style={styles.playBtn} onPress={toggle}>
        {loading ? <ActivityIndicator color={C.brand} /> : (
          <Text style={styles.playIcon}>{status.isPlaying ? '❚❚' : '▶'}</Text>
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.playTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(status.positionMillis)}</Text>
          <Text style={styles.time}>{fmt(status.durationMillis)}</Text>
        </View>
      </View>
    </View>
  );
}

function Downloads({ material }) {
  const [busy, setBusy] = useState('');

  const ext = (material.fileType || (material.bodyText ? 'txt' : 'dat')).toLowerCase();
  const safe = material.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'material';
  const filename = `${safe}-${material.id}.${ext}`;

  // Ensure we have a local file (download or write article) and return its uri.
  async function ensureLocal() {
    const dest = FileSystem.documentDirectory + filename;
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) return dest;
    if (material.fileUrl) {
      const dl = await FileSystem.downloadAsync(material.fileUrl, dest);
      return dl.uri;
    }
    // Article: write the text to a file.
    await FileSystem.writeAsStringAsync(dest, material.bodyText || material.description || '');
    return dest;
  }

  const saveInApp = async () => {
    try {
      setBusy('app');
      const localPath = await ensureLocal();
      await addDownload({
        id: material.id,
        title: material.title,
        subtitle: material.subtitle || null,
        person: material.performer || material.speaker || material.host || null,
        fileKind: material.fileKind || (material.bodyText ? 'ARTICLE' : 'AUDIO'),
        localPath,
        bodyText: material.bodyText || null,
      });
      Alert.alert('تم الحفظ', 'حُفظت المادة داخل التطبيق، وتظهر في «التنزيلات المحفوظة» للاستماع دون اتصال.');
    } catch (e) {
      Alert.alert('تعذّر الحفظ', String(e.message || e));
    } finally { setBusy(''); }
  };

  const saveToDevice = async () => {
    try {
      setBusy('device');
      const uri = await ensureLocal();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else if (material.fileUrl) {
        Linking.openURL(material.fileUrl);
      } else {
        Alert.alert('غير متاح', 'المشاركة غير مدعومة على هذا الجهاز.');
      }
    } catch (e) {
      Alert.alert('تعذّر التنزيل', String(e.message || e));
    } finally { setBusy(''); }
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

  const del = (id) => {
    Alert.alert('حذف', 'حذف هذه المادة من التنزيلات؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => setItems(await removeDownload(id)) },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="التنزيلات المحفوظة" onBack={onBack} />
      {!items ? <Loader /> : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>لا توجد تنزيلات محفوظة بعد.</Text>
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 6 }}>
            احفظ أي مادة عبر «حفظ داخل التطبيق» لتظهر هنا وتُشغَّل دون اتصال.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {items.map((it) => (
            <View key={it.id} style={styles.matRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => push('offline', { item: it })} activeOpacity={0.85}>
                <Text style={styles.matTitle} numberOfLines={1}>{it.title}</Text>
                <Text style={styles.matSub} numberOfLines={1}>
                  {(it.person || '') + '  ·  ' + (KIND_LABEL[it.fileKind] || 'مقال')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => del(it.id)} style={{ padding: 6 }}>
                <Text style={{ color: C.danger, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// Plays / shows a saved item entirely from local storage (no network).
function OfflineScreen({ item, onBack }) {
  const isAudioVideo = item.fileKind === 'AUDIO' || item.fileKind === 'VIDEO';
  const isImage = item.fileKind === 'IMAGE';
  return (
    <View style={{ flex: 1 }}>
      <Header title="مادة محفوظة" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.detailTitle}>{item.title}</Text>
        {!!item.subtitle && <Text style={styles.detailSub}>{item.subtitle}</Text>}
        {!!item.person && <Text style={styles.detailPerson}>{item.person}</Text>}

        {isImage && item.localPath ? (
          <Image source={{ uri: item.localPath }} style={styles.image} resizeMode="contain" />
        ) : isAudioVideo && item.localPath ? (
          <AudioPlayer url={item.localPath} title={item.title} />
        ) : null}

        {!!item.bodyText && (
          <View style={styles.article}>
            <Text style={styles.articleText}>{item.bodyText}</Text>
          </View>
        )}
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 16, textAlign: 'center' }}>
          محفوظة داخل التطبيق — متاحة دون اتصال.
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------- Small UI ----------------
function Loader() {
  return <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>;
}
function ErrorBox({ msg, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: C.danger, textAlign: 'center', marginBottom: 12 }}>{msg}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.searchBtn} onPress={onRetry}>
          <Text style={{ color: C.white, fontWeight: '700' }}>إعادة المحاولة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ivory },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  homeWrap: { padding: 20, paddingTop: 40, flexGrow: 1, backgroundColor: C.brand },
  brandBox: { alignItems: 'center', marginBottom: 28 },
  brandSmall: { color: C.gold300, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  brandBig: { color: C.white, fontSize: 34, fontWeight: '800' },
  brandSub: { color: '#d7e0da', fontSize: 14, marginTop: 6 },

  option: { backgroundColor: '#2a4a3e', borderRadius: 18, padding: 20, marginBottom: 14 },
  optionTitle: { color: C.white, fontSize: 19, fontWeight: '800', textAlign: 'right' },
  optionDesc: { color: '#cdd8d1', fontSize: 13, marginTop: 6, textAlign: 'right' },
  libraryLink: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  libraryLinkTxt: { color: C.white, fontSize: 15, fontWeight: '700' },
  footerText: { color: C.gold300, textAlign: 'center', marginTop: 12, fontSize: 12 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brand, paddingVertical: 14, paddingHorizontal: 12 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  backBtn: { width: 60 },
  backTxt: { color: C.gold300, fontSize: 15, fontWeight: '700' },

  catCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.line },
  catName: { fontSize: 18, fontWeight: '800', color: C.brand, textAlign: 'right' },
  catDesc: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'right' },
  catCount: { fontSize: 12, color: C.muted },

  searchRow: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, textAlign: 'right', color: C.ink, borderWidth: 1, borderColor: C.line },
  searchBtn: { backgroundColor: C.brand, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },

  matRow: { backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line },
  matTitle: { fontSize: 16, fontWeight: '700', color: C.brand, textAlign: 'right' },
  matSub: { fontSize: 12, color: C.muted, marginTop: 4, textAlign: 'right' },
  matArrow: { fontSize: 24, color: C.muted, marginRight: 6 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },

  detailTitle: { fontSize: 24, fontWeight: '800', color: C.brand, textAlign: 'right' },
  detailSub: { fontSize: 16, color: C.brand500, marginTop: 4, textAlign: 'right' },
  detailPerson: { fontSize: 15, color: C.muted, marginTop: 4, textAlign: 'right' },
  image: { width: '100%', height: 260, borderRadius: 16, marginTop: 16, backgroundColor: '#000' },

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
