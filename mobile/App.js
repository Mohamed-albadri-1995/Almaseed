import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, StyleSheet, I18nManager, Alert, Image, RefreshControl, Linking, BackHandler,
  Platform, StatusBar as RNStatusBar, PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import TrackPlayer, {
  Capability, State, RepeatMode, usePlaybackState, useProgress,
} from 'react-native-track-player';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { C } from './theme';
import { api } from './api';
import { ADMIN_URL, CONTRIBUTOR_URL, BUILD } from './config';
import { getDownloads, addDownload, removeDownload } from './storage';

try { I18nManager.allowRTL(true); I18nManager.forceRTL(true); } catch {}

const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة' };
const STATUSBAR_H = Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0;

let trackPlayerReady = null;
function ensureTrackPlayer() {
  if (trackPlayerReady) return trackPlayerReady;
  trackPlayerReady = (async () => {
    try { await TrackPlayer.setupPlayer(); } catch (e) {}
    try {
      await TrackPlayer.updateOptions({
        android: { appKilledPlaybackBehavior: 'ContinuePlayback' },
        autoHandleInterruptions: false,
        capabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo,
          Capability.JumpForward, Capability.JumpBackward],
        compactCapabilities: [Capability.Play, Capability.Pause],
        notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop,
          Capability.SeekTo, Capability.JumpForward, Capability.JumpBackward],
        forwardJumpInterval: 15,
        backwardJumpInterval: 15,
      });
      await TrackPlayer.setRepeatMode(RepeatMode.Off);
    } catch (e) {}
  })();
  return trackPlayerReady;
}

export default function App() {
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);
  const push = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const top = stack[stack.length - 1];
  const [now, setNow] = useState(null);
  const play = useCallback((m) => {
    if (!m?.fileUrl || m.fileKind !== 'AUDIO') return;
    setNow({ id: m.id, title: m.title, subtitle: m.subtitle || null,
      person: m.performer || m.speaker || m.host || null,
      fileUrl: m.fileUrl, fileKind: m.fileKind, poster: m.coverImage || null });
  }, []);
  useEffect(() => { ensureTrackPlayer(); }, []);
  useEffect(() => {
    if (!now) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureTrackPlayer();
        if (cancelled) return;
        await TrackPlayer.reset();
        await TrackPlayer.add({ id: now.id, url: now.fileUrl, title: now.title,
          artist: now.person || 'الطريقة السمّانية — السجادة السليمانية', artwork: now.poster || undefined });
        await TrackPlayer.setRate(1);
        await TrackPlayer.play();
      } catch (e) { if (!cancelled) Alert.alert('تعذّر التشغيل', String(e.message || e)); }
    })();
    return () => { cancelled = true; };
  }, [now && now.id]);
  const stopNow = useCallback(async () => { try { await TrackPlayer.reset(); } catch {} setNow(null); }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { pop(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);
  const openNow = useCallback(() => { if (now) push('material', { id: now.id }); }, [now]);
  const hideMini = now && top.name === 'material' && top.params.id === now.id;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {top.name === 'home' && <Feed push={push} />}
        {top.name === 'material' && <MaterialScreen id={top.params.id} push={push} onBack={pop} onPlay={play} onStop={stopNow} nowId={now?.id} />}
        {top.name === 'library' && <Library push={push} onBack={pop} />}
        {top.name === 'offline' && <OfflineScreen item={top.params.item} onBack={pop} />}
        {top.name === 'account' && <Account push={push} onBack={pop} />}
        {top.name === 'web' && <WebScreen url={top.params.url} title={top.params.title} onBack={pop} />}
        {top.name === 'pdf' && <PdfScreen url={top.params.url} title={top.params.title} onBack={pop} />}
      </View>
      {now && !hideMini && <MiniPlayer item={now} onClose={stopNow} onOpen={openNow} />}
    </SafeAreaView>
  );
}

function Feed({ push }) {
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState('');
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { api.categories().then((d) => setCats(d.items)).catch(() => {}); }, []);
  const load = useCallback((cat, query) => {
    setErr(''); setItems(null);
    return api.materials(cat || undefined, query || undefined, 1).then((d) => setItems(d.items)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(active, q); /* eslint-disable-next-line */ }, [active]);
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.topbar, { paddingTop: STATUSBAR_H + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('./assets/icon.png')} style={styles.topLogo} />
          <View><Text style={styles.topTitle}>الطريقة السمّانية</Text><Text style={styles.topSub}>السجادة السليمانية</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}><IconBtn label="⤓" onPress={() => push('library')} /><IconBtn label="☰" onPress={() => push('account')} /></View>
      </View>
      <View style={styles.searchWrap}>
        <TextInput value={q} onChangeText={setQ} placeholder="ابحث في الأرشيف…" placeholderTextColor="#cbd5cf" style={styles.search} returnKeyType="search" onSubmitEditing={() => load(active, q)} />
        <TouchableOpacity style={styles.searchGo} onPress={() => load(active, q)}><Text style={{ color: C.brand, fontWeight: '800' }}>بحث</Text></TouchableOpacity>
      </View>
      <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="الكل" active={active === ''} onPress={() => setActive('')} />{cats.map((c) => <Chip key={c.slug} label={c.name} active={active === c.slug} onPress={() => setActive(c.slug)} />)}</ScrollView></View>
      {err ? <ErrorBox msg={err} onRetry={() => load(active, q)} /> : !items ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4 }} refreshControl={<RefreshControl tintColor={C.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(active, q); setRefreshing(false); }} />}>
          {items.length === 0 && <Text style={styles.empty}>لا توجد مواد.</Text>}{items.map((m) => <FeedCard key={m.id} m={m} onPress={() => push('material', { id: m.id })} />)}<View style={{ height: 16 }} />
        </ScrollView>
      )}
    </View>
  );
}
function FeedCard({ m, onPress }) {
  const isVideo = m.fileKind === 'VIDEO'; const isImage = m.fileKind === 'IMAGE'; const glyph = isVideo ? '►' : isImage ? '🖼' : m.fileKind === 'DOCUMENT' ? '📄' : '♪';
  const person = m.category?.slug === 'readings' ? m.author : (m.performer || m.speaker || m.host);
  return <TouchableOpacity style={styles.feedCard} onPress={onPress} activeOpacity={0.85}><View style={[styles.thumb, isVideo && styles.thumbVideo]}><Text style={styles.thumbGlyph}>{glyph}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.feedTitle}>{m.title}</Text>{person && <Text style={styles.feedPerson}>{person}</Text>}</View></TouchableOpacity>;
}
function Chip({ label, active, onPress }) { return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text></TouchableOpacity>; }
function IconBtn({ label, onPress }) { return <TouchableOpacity onPress={onPress} style={styles.iconBtn}><Text style={styles.iconBtnTxt}>{label}</Text></TouchableOpacity>; }
function Account({ push, onBack }) { return <View style={{ flex: 1 }}><Header title="الدخول والإدارة" onBack={onBack} /><View style={{ padding: 20 }}><TouchableOpacity style={styles.acctCard} onPress={() => push('web', { url: ADMIN_URL, title: 'الدخول' })}><Text style={styles.acctTitle}>دخول المشرفين</Text><Text style={styles.acctSub}>تحرير المواد وإدارة الحسابات</Text></TouchableOpacity><TouchableOpacity style={styles.acctCard} onPress={() => push('web', { url: CONTRIBUTOR_URL, title: 'حسابي' })}><Text style={styles.acctTitle}>حسابي</Text><Text style={styles.acctSub}>البيانات الشخصية والاشتراكات</Text></TouchableOpacity><Text style={styles.acctBuild}>الإصدار {BUILD}</Text></View></View>; }
function Header({ title, onBack }) { return <View style={[styles.header, { paddingTop: STATUSBAR_H + 8 }]}>{onBack ? <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={styles.backBtnTxt}>◀</Text></TouchableOpacity> : <View style={{ width: 24 }} />}<Text style={styles.headerTitle}>{title}</Text><View style={{ width: 24 }} /></View>; }
function WebScreen({ url, title, onBack }) { return <View style={{ flex: 1 }}><Header title={title} onBack={onBack} /><WebView source={{ uri: url }} startInLoadingState renderLoading={() => <Loader />} /></View>; }
function PdfScreen({ url, title, onBack }) {
  const [failed, setFailed] = useState(false);
  const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  return <View style={{ flex: 1 }}><Header title={title || 'المستند'} onBack={onBack} />{failed ? <View style={styles.center}><Text style={{ color: C.muted, textAlign: 'center', marginBottom: 12 }}>تعذّر تحميل المستند.</Text><TouchableOpacity style={styles.docOpenBtn} onPress={() => { Linking.openURL(url); }}><Text style={{ color: C.white, fontWeight: '800' }}>فتح خارجياً</Text></TouchableOpacity></View> : <WebView source={{ uri: viewer }} startInLoadingState renderLoading={() => <Loader />} onError={() => setFailed(true)} />}</View>;
}

function ArticleHtml({ html }) {
  const [height, setHeight] = useState(160);
  const looksHtml = /<[a-z!/][\s\S]*>/i.test(html || '');
  const body = looksHtml ? html : `<div style="white-space:pre-wrap">${(html || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  const doc = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0}body{padding:16px;font-size:16px;line-height:1.6;color:#2b2b2b;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}h1,h2,h3{color:#1f3d33;margin-top:16px}strong{font-weight:800}em{font-style:italic}</style></head><body>${body}</body></html>`;
  return <View style={styles.articleWrap}><WebView originWhitelist={['*']} source={{ html: doc }} style={{ width: '100%', height }} scrollEnabled={false} showsVerticalScrollIndicator={false} onMessage={() => {}} /></View>;
}
function MaterialScreen({ id, push, onBack, onPlay, onStop, nowId }) {
  const [m, setM] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.material(id).then(setM).catch((e) => setErr(e.message)); }, [id]);
  const playingHere = m && nowId === m.id;
  const isBook = m?.category?.slug === 'readings';
  const person = isBook ? m.author : (m?.performer || m?.speaker || m?.host);
  return <View style={{ flex: 1 }}><Header title="تفاصيل المادة" onBack={onBack} />{err ? <ErrorBox msg={err} /> : !m ? <Loader /> : <ScrollView contentContainerStyle={{ padding: 16 }}><Text style={styles.detailTitle}>{m.title}</Text><Text style={styles.detailSub}>{m.subtitle}</Text>{person && <Text style={styles.detailPerson}>{person}</Text>}{m.bodyText && <ArticleHtml html={m.bodyText} />}{m.fileKind === 'IMAGE' && <View style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden' }}><Image source={{ uri: m.fileUrl }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" /></View>}{m.fileKind === 'VIDEO' && <InlineVideo url={m.fileUrl} />}{m.fileKind === 'AUDIO' && <View><TouchableOpacity style={[styles.playCard, playingHere && styles.playCardActive]} onPress={() => onPlay(m)}><Text style={{ textAlign: 'center', color: C.white, fontWeight: '800', marginTop: 8 }}>{playingHere ? '▶ الآن يتم التشغيل' : '▶ شغّل'}</Text></TouchableOpacity></View>}{m.fileType && <Downloads material={m} />}</ScrollView>}</View>;
}

function InlineVideo({ url }) {
  const ref = useRef(null);
  const player = useVideoPlayer(url, (p) => { try { p.play(); } catch {} });
  const enterPip = () => { try { ref.current?.startPictureInPicture(); } catch {} };
  const fullscreen = () => { try { ref.current?.enterFullscreen(); } catch {} };
  return <View style={styles.videoWrap}><VideoView ref={ref} player={player} style={styles.videoInline} contentFit="contain" nativeControls allowsPictureInPicture startsPictureInPictureAutomatically /></View>;
}
function MiniPlayer(props) { return <MiniAudio {...props} />; }
function MiniShell({ children, onClose, onOpen, item, pct, leading }) { return <View style={styles.mini}><View style={styles.miniProgress}><View style={[styles.miniProgressFill, { width: `${pct}%` }]} /></View><TouchableOpacity onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>{leading}<View style={{ flex: 1, minWidth: 0 }}><Text style={styles.miniTitle} numberOfLines={1}>{item.title}</Text></View><TouchableOpacity onPress={onClose} style={{ paddingLeft: 8 }}><Text style={{ color: C.gold, fontSize: 18, fontWeight: '800' }}>✕</Text></TouchableOpacity></TouchableOpacity></View>; }
const AUDIO_BUSY = (s) => s === State.Buffering || s === State.Loading || s === State.Connecting || s === State.None || s == null;
function MiniAudio({ item, onClose, onOpen }) { const playback = usePlaybackState(); const { position, duration } = useProgress(500); const state = playback?.state; const isPlaying = state === State.Playing; const pct = duration ? (position / duration) * 100 : 0; return <MiniShell item={item} pct={pct} onClose={onClose} onOpen={onOpen} leading={<ActivityIndicator animating={AUDIO_BUSY(state)} color={C.gold} size={16} />} />; }
const fmtTime = (sec) => { const s = Math.max(0, Math.floor(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

function SeekBar({ position, duration, onSeek }) {
  const wRef = useRef(1);
  const [drag, setDrag] = useState(null);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const pointToFraction = (e) => clamp((e.nativeEvent.locationX || 0) / wRef.current);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => setDrag(pointToFraction(e)),
    onPanResponderMove: (e) => setDrag(pointToFraction(e)),
    onPanResponderRelease: (e) => {
      const f = pointToFraction(e);
      setDrag(null);
      onSeek(f);
    },
    onPanResponderTerminate: () => setDrag(null),
  })).current;
  const frac = drag != null ? drag : duration ? Math.max(0, Math.min(1, position / duration)) : 0;
  return <View style={styles.seekWrap}><View {...pan.panHandlers} onLayout={(e) => { wRef.current = e.nativeEvent.layout.width || 1; }} style={styles.seekHit}><View style={styles.seekTrack}><View style={[styles.seekFill, { width: `${frac * 100}%` }]} /><View style={[styles.seekThumb, { left: `${frac * 100}%` }]} /></View></View><View style={styles.seekTimes}><Text style={styles.seekTime}>{fmtTime(drag != null ? drag * duration : position)}</Text><Text style={styles.seekTime}>{fmtTime(duration)}</Text></View></View>;
}

function FullAudioPlayer({ title, person, poster, onStop }) {
  const playback = usePlaybackState(); const { position, duration } = useProgress(400); const [speedIdx, setSpeedIdx] = useState(0); const state = playback?.state; const isPlaying = state === State.Playing; const toggle = () => { isPlaying ? TrackPlayer.pause() : TrackPlayer.play(); }; const seekTo = (f) => TrackPlayer.seekTo(f * (duration || 0)); const jump = (d) => TrackPlayer.seekTo(Math.max(0, Math.min(duration || 0, (position || 0) + d))); return <View style={styles.full}><View style={styles.fullArt}>{poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={styles.fullArtGlyph}>♪</Text>}</View><Text style={styles.fullTitle}>{title}</Text>{person && <Text style={styles.fullPerson}>{person}</Text>}<View style={{ marginVertical: 16, width: '100%' }}><SeekBar position={position} duration={duration} onSeek={seekTo} /></View><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 12, marginBottom: 16 }}><TouchableOpacity onPress={() => jump(-15)} style={styles.jumpBtn}><Text style={styles.jumpBtnTxt}>⏪ 15ث</Text></TouchableOpacity><TouchableOpacity onPress={toggle} style={styles.playBtn}><Text style={{ color: C.brand, fontSize: 28, fontWeight: '800' }}>{isPlaying ? '⏸' : '▶'}</Text></TouchableOpacity><TouchableOpacity onPress={() => jump(15)} style={styles.jumpBtn}><Text style={styles.jumpBtnTxt}>15ث ⏩</Text></TouchableOpacity></View><View style={{ flexDirection: 'row', gap: 8 }}><TouchableOpacity style={styles.speedBtn} onPress={() => { setSpeedIdx((i) => (i + 1) % SPEEDS.length); TrackPlayer.setRate(SPEEDS[(speedIdx + 1) % SPEEDS.length]); }}><Text style={styles.speedBtnTxt}>{SPEEDS[speedIdx]}x</Text></TouchableOpacity><TouchableOpacity style={[styles.speedBtn, { flex: 1 }]} onPress={onStop}><Text style={styles.speedBtnTxt}>إغلاق</Text></TouchableOpacity></View></View>;
}

function Downloads({ material }) { const [busy, setBusy] = useState(''); const ext = (material.fileType || (material.bodyText ? 'txt' : 'dat')).toLowerCase(); const safe = material.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40) || 'file'; const filename = `${safe}.${ext}`; return <View style={styles.documentCard}><Text style={styles.documentIcon}>⬇</Text><Text style={styles.documentTitle}>{material.title}</Text><Text style={styles.documentType}>{KIND_LABEL[material.fileKind] || material.fileKind} — {ext.toUpperCase()}</Text><View style={styles.docBtns}><TouchableOpacity disabled={busy === 'view'} onPress={() => { setBusy('view'); Linking.openURL(material.fileUrl).catch(() => Alert.alert('خطأ', 'تعذّر فتح الملف')).finally(() => setBusy('')); }} style={styles.docViewBtn}><Text style={styles.docViewTxt}>{busy === 'view' ? '...' : 'عرض'}</Text></TouchableOpacity>{material.fileUrl && <TouchableOpacity disabled={busy === 'download'} onPress={async () => { setBusy('download'); try { const perms = await MediaLibrary.getPermissionsAsync(); if (!perms.granted) { const req = await MediaLibrary.requestPermissionsAsync(); if (!req.granted) throw new Error('Permission denied'); } const dl = await FileSystem.downloadAsync(material.fileUrl, FileSystem.documentDirectory + filename); await addDownload({ ...material, localPath: dl.uri }); Alert.alert('تم', 'تم حفظ الملف بنجاح'); } catch (e) { Alert.alert('خطأ', e.message || 'فشل التحميل'); } finally { setBusy(''); } }} style={styles.docSaveBtn}><Text style={styles.docSaveTxt}>{busy === 'download' ? '...' : 'حفظ'}</Text></TouchableOpacity>}</View></View>; }
function Library({ push, onBack }) { const [items, setItems] = useState(null); const reload = useCallback(() => { getDownloads().then(setItems); }, []); useEffect(reload, [reload]); const del = (id) => Alert.alert('حذف', 'هل أنت متأكد؟', [{ text: 'إلغاء' }, { text: 'حذف', onPress: () => removeDownload(id).then(reload) }]); return <View style={{ flex: 1 }}><Header title="الملفات المحفوظة" onBack={onBack} />{!items ? <Loader /> : items.length === 0 ? <View style={styles.center}><Text style={{ color: C.muted }}>لم تحفظ أي ملفات بعد.</Text></View> : <ScrollView contentContainerStyle={{ padding: 12 }}>{items.map((m) => <TouchableOpacity key={m.id} style={styles.libItem} onPress={() => push('offline', { item: m })}><Text style={styles.libTitle}>{m.title}</Text><TouchableOpacity onPress={() => del(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: C.danger, fontSize: 18 }}>✕</Text></TouchableOpacity></TouchableOpacity>)}</ScrollView>}</View>; }
function OfflineVideo({ uri }) {
  const ref = useRef(null);
  const player = useVideoPlayer(uri, (p) => { try { p.play(); } catch {} });
  return <VideoView ref={ref} player={player} style={styles.video} contentFit="contain" nativeControls allowsPictureInPicture startsPictureInPictureAutomatically />;
}
function OfflineScreen({ item, onBack }) { const isImage = item.fileKind === 'IMAGE'; const isVideo = item.fileKind === 'VIDEO'; return <View style={{ flex: 1 }}><Header title="مادة محفوظة" onBack={onBack} /><ScrollView contentContainerStyle={{ padding: 16 }}><Text style={styles.detailTitle}>{item.title}</Text>{isImage && <Image source={{ uri: item.localPath }} style={{ marginTop: 16, width: '100%', aspectRatio: 1, borderRadius: 16 }} resizeMode="cover" />}{isVideo && <OfflineVideo uri={item.localPath} />}{item.bodyText && <ArticleHtml html={item.bodyText} />}</ScrollView></View>; }
function Loader() { return <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>; }
function ErrorBox({ msg, onRetry }) { return <View style={styles.center}><Text style={{ color: C.danger, textAlign: 'center', marginBottom: 12 }}>{msg}</Text>{onRetry && <TouchableOpacity style={styles.errorRetryBtn} onPress={onRetry}><Text style={{ color: C.white, fontWeight: '800' }}>حاول مجددا</Text></TouchableOpacity>}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ivory }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topbar: { backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }, topLogo: { width: 38, height: 38, borderRadius: 8 }, topTitle: { fontSize: 16, fontWeight: '900', color: C.white }, topSub: { fontSize: 11, color: C.gold, marginTop: 2 },
  searchWrap: { backgroundColor: C.brand, flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 }, search: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: C.ink }, searchGo: { paddingHorizontal: 16, justifyContent: 'center' },
  chips: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 }, chip: { backgroundColor: C.ivory, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 2, borderColor: 'transparent' }, chipActive: { backgroundColor: C.brand, borderColor: C.brand }, chipTxt: { color: C.ink, fontWeight: '600', fontSize: 13 }, chipTxtActive: { color: C.white },
  empty: { textAlign: 'center', color: C.muted, marginTop: 32 },
  feedCard: { backgroundColor: C.white, borderRadius: 16, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line }, thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center' }, thumbVideo: { backgroundColor: '#000' }, thumbGlyph: { color: C.white, fontSize: 32 }, feedTitle: { fontSize: 15, fontWeight: '700', color: C.ink }, feedPerson: { fontSize: 12, color: C.muted, marginTop: 2 },
  acctCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.line }, acctTitle: { fontSize: 18, fontWeight: '800', color: C.brand, textAlign: 'right' }, acctSub: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'right' }, acctBuild: { textAlign: 'center', color: C.muted, marginTop: 24, fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brand, paddingBottom: 12, paddingHorizontal: 12 }, headerTitle: { color: C.white, fontSize: 18, fontWeight: '800' }, backBtn: { width: 24, height: 24, justifyContent: 'center' }, backBtnTxt: { color: C.white, fontSize: 18 },
  articleWrap: { marginTop: 16 },
  detailTitle: { fontSize: 24, fontWeight: '900', color: C.brand, textAlign: 'right' }, detailSub: { fontSize: 16, color: C.brand500, marginTop: 4, textAlign: 'right' }, detailPerson: { fontSize: 14, color: C.muted, marginTop: 8, textAlign: 'right', fontStyle: 'italic' },
  documentCard: { marginTop: 16, backgroundColor: C.ivory50, borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: C.line }, documentIcon: { fontSize: 42, marginBottom: 8 }, documentTitle: { fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 4 }, documentType: { fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 16 },
  docBtns: { flexDirection: 'row', gap: 10, marginTop: 14 }, docViewBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 }, docViewTxt: { color: C.white, fontWeight: '700', fontSize: 14, textAlign: 'center' }, docSaveBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 }, docSaveTxt: { color: C.white, fontWeight: '700', fontSize: 14 }, docOpenBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  videoWrap: { marginTop: 16 }, videoInline: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#000' }, video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#000', marginTop: 16 },
  playCard: { height: 150, borderRadius: 16, marginTop: 16, overflow: 'hidden', backgroundColor: C.brand, justifyContent: 'center' }, playCardActive: { backgroundColor: C.gold },
  mini: { backgroundColor: '#12241d', borderTopWidth: 1, borderTopColor: '#294a3d' }, miniProgress: { height: 3, backgroundColor: '#294a3d' }, miniProgressFill: { height: 3, backgroundColor: C.gold }, miniTitle: { fontSize: 13, fontWeight: '600', color: C.white },
  full: { backgroundColor: '#12241d', borderRadius: 20, padding: 18, marginTop: 16, alignItems: 'center' }, fullArt: { width: 128, height: 128, borderRadius: 16, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, fullArtGlyph: { fontSize: 56, color: C.white }, fullTitle: { fontSize: 18, fontWeight: '800', color: C.white, textAlign: 'center' }, fullPerson: { fontSize: 14, color: C.gold, marginTop: 4, textAlign: 'center' },
  seekWrap: { width: '100%' }, seekHit: { paddingVertical: 6 }, seekTrack: { height: 4, backgroundColor: '#294a3d', borderRadius: 2, position: 'relative' }, seekFill: { height: 4, backgroundColor: C.gold, borderRadius: 2 }, seekThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.gold, marginTop: -5 }, seekTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, seekTime: { fontSize: 11, color: C.gold300 },
  jumpBtn: { backgroundColor: '#294a3d', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }, jumpBtnTxt: { color: C.gold, fontWeight: '700', fontSize: 12 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  speedBtn: { backgroundColor: '#294a3d', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' }, speedBtnTxt: { color: C.gold, fontWeight: '700', fontSize: 12 },
  libItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line }, libTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: C.ink },
  errorRetryBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  player: { backgroundColor: C.brand, borderRadius: 18, padding: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }, iconBtnTxt: { color: C.white, fontSize: 18, fontWeight: '700' },
});
