import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, StyleSheet, I18nManager, Alert, Image, RefreshControl, Linking, BackHandler, Share,
  Platform, StatusBar as RNStatusBar, PanResponder, Keyboard, PermissionsAndroid, Animated, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import TrackPlayer, {
  Capability, State, RepeatMode, usePlaybackState, useProgress,
} from 'react-native-track-player';
import * as FileSystem from 'expo-file-system/legacy';
import SafSave from './modules/saf-save';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { C } from './theme';
import { matchSuggestions, variantOf } from './names';
import { api } from './api';
import { ADMIN_URL, CONTRIBUTOR_URL, BUILD, API_BASE, API_HOST } from './config';
import { getDownloads, addDownload, removeDownload, getNotifSeen, setNotifSeen, getAuth, setAuth, clearAuth, getFlag, setFlag, setFlagValue } from './storage';
import { registerForPush, attachNotificationTap, reregisterPush } from './push';
import { EMBLEM_DATA_URI } from './emblemData';
import { useShareIntent } from 'expo-share-intent';

// Force LTR (physical) layout: forcing RTL on this device rendered inconsistently
// (some launches everything drifted left). In LTR, all the Arabic text keeps its
// explicit textAlign:'right', so it sits on the right reliably every launch. The
// native side is forced to LTR too (plugins/with-force-rtl.js) before React starts.
try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch {}

const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة', ARTICLE: 'مقال' };
// Device downloads: a single named album/folder for every saved material, and a
// size guard above which we never base64 a file into memory (avoids OutOfMemory).
const DL_ALBUM = 'أرشيف المسيد';
const DL_BIG = 40 * 1024 * 1024;
// Content-type filter shown as a second chip row: browse all of one kind.
const CONTENT_TYPES = [
  { value: '', label: 'كل الأنواع' },
  { value: 'AUDIO', label: 'صوتيات' },
  { value: 'VIDEO', label: 'مرئيات' },
  { value: 'ARTICLE', label: 'مقالات' },
  { value: 'DOCUMENT', label: 'وثائق' },
  { value: 'IMAGE', label: 'صور' },
];
// Clean vector icon per media kind, used when a material has no cover image.
// A material with no fileKind is written text (an article) → a pen.
const KIND_ICON = { AUDIO: 'mic', VIDEO: 'videocam', IMAGE: 'image', DOCUMENT: 'document-text', ARTICLE: 'pencil' };
function KindIcon({ kind, size = 34, color = C.gold300 }) { return <Ionicons name={KIND_ICON[kind] || 'pencil'} size={size} color={color} />; }
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

// Open the contribution flow (submit a material). The web submit form is opened
// inside the app through the SSO bridge so a signed-in user is already
// authenticated; camera/mic permissions are requested first so the form's
// «تسجيل صوت/فيديو» buttons work. Used from the home CTA, the topbar, and the
// onboarding tour.
async function openContribute(push) {
  if (Platform.OS === 'android') {
    try {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    } catch {}
  }
  setFlag('home-add-used'); // once they contribute, stop nudging the «+»
  const a = await getAuth().catch(() => null);
  const to = '/submit';
  push('web', {
    url: a?.token
      ? `${API_BASE}/mobile-bridge?to=${encodeURIComponent(to)}&token=${encodeURIComponent(a.token)}`
      : `${API_BASE}${to}`,
    title: 'المساهمة في النشر',
  });
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

function AppInner() {
  const insets = useSafeAreaInsets();
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);
  const push = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const top = stack[stack.length - 1];

  // First-launch onboarding journey: guide new users to register and to
  // contribute. Shown once (per device); replayable from the account screen.
  const [showTour, setShowTour] = useState(false);
  useEffect(() => { getFlag('onboarded').then((seen) => { if (!seen) setShowTour(true); }).catch(() => {}); }, []);
  const finishTour = useCallback(() => { setShowTour(false); setFlag('onboarded'); }, []);

  // Share-to-app: when the user shares a file to «أرشيف المسيد» from the
  // gallery / files / audio app, open the native submit screen with that file
  // attached (guarded so one intent opens exactly one screen).
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (!hasShareIntent || sharedHandled.current) return;
    // A shared file can arrive under different field names depending on the
    // source app (path / filePath / a content:// uri), so accept any of them.
    const f = (shareIntent?.files || [])[0];
    // Prefer a real file path for uploading; fall back to the content:// uri.
    const uri = f && (f.filePath || f.path || f.contentUri || f.uri);
    if (uri) {
      // Some sources omit the display name — derive one from the path so the
      // file kind (audio/video/image) is still detected from its extension.
      const fromPath = (f.filePath || f.path || f.contentUri || f.uri || '').split('?')[0].split('/').pop();
      const name = f.fileName || f.name || (fromPath && fromPath.includes('.') ? decodeURIComponent(fromPath) : undefined);
      sharedHandled.current = true;
      setStack((s) => [...s, { name: 'sharesubmit', params: { file: { uri, name, mimeType: f.mimeType, size: f.size || f.fileSize } } }]);
      resetShareIntent();
      setTimeout(() => { sharedHandled.current = false; }, 1500);
    } else if (shareIntent && (shareIntent.text || shareIntent.webUrl)) {
      // Some players/apps share a link or text (e.g. «يُشغَّل الآن»), not the
      // audio file itself — there is nothing to upload. Tell the user clearly
      // instead of silently landing them on the home screen.
      sharedHandled.current = true;
      resetShareIntent();
      Alert.alert(
        'لم يصل ملف',
        'يستقبل التطبيق ملفات الصوت أو الفيديو أو الصور. يبدو أنّ ما شاركته من هذا التطبيق رابطٌ أو نصّ لا الملف نفسه. جرّب المشاركة من «الملفات» أو «المعرض»، أو من مشغّلٍ يُشارك الملف الصوتي مباشرةً.',
      );
      setTimeout(() => { sharedHandled.current = false; }, 1500);
    } else {
      // A share arrived but we couldn't extract a file or text from it — never
      // drop the user silently on the home screen; say what to do.
      sharedHandled.current = true;
      resetShareIntent();
      Alert.alert(
        'تعذّر فتح الملف المُشارَك',
        'لم يتمكّن التطبيق من قراءة الملف من هذا المصدر. جرّب المشاركة من «الملفات» أو «المعرض».',
      );
      setTimeout(() => { sharedHandled.current = false; }, 1500);
    }
  }, [hasShareIntent, shareIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep links: open a specific material when the app is opened via
  // almaseed://material/<id> or https://almaseeed.com/material/<id> (from the
  // «أكمل في التطبيق» link on the website). Auth callbacks (almaseed://auth) are
  // handled by the browser session, not here, so they're ignored below.
  useEffect(() => {
    const handle = (url) => {
      if (!url) return;
      const m = url.match(/(?:almaseed:\/\/material\/|\/material\/)([A-Za-z0-9_-]+)/);
      if (m && m[1]) setStack((s) => (s[s.length - 1]?.params?.id === m[1] ? s : [...s, { name: 'material', params: { id: m[1] } }]));
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);
  // Feed filters + search live here (not in Feed) so they survive navigating
  // into a material and back — otherwise returning reset «الكل» and cleared the
  // search keyword.
  const [feedCat, setFeedCat] = useState('');
  const [feedKind, setFeedKind] = useState('');
  const [feedQ, setFeedQ] = useState('');
  // Offline mode: the app looks the same, but the home shows only the materials
  // already saved «داخل التطبيق», and taps open them from local storage.
  const [offline, setOffline] = useState(false);
  useEffect(() => { getFlag('offline-mode').then((v) => setOffline(!!v)); }, []);
  // On launch, confirm the saved login is still valid. A 401 means it was
  // revoked (password reset / «الخروج من الأجهزة الأخرى» / account disabled) →
  // sign out locally. Network errors (offline) keep the login untouched.
  useEffect(() => { (async () => {
    const a = await getAuth().catch(() => null);
    if (!a || !a.token) return;
    try { await api.me(a.token); } catch (e) {
      if (e && e.status === 401) { await clearAuth().catch(() => {}); reregisterPush(); }
    }
  })(); }, []);
  const toggleOffline = useCallback((v) => {
    const nv = typeof v === 'boolean' ? v : !offline;
    setOffline(nv);
    setFlagValue('offline-mode', nv);
    setStack([{ name: 'home', params: {} }]);
  }, [offline]);
  const [now, setNow] = useState(null);
  const play = useCallback((m) => {
    if (!m?.fileUrl || m.fileKind !== 'AUDIO') return;
    setNow({ id: m.id, title: m.title, subtitle: m.subtitle || null,
      person: m.performer || m.speaker || m.host || null,
      fileUrl: m.fileUrl, fileKind: m.fileKind, poster: m.coverImage || null });
  }, []);
  useEffect(() => { ensureTrackPlayer(); }, []);
  // Register for OS push notifications and route a tap by its type: a review
  // notification opens the (signed-in) web review page — the material is still
  // pending, so the public detail screen would 404 («غير موجودة»); a new-content
  // notification opens the material detail.
  useEffect(() => {
    registerForPush();
    const detach = attachNotificationTap(async (materialId, type, data) => {
      const a = await getAuth().catch(() => null);
      // Open a website page inside the app, signed-in via the SSO bridge when we
      // have a token (needed for non-public pages like review/edit).
      const openWeb = (to, title) => {
        const url = a?.token
          ? `${API_BASE}/mobile-bridge?to=${encodeURIComponent(to)}&token=${encodeURIComponent(a.token)}`
          : `${API_BASE}${to}`;
        push('web', { url, title });
      };
      if (type === 'review_pending' || type === 'review_resubmitted' || type === 'review_hold') {
        // Reviewer notifications → the (signed-in) web review page. The material
        // is still pending/held, so the public detail screen would 404.
        openWeb(`/admin/review/${materialId}`, 'مراجعة المادة');
      } else if (type === 'review_decision') {
        // The contributor's own decision (published / needs-edit / held). The
        // server sends the exact page in `to`; a needs-edit material is NOT public,
        // so it must open the edit page, not the public detail (which 404s).
        const to = (data && data.to) || '/account';
        if (to.startsWith('/material/')) push('material', { id: materialId });
        else openWeb(to, 'مادتي');
      } else {
        push('material', { id: materialId });
      }
    });
    return detach;
  }, []);
  useEffect(() => {
    if (!now) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureTrackPlayer();
        if (cancelled) return;
        await TrackPlayer.reset();
        await TrackPlayer.add({ id: now.id, url: now.fileUrl, title: now.title,
          artist: now.person || 'الطريقة السمّانية — السجادة السليمانية', artwork: now.poster || `${API_BASE}/logo.png` });
        await TrackPlayer.setRate(1);
        await TrackPlayer.play();
        if (!cancelled) api.registerPlay(now.id); // count one listen per track open
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
      <View style={{ flex: 1, paddingBottom: (now && !hideMini) ? 0 : insets.bottom }}>
        {top.name === 'home' && <Feed push={push} active={feedCat} setActive={setFeedCat} kind={feedKind} setKind={setFeedKind} q={feedQ} setQ={setFeedQ} cuesEnabled={!showTour} offline={offline} onExitOffline={() => toggleOffline(false)} />}
        {top.name === 'material' && <MaterialScreen id={top.params.id} push={push} onBack={pop} onPlay={play} onStop={stopNow} nowId={now?.id} />}
        {top.name === 'notifications' && <NotificationsScreen push={push} onBack={pop} />}
        {top.name === 'googlelogin' && <GoogleLoginScreen onBack={pop} />}
        {top.name === 'library' && <Library push={push} onBack={pop} />}
        {top.name === 'offline' && <OfflineScreen item={top.params.item} onBack={pop} />}
        {top.name === 'account' && <Account push={push} onBack={pop} onTour={() => setShowTour(true)} cueGoogle={!!top.params?.cueGoogle} offline={offline} onToggleOffline={toggleOffline} />}
        {top.name === 'sharesubmit' && <ShareSubmitScreen file={top.params.file} push={push} onBack={pop} onDone={() => setStack([{ name: 'home', params: {} }])} />}
        {top.name === 'web' && <WebScreen url={top.params.url} title={top.params.title} onBack={pop} />}
        {top.name === 'pdf' && <PdfScreen url={top.params.url} title={top.params.title} onBack={pop} />}
      </View>
      {now && !hideMini && <MiniPlayer item={now} onClose={stopNow} onOpen={openNow} bottomInset={insets.bottom} />}
      {showTour && (
        <Onboarding
          onDone={finishTour}
          onRegister={() => { finishTour(); push('account', { cueGoogle: true }); }}
          onContribute={() => { finishTour(); openContribute(push); }}
        />
      )}
    </SafeAreaView>
  );
}

function Feed({ push, active, setActive, kind, setKind, q, setQ, cuesEnabled, offline, onExitOffline }) {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  // Offline mode: browse only the materials saved «داخل التطبيق».
  const [downloads, setDownloads] = useState(null);
  useEffect(() => { if (offline) getDownloads().then(setDownloads).catch(() => setDownloads([])); }, [offline]);
  // Autocomplete: suggestions fetched (debounced) as the user types, shown only
  // while the search box is focused.
  const [sug, setSug] = useState([]);
  const [focused, setFocused] = useState(false);
  // Sign-in state, only to pick which quick-guide clip to show at the top.
  const [guideAuth, setGuideAuth] = useState(undefined);
  useEffect(() => { getAuth().then((a) => setGuideAuth(a || null)).catch(() => setGuideAuth(null)); }, []);
  useEffect(() => { api.categories().then((d) => setCats(d.items)).catch(() => {}); }, []);
  // Count how many materials were published since the user last opened the bell.
  useEffect(() => { (async () => {
    try {
      const seen = await getNotifSeen();
      const a = await getAuth();
      const d = await api.notifications(a?.token); // staff token also brings review items
      const n = (d.items || []).filter((x) => { const t = x.at || x.publishedAt; return t && new Date(t).getTime() > seen; }).length;
      setUnread(n);
    } catch {}
  })(); }, []);
  const load = useCallback((cat, query, k) => {
    setErr(''); setItems(null);
    return api.materials(cat || undefined, query || undefined, 1, k || undefined).then((d) => setItems(d.items)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(active, q, kind); /* eslint-disable-next-line */ }, [active, kind]);
  // Debounced autocomplete — fetch suggestions ~300ms after the last keystroke.
  useEffect(() => {
    const term = (q || '').trim();
    if (term.length < 2) { setSug([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.suggest(term).then((d) => { if (!cancelled) setSug(d.items || []); }).catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);
  const runSearch = () => { setFocused(false); Keyboard.dismiss(); load(active, q, kind); };
  const pickSug = (s) => { setQ(s.title); setFocused(false); Keyboard.dismiss(); push('material', { id: s.id }); };
  // Offline mode: same-looking home, but populated ONLY with the saved materials
  // — everything opens from local storage, nothing hits the network.
  if (offline) {
    const list = (downloads || []).filter((d) => { const t = (q || '').trim(); return !t || (d.title || '').includes(t) || (d.person || '').includes(t); });
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.topbar, { paddingTop: STATUSBAR_H + 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, marginLeft: 8 }}>
            <Image source={require('./assets/emblem.png')} style={styles.topLogo} />
            <View style={{ flexShrink: 1 }}><Text style={styles.topTitle} numberOfLines={1}>الطريقة السمّانية</Text><Text style={styles.topSub} numberOfLines={1}>السجادة السليمانية</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}><IconBtn label="☰" onPress={() => push('account')} /></View>
        </View>
        <TouchableOpacity onPress={onExitOffline} activeOpacity={0.85} style={styles.offlineBar}>
          <Ionicons name="cloud-offline-outline" size={16} color={C.brand} />
          <Text style={styles.offlineBarTxt}>الوضع دون اتصال — تُعرض المواد المحفوظة فقط · اضغط للعودة للاتصال</Text>
        </TouchableOpacity>
        <View style={styles.searchWrap}><View style={styles.searchBox}><TextInput value={q} onChangeText={setQ} placeholder="ابحث في المحفوظات…" placeholderTextColor="#cbd5cf" style={styles.search} /></View></View>
        {downloads === null ? <Loader /> : list.length === 0 ? (
          <View style={styles.center}><Text style={styles.empty}>لا توجد مواد محفوظة.</Text><Text style={{ color: C.muted, textAlign: 'center', marginTop: 6 }}>احفظ أي مادة عبر «حفظ داخل التطبيق» لتتصفّحها هنا دون اتصال.</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 8 }}>
            {list.map((it) => <TouchableOpacity key={it.id} style={styles.feedCard} activeOpacity={0.85} onPress={() => push('offline', { item: it })}><View style={[styles.thumb, { width: 64, height: 64 }]}><KindIcon kind={it.fileKind} size={26} /></View><View style={{ flex: 1 }}><Text style={styles.feedTitle} numberOfLines={2}>{it.title}</Text><Text style={styles.feedPerson} numberOfLines={1}>{(it.person || '') + '  ·  ' + (KIND_LABEL[it.fileKind] || 'مقال')}</Text></View></TouchableOpacity>)}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.topbar, { paddingTop: STATUSBAR_H + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, marginLeft: 8 }}>
          <Image source={require('./assets/emblem.png')} style={styles.topLogo} />
          <View style={{ flexShrink: 1 }}><Text style={styles.topTitle} numberOfLines={1}>الطريقة السمّانية</Text><Text style={styles.topSub} numberOfLines={1}>السجادة السليمانية</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ alignItems: 'center', justifyContent: 'center' }}><AttnRing /><TouchableOpacity onPress={() => openContribute(push)} style={[styles.iconBtn, styles.iconBtnGold]} activeOpacity={0.8}><Ionicons name="add" size={26} color={C.brand} /></TouchableOpacity><AddButtonCue enabled={cuesEnabled} /></View><TouchableOpacity onPress={() => push('notifications')} style={styles.iconBtn} activeOpacity={0.8}><Ionicons name="notifications-outline" size={21} color={C.white} />{unread > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View>}</TouchableOpacity><IconBtn label="☰" onPress={() => push('account')} /></View>
      </View>
      <FirstUseCue flag="cue-search" label="ابحث عن أي مادة" enabled={cuesEnabled}>
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <TextInput value={q} onChangeText={setQ} placeholder="ابحث في الأرشيف…" placeholderTextColor="#cbd5cf" style={styles.search} returnKeyType="search" onSubmitEditing={runSearch} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} />
            {!!q && <TouchableOpacity onPress={() => { setQ(''); setSug([]); load(active, '', kind); }} style={styles.searchClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={18} color="#9aa4a0" /></TouchableOpacity>}
          </View>
          <TouchableOpacity style={styles.searchGo} onPress={runSearch}><Text style={{ color: C.brand, fontWeight: '800' }}>بحث</Text></TouchableOpacity>
        </View>
      </FirstUseCue>
      {focused && sug.length > 0 && (
        <View style={styles.sugBox}>
          {sug.map((s) => (
            <TouchableOpacity key={s.id} style={styles.sugRow} activeOpacity={0.7} onPress={() => pickSug(s)}>
              <Ionicons name="search" size={15} color="#9aa4a0" style={{ marginLeft: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sugTitle} numberOfLines={1}>{s.title}</Text>
                {!!s.subtitle && <Text style={styles.sugSub} numberOfLines={1}>{s.subtitle}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <FirstUseCue flag="cue-filters" label="صفِّ حسب القسم والنوع" enabled={cuesEnabled}>
        <View>
          <Text style={styles.filterCap}>الأقسام</Text>
          <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="الكل" active={active === ''} onPress={() => setActive('')} />{cats.map((c) => <Chip key={c.slug} label={c.name} active={active === c.slug} onPress={() => setActive(active === c.slug ? '' : c.slug)} />)}</ScrollView></View>
          <View style={styles.filterDivider} />
          <Text style={styles.filterCap}>الأنواع</Text>
          <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>{CONTENT_TYPES.map((t) => <Chip key={t.value || 'all'} label={t.label} active={kind === t.value} onPress={() => setKind(kind === t.value ? '' : t.value)} />)}</ScrollView></View>
        </View>
      </FirstUseCue>
      {err ? <ErrorBox msg={err} onRetry={() => load(active, q, kind)} /> : !items ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4 }} refreshControl={<RefreshControl tintColor={C.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(active, q, kind); setRefreshing(false); }} />}>
          {guideAuth !== undefined && (
            <FirstUseCue flag="home-guide" label="شاهد الفيديو التعريفي" enabled={cuesEnabled}>
              <GuideVideoCard
                key={guideAuth ? 'g-app' : 'g-applogin'}
                url={`${API_BASE}/guide/${guideAuth ? 'guide_share_app' : 'guide_app_login'}.mp4`}
                poster={`${API_BASE}/guide/${guideAuth ? 'guide_share_app' : 'guide_app_login'}_poster.jpg`}
                title={guideAuth ? 'كيف تشارك مادة من التطبيق' : 'سجّل الدخول عبر Google'}
                subtitle={guideAuth ? 'شارك صوتًا أو فيديو أو صورة مباشرةً إلى الأرشيف' : 'أسهل طريقة للدخول في التطبيق'}
                onGuide={() => push('web', { url: `${API_BASE}/guide`, title: 'الدليل المصوّر' })}
              />
            </FirstUseCue>
          )}
          {items.length === 0 && <Text style={styles.empty}>لا توجد مواد.</Text>}{items.map((m) => <FeedCard key={m.id} m={m} onPress={() => push('material', { id: m.id })} />)}<View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}
// A soft up/down bob animation, started only while `active`. Shared by the
// coach-marks so the pointer gently draws the eye.
function useBob(active) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -6, duration: 700, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return bob;
}

// A one-time bobbing pill under the topbar «+» button, telling first-time users
// this is where they contribute. Waits until onboarding finishes (`enabled`).
function AddButtonCue({ enabled }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!enabled) { setShow(false); return; }
    let on = true;
    // Keep nudging toward «+» on every launch until the user actually contributes.
    getFlag('home-add-used').then((used) => { if (on && !used) setShow(true); });
    return () => { on = false; };
  }, [enabled]);
  const bob = useBob(show);
  if (!show) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.addCue, { transform: [{ translateY: bob }] }]}>
      <Text style={styles.addCueArrow}>▲</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setShow(false)} style={cueStyles.pill}>
        <Text style={cueStyles.pillTxt}>👆 شارك مادة من هنا</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// A continuously pulsing gold ring that expands and fades behind an icon to
// draw the eye to it (used on the topbar «ساهم في النشر» action).
function AttnRing() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1500, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.4] });
  const opacity = a.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  return <Animated.View pointerEvents="none" style={[styles.attnRing, { opacity, transform: [{ scale }] }]} />;
}

// A gentle «look here» coach-mark. It floats a softly bobbing «👀 …» pill above
// whatever it wraps. Two modes:
//  • flag mode (default): shows once per device (marks the flag seen the first
//    time it actually appears), and only while `enabled` — so a cue behind the
//    onboarding overlay is NOT consumed; it waits until the tour finishes.
//  • controlled mode (`controlled` passed): visibility follows the prop, so a
//    caller can show it after a specific event (e.g. right after login).
// Tapping the pill hides it.
function FirstUseCue({ flag, label, children, enabled = true, controlled, placement = 'inside' }) {
  const isControlled = controlled !== undefined;
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (isControlled || !enabled) return;
    let on = true;
    getFlag(flag).then((seen) => {
      if (on && !seen) { setShow(true); setFlag(flag); } // one-time: mark seen on first appearance
    });
    return () => { on = false; };
  }, [flag, enabled, isControlled]);
  const visible = isControlled ? (controlled && !dismissed) : show;
  const bob = useBob(visible);
  const hide = () => (isControlled ? setDismissed(true) : setShow(false));
  return (
    <View>
      {children}
      {visible && (
        <Animated.View pointerEvents="box-none" style={[placement === 'above' ? cueStyles.wrapAbove : cueStyles.wrap, { transform: [{ translateY: bob }] }]}>
          <TouchableOpacity activeOpacity={0.85} onPress={hide} style={cueStyles.pill}>
            <Text style={cueStyles.pillTxt}>👀 {label}</Text>
          </TouchableOpacity>
          <Text style={cueStyles.arrow}>▾</Text>
        </Animated.View>
      )}
    </View>
  );
}
// A standalone bobbing pointer aimed upward at the header back button, shown
// right after a fresh sign-in to guide the user back to the home screen.
function BackHint({ onDismiss }) {
  const bob = useBob(true);
  return (
    <Animated.View pointerEvents="box-none" style={[cueStyles.backHint, { top: STATUSBAR_H + 46, transform: [{ translateY: bob }] }]}>
      <Text style={cueStyles.backArrow}>▲</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onDismiss} style={cueStyles.pill}>
        <Text style={cueStyles.pillTxt}>👆 للرجوع للرئيسية</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cueStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  wrapAbove: { position: 'absolute', bottom: '100%', left: 0, right: 0, alignItems: 'center', zIndex: 30, marginBottom: 2 },
  pill: { backgroundColor: '#cd9b44', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  pillTxt: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  arrow: { color: '#cd9b44', fontSize: 20, marginTop: -3, textShadowColor: '#0003', textShadowRadius: 3 },
  backHint: { position: 'absolute', right: 16, alignItems: 'center', zIndex: 40 },
  backArrow: { color: '#cd9b44', fontSize: 20, marginBottom: -3, textShadowColor: '#0003', textShadowRadius: 3 },
});

// Interactive first-launch journey for new users. A swipeable, 4-step tour that
// welcomes the visitor, shows that browsing is free, then guides them to create
// an account (via Google) and to contribute a material. Shown once per device
// and replayable from the account screen.
const ONB_SLIDES = [
  {
    icon: 'sparkles-outline',
    title: 'أهلاً بك في أرشيف المسيد',
    body: 'منصّة تحفظ مدائح ومحاضرات وندوات ومواعظ ومناسبات وصور الطريقة السمّانية — السجادة السليمانية، وتُبقيها قريبة منك.',
  },
  {
    icon: 'headset-outline',
    title: 'تصفّح واستمع بحرية',
    body: 'ابحث في الأرشيف، استمع، وحمّل المواد للاستماع دون اتصال — كل ذلك متاح للجميع دون حساب.',
  },
  {
    icon: 'person-add-outline',
    title: 'أنشئ حسابك عبر Google',
    body: 'أسهل طريقة للدخول. سجّل لتساهم بموادك، وتتابع حالتها، وتصلك الإشعارات.',
    cta: 'register',
    ctaLabel: 'سجّل الدخول عبر Google',
  },
  {
    icon: 'cloud-upload-outline',
    title: 'شارك مادة في الأرشيف',
    body: 'اختر النوع، أرفِق الملف (صوت أو فيديو أو صورة)، وأرسله للمراجعة — ثم يُنشر ليصل إلى الجميع.',
    cta: 'contribute',
    ctaLabel: 'ابدأ المساهمة',
  },
];
function Onboarding({ onDone, onRegister, onContribute }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const last = ONB_SLIDES.length - 1;
  const goTo = (n) => { const t = Math.max(0, Math.min(last, n)); ref.current?.scrollTo({ x: t * width, animated: true }); setI(t); };
  const slide = ONB_SLIDES[i];
  const runCta = (cta) => { if (cta === 'register') onRegister(); else if (cta === 'contribute') onContribute(); };
  return (
    <View style={[onb.overlay, { paddingTop: insets.top }]}>
      <View style={onb.topRow}>
        <TouchableOpacity onPress={onDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <Text style={onb.skip}>تخطٍّ</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flexGrow: 0 }}
      >
        {ONB_SLIDES.map((s) => (
          <View key={s.title} style={[onb.slide, { width }]}>
            <View style={onb.iconWrap}><Ionicons name={s.icon} size={54} color={C.brand} /></View>
            <Text style={onb.title}>{s.title}</Text>
            <Text style={onb.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={[onb.footer, { paddingBottom: (insets.bottom || 12) + 8 }]}>
        <View style={onb.dots}>
          {ONB_SLIDES.map((_, n) => <View key={n} style={[onb.dot, n === i && onb.dotOn]} />)}
        </View>
        {slide.cta ? (
          <>
            <TouchableOpacity style={onb.primary} activeOpacity={0.85} onPress={() => runCta(slide.cta)}>
              {slide.cta === 'register' && <Text style={onb.googleG}>G</Text>}
              <Text style={onb.primaryTxt}>{slide.ctaLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => (i === last ? onDone() : goTo(i + 1))} activeOpacity={0.7} style={{ padding: 10 }}>
              <Text style={onb.secondaryTxt}>{i === last ? 'ابدأ الاستكشاف' : 'لاحقًا'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={onb.primary} activeOpacity={0.85} onPress={() => goTo(i + 1)}>
            <Text style={onb.primaryTxt}>التالي</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const onb = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.brand, zIndex: 50 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 8 },
  skip: { color: '#e7d9b6', fontSize: 14, fontWeight: '700' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  iconWrap: { width: 116, height: 116, borderRadius: 58, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  title: { color: C.white, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  body: { color: '#dfeae4', fontSize: 15.5, lineHeight: 27, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 7, marginBottom: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff33' },
  dotOn: { backgroundColor: C.gold, width: 22 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, borderRadius: 16, paddingVertical: 15, width: '100%' },
  primaryTxt: { color: C.brand, fontSize: 16, fontWeight: '800' },
  googleG: { color: '#4285F4', fontSize: 18, fontWeight: '900', backgroundColor: '#fff', width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, overflow: 'hidden' },
  secondaryTxt: { color: '#e7d9b6', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});

// A short tutorial clip on the home feed: shows a poster with a play button and
// only starts (and downloads) the video when tapped — data-friendly. The videos
// are hosted on the website (/guide/*.mp4) so they can be updated without an app
// build. Which clip shows is chosen by the caller based on sign-in state.
// The player lives in its own component, mounted only once «تشغيل» is tapped:
// creating it with the card made the guide video start downloading in the
// background every time the home opened, spending the user's mobile data.
function GuideVideoPlayer({ url }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; try { p.play(); } catch {} });
  return (
    <View style={styles.guidePlayer}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls allowsFullscreen />
    </View>
  );
}
function GuideVideoCard({ url, poster, title, subtitle, onGuide }) {
  const [play, setPlay] = useState(false);
  return (
    <View style={styles.guideCard}>
      {play ? (
        // Compact, screen-fitting player (tap ⛶ for fullscreen). Not the full
        // phone-height video, so the home stays usable.
        <GuideVideoPlayer url={url} />
      ) : (
        // Collapsed by default: a small preview + title, opened only on demand.
        <TouchableOpacity style={styles.guideCompact} activeOpacity={0.9} onPress={() => setPlay(true)}>
          <View style={styles.guideThumb}>
            {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <View style={styles.guideThumbPlay}><Text style={styles.guidePlayIcon}>▶</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideTitle} numberOfLines={2}>{title}</Text>
            {!!subtitle && <Text style={styles.guideSub} numberOfLines={2}>{subtitle}</Text>}
          </View>
        </TouchableOpacity>
      )}
      <View style={styles.guideBtns}>
        <TouchableOpacity style={styles.guidePlayBtn} activeOpacity={0.85} onPress={() => setPlay((p) => !p)}>
          <Ionicons name={play ? 'close' : 'play'} size={16} color={C.white} />
          <Text style={styles.guidePlayTxt}>{play ? 'إغلاق الفيديو' : 'شغّل الفيديو التعريفي'}</Text>
        </TouchableOpacity>
        {onGuide && (
          <TouchableOpacity style={styles.guideDocBtn} activeOpacity={0.85} onPress={onGuide}>
            <Ionicons name="book-outline" size={16} color={C.brand} />
            <Text style={styles.guideDocTxt}>الدليل المصوّر</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
function FeedCard({ m, onPress }) {
  // No file → a written article (مقال), never audio. Robust even if an old row
  // carries a stray fileKind.
  const kind = m.fileUrl ? m.fileKind : 'ARTICLE';
  const isVideo = kind === 'VIDEO';
  const person = m.category?.slug === 'readings' ? m.author : (m.performer || m.speaker || m.host);
  return <TouchableOpacity style={styles.feedCard} onPress={onPress} activeOpacity={0.85}><View style={[styles.thumb, isVideo && styles.thumbVideo]}>{m.coverImage ? <Image source={{ uri: m.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <KindIcon kind={kind} />}<View style={styles.kindBadge}><Text style={styles.kindBadgeTxt}>{KIND_LABEL[kind] || 'مقال'}</Text></View></View><View style={{ flex: 1 }}><Text style={styles.feedTitle} numberOfLines={2}>{m.title}</Text>{!!person && <Text style={styles.feedPerson} numberOfLines={1}>{person}</Text>}{!!m.category && <Text style={styles.feedCat}>{m.category.name}</Text>}</View></TouchableOpacity>;
}
function Chip({ label, active, onPress }) { return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text></TouchableOpacity>; }
function IconBtn({ label, onPress }) { return <TouchableOpacity onPress={onPress} style={styles.iconBtn}><Text style={styles.iconBtnTxt}>{label}</Text></TouchableOpacity>; }
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'الآن';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} ساعة`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `قبل ${days} يوم`;
  try { return new Date(iso).toLocaleDateString('ar'); } catch { return ''; }
}
function NotificationsScreen({ push, onBack }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [seen, setSeen] = useState(0);
  const [auth, setAuthLocal] = useState(null);
  const load = useCallback((token) => {
    setErr('');
    return api.notifications(token).then((d) => setItems(d.items || [])).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { (async () => {
    setSeen(await getNotifSeen());
    const a = await getAuth(); setAuthLocal(a);
    await load(a?.token); // staff token → also review-pending items
    // Opening the screen marks everything up to now as seen (clears the badge).
    await setNotifSeen(Date.now());
  })(); }, [load]);
  // A review item opens the web review page (signed in via the SSO bridge); a
  // published item opens the material detail.
  const openItem = (m) => {
    if (m.type === 'review') {
      if (auth?.token) {
        push('web', { url: `${API_BASE}/mobile-bridge?to=${encodeURIComponent(`/admin/review/${m.id}`)}&token=${encodeURIComponent(auth.token)}`, title: 'مراجعة المادة' });
      } else {
        push('web', { url: `${API_BASE}/admin/review/${m.id}`, title: 'مراجعة المادة' });
      }
      return;
    }
    push('material', { id: m.id });
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="الإشعارات" onBack={onBack} />
      {err ? <ErrorBox msg={err} onRetry={() => load(auth?.token)} /> : !items ? <Loader /> : items.length === 0 ? (
        <Text style={styles.empty}>لا توجد إشعارات بعد.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {items.map((m) => {
            const at = m.at || m.publishedAt;
            const isNew = at && new Date(at).getTime() > seen;
            const isReview = m.type === 'review';
            return (
              <TouchableOpacity key={`${m.type || 'new'}-${m.id}`} style={[styles.notifItem, isReview && styles.notifItemReview]} activeOpacity={0.85} onPress={() => openItem(m)}>
                <View style={styles.notifThumb}>{m.coverImage ? <Image source={{ uri: m.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <KindIcon kind={m.fileUrl ? m.fileKind : 'ARTICLE'} size={22} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifLead, isReview && styles.notifLeadReview]}>{isReview ? 'بانتظار المراجعة' : 'إضافة جديدة'}{m.category ? ` · ${m.category.name}` : ''}</Text>
                  <Text style={styles.notifTitle} numberOfLines={2}>{m.title}</Text>
                  <Text style={styles.notifTime}>{timeAgo(at)}</Text>
                </View>
                {isNew && <View style={[styles.newDot, isReview && styles.newDotReview]} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}
function Account({ push, onBack, onTour, cueGoogle, offline, onToggleOffline }) {
  const [auth, setAuthState] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  // After a fresh sign-in, point the user back to the home screen and to the
  // guided tour with gentle cues.
  const [showBackCue, setShowBackCue] = useState(false);
  const [showTourCue, setShowTourCue] = useState(false);
  // When arriving from the onboarding «سجّل الدخول عبر Google» step, point at the
  // actual Google button so the guidance continues here.
  const [showGoogleCue, setShowGoogleCue] = useState(!!cueGoogle);
  const cueAfterLogin = () => { setShowBackCue(true); setShowTourCue(true); setShowGoogleCue(false); };
  useEffect(() => { getAuth().then((a) => setAuthState(a)).catch(() => {}); }, []);
  const doLogin = async () => {
    if (!email.trim() || !pass) { Alert.alert('بيانات ناقصة', 'أدخل البريد وكلمة المرور.'); return; }
    try {
      setBusy(true);
      const r = await api.login(email.trim().toLowerCase(), pass);
      await setAuth(r); setAuthState(r); setPass('');
      cueAfterLogin();
      // Refresh this device's role on the server so staff get review alerts.
      reregisterPush();
      Alert.alert('تم الدخول', r.user?.isStaff ? 'ستصلك إشعارات المواد التي تنتظر المراجعة.' : 'تم تسجيل دخولك.');
    } catch (e) { Alert.alert('تعذّر الدخول', String(e.message || e)); } finally { setBusy(false); }
  };
  const doLogout = async () => { await clearAuth(); setAuthState(null); reregisterPush(); };
  // One-tap Google via the system browser (Chrome Custom Tab shares the phone's
  // Google session, so the user just picks an account — no password typing).
  const googleLogin = async () => {
    try {
      const result = await WebBrowser.openAuthSessionAsync(`${API_BASE}/mobile-login/google`, 'almaseed://auth');
      if (result.type !== 'success' || !result.url) return; // cancelled
      const token = decodeURIComponent((result.url.match(/[?&]token=([^&#]+)/) || [])[1] || '');
      const error = decodeURIComponent((result.url.match(/[?&]error=([^&#]+)/) || [])[1] || '');
      if (error || !token) { Alert.alert('تعذّر الدخول عبر Google', error === 'notconfigured' ? 'خدمة Google غير مُفعّلة بعد على الخادم.' : 'حاول مرة أخرى.'); return; }
      const { user } = await api.me(token);
      await setAuth({ token, user }); setAuthState({ token, user }); cueAfterLogin(); reregisterPush();
      Alert.alert('تم الدخول', user?.isStaff ? 'ستصلك إشعارات المواد التي تنتظر المراجعة.' : 'تم تسجيل دخولك عبر Google.');
    } catch (e) { Alert.alert('تعذّر الدخول', String(e.message || e)); }
  };
  // One login: when signed in, open the web pages through the SSO bridge so they
  // are already authenticated (no second login). Otherwise open them normally.
  const openWeb = async (to, title) => {
    // The contributor page hosts the submit form, whose «تسجيل فيديو/صوت» buttons
    // use the camera/microphone. Android's WebView HIDES the camera-capture option
    // unless CAMERA is granted at runtime (even when declared in the manifest), so
    // the buttons look unresponsive. Request the permissions first.
    if (to === '/account' && Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      } catch {}
    }
    push('web', {
      url: auth?.token ? `${API_BASE}/mobile-bridge?to=${encodeURIComponent(to)}&token=${encodeURIComponent(auth.token)}` : `${API_BASE}${to}`,
      title,
    });
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="الدخول والإدارة" onBack={onBack} />
      {showBackCue && <BackHint onDismiss={() => setShowBackCue(false)} />}
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {auth ? (
          <View style={styles.acctCard}>
            <Text style={styles.acctTitle}>مرحبًا، {auth.user?.name}</Text>
            <Text style={styles.acctDesc}>{auth.user?.roleLabel || ''}{auth.user?.isStaff ? ' — تصلك إشعارات المراجعة' : ''}</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={doLogout} activeOpacity={0.85}><Text style={styles.logoutTxt}>تسجيل الخروج</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.acctCard}>
            <Text style={styles.acctTitle}>تسجيل الدخول</Text>
            <Text style={styles.acctDesc}>للمشرفين والمراجعين: سجّل دخولك ليصلك إشعار فور وصول مادة تنتظر المراجعة.</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor="#9aa4a0" autoCapitalize="none" keyboardType="email-address" style={styles.authInput} />
            <TextInput value={pass} onChangeText={setPass} placeholder="كلمة المرور" placeholderTextColor="#9aa4a0" secureTextEntry style={styles.authInput} />
            <TouchableOpacity style={styles.authBtn} onPress={doLogin} disabled={busy} activeOpacity={0.85}>{busy ? <ActivityIndicator color={C.white} /> : <Text style={styles.authBtnTxt}>دخول</Text>}</TouchableOpacity>
            <TouchableOpacity onPress={() => push('web', { url: `${API_BASE}/forgot-password`, title: 'استعادة كلمة المرور' })} style={{ marginTop: 12 }} activeOpacity={0.7}><Text style={{ color: C.gold, textAlign: 'center', fontWeight: '700', fontSize: 13 }}>نسيت كلمة المرور؟</Text></TouchableOpacity>
            <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orTxt}>أو</Text><View style={styles.orLine} /></View>
            <FirstUseCue controlled={showGoogleCue} placement="above" label="سجّل الدخول من هنا">
              <TouchableOpacity style={styles.googleBtn} onPress={googleLogin} activeOpacity={0.85}><Text style={styles.googleG}>G</Text><Text style={styles.googleTxt}>الدخول عبر Google</Text></TouchableOpacity>
            </FirstUseCue>
            <Text style={[styles.acctDesc, { marginTop: 12 }]}>التصفّح متاح للجميع دون حساب — التسجيل اختياري وهو للمشرفين والمساهمين.</Text>
            <TouchableOpacity style={styles.guestBtn} onPress={onBack} activeOpacity={0.85}><Text style={styles.guestTxt}>متابعة كزائر</Text></TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.acctCard} onPress={() => openWeb('/account', 'حسابي')}><Text style={styles.acctTitle}>صفحة المساهم</Text><Text style={styles.acctDesc}>إرسال مادة ومتابعة موادك</Text></TouchableOpacity>
        <TouchableOpacity style={styles.acctCard} onPress={() => openWeb('/admin', 'لوحة الإشراف')}><Text style={styles.acctTitle}>لوحة الإشراف</Text><Text style={styles.acctDesc}>مراجعة المحتوى وإدارة الأرشيف</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.acctCard, { backgroundColor: C.ivory50 }]} onPress={() => push('library')}><Text style={styles.acctTitle}>التنزيلات المحفوظة</Text><Text style={styles.acctDesc}>الاستماع دون اتصال</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.acctCard, offline ? { backgroundColor: '#eaf3ee', borderColor: C.brand, borderWidth: 1 } : { backgroundColor: C.ivory50 }]} onPress={() => { onToggleOffline && onToggleOffline(); onBack(); }} activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text style={styles.acctTitle}>الوضع دون اتصال</Text><Text style={styles.acctDesc}>{offline ? 'مُفعّل — تُعرض المواد المحفوظة فقط. اضغط للإيقاف' : 'اعرض وشغّل المواد المحفوظة فقط دون إنترنت'}</Text></View>
            <View style={[styles.offlineToggle, offline && styles.offlineToggleOn]}><View style={[styles.offlineKnob, offline && styles.offlineKnobOn]} /></View>
          </View>
        </TouchableOpacity>
        {onTour && (
          <FirstUseCue controlled={showTourCue} label="جرّب الجولة التعريفية">
            <TouchableOpacity style={[styles.acctCard, { backgroundColor: C.ivory50 }]} onPress={() => { onBack(); onTour(); }}><Text style={styles.acctTitle}>الجولة التعريفية</Text><Text style={styles.acctDesc}>أعد مشاهدة رحلة التعرّف على التطبيق</Text></TouchableOpacity>
          </FirstUseCue>
        )}
        <Text style={styles.footerText}>الطريقة السمّانية — السجادة السليمانية</Text>
        <Text style={styles.footerText}>إصدار التطبيق: {BUILD}</Text>
      </ScrollView>
    </View>
  );
}
function Header({ title, onBack }) { return <View style={[styles.header, { paddingTop: STATUSBAR_H + 8 }]}><View style={{ width: 92 }} /><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>{onBack ? <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}><Text style={[styles.backTxt, { writingDirection: 'rtl', flex: 1 }]}>رجوع ›</Text></TouchableOpacity> : <View style={{ width: 92 }} />}</View>; }
// Force a device-width viewport inside the WebView so pages (esp. the admin
// area) never render at a desktop width and overflow the phone screen.
const FIT_VIEWPORT = `(function(){try{var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.getElementsByTagName('head')[0].appendChild(m);}m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');var s=document.getElementById('__fit');if(!s){s=document.createElement('style');s.id='__fit';s.textContent='html,body{max-width:100vw!important;overflow-x:clip!important}';document.getElementsByTagName('head')[0].appendChild(s);}}catch(e){}})();true;`;
// Native submit screen for a file shared into the app. Its fields come straight
// from /api/mobile/fields (the SAME definitions the website form uses), so it
// can never diverge from the site; the upload + submit go through the mobile
// endpoints that run the SAME server validation.
// Text field that offers names already in the archive while typing, and — if
// what was typed is only a spelling variant of an existing name («شيخ ابراهيم
// دنقول» vs «الشيخ إبراهيم دنقول») — offers the archive's spelling in one tap,
// so the same person isn't recorded twice. Mirrors the website's NameInput.
function NameField({ value, onChange, list, style, placeholder }) {
  const [focused, setFocused] = useState(false);
  const sugg = focused ? matchSuggestions(list, value) : [];
  const variant = !focused ? variantOf(list, value) : null;
  return <View>
    <TextInput value={value} onChangeText={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={style} placeholder={placeholder} placeholderTextColor="#9aa4a0" />
    {sugg.length > 0 && <View style={styles.suggBox}>{sugg.map((s) => <TouchableOpacity key={s} onPress={() => { onChange(s); Keyboard.dismiss(); }} style={styles.suggItem} activeOpacity={0.7}><Text style={styles.suggTxt} numberOfLines={1}>{s}</Text></TouchableOpacity>)}</View>}
    {!!variant && <TouchableOpacity onPress={() => onChange(variant)} style={styles.variantBox} activeOpacity={0.8}><Text style={styles.variantTxt}>موجود في الأرشيف باسم «{variant}» — <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>اضغط لاستخدامه</Text></Text></TouchableOpacity>}
  </View>;
}

function ShareSubmitScreen({ file, push, onBack, onDone }) {
  const [auth, setAuthState] = useState(undefined); // undefined = loading
  const [schema, setSchema] = useState(null);       // { categories, forms }
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState('');
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');
  const [rights, setRights] = useState(false);
  const [consent, setConsent] = useState(false);

  const kindOf = (mime, name) => {
    const ext = ((name || '').split('.').pop() || '').toLowerCase();
    if ((mime || '').startsWith('audio') || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'opus', 'amr', 'oga', 'weba'].includes(ext)) return 'AUDIO';
    if ((mime || '').startsWith('video') || ['mp4', 'mov', 'webm', 'm4v', '3gp', 'mkv'].includes(ext)) return 'VIDEO';
    if ((mime || '').startsWith('image') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'IMAGE';
    return 'DOCUMENT';
  };
  const fileKind = kindOf(file?.mimeType, file?.name);

  // Turn whatever the share handed us into a clean, readable local file.
  // Different sources behave very differently: the stock music player gives a
  // content:// MediaStore uri, others give a file:// path whose name has Arabic
  // characters or spaces — both make RN's uploader fail with a vague "Network
  // request failed". Copying to an ASCII-named cache file sidesteps all of that,
  // and we verify the copy exists and is non-empty so we fail with a clear
  // message instead of a silent network error. Returns { uri, size, mimeType }.
  const toUploadable = async (f) => {
    if (!f?.uri) throw new Error('لا يوجد ملف للإرسال.');
    const raw = (f.name || f.uri).split('?')[0];
    const ext = ((raw.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 5) || 'dat';
    const dest = `${FileSystem.cacheDirectory}share_${Date.now()}.${ext}`;
    const doCopy = async () => {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: f.uri, to: dest });
    };
    try {
      await doCopy();
    } catch (e1) {
      // A raw file:// path into another app's folder (e.g. WhatsApp mods like
      // OBWhatsApp share file:///storage/emulated/0/OBWhatsApp/…) is blocked by
      // Android scoped storage — there is no per-share grant like content:// has.
      // Ask for read permission once and retry; if it still fails, guide the user.
      if (f.uri.startsWith('file://')) {
        try {
          if (Platform.OS === 'android' && PermissionsAndroid?.PERMISSIONS?.READ_EXTERNAL_STORAGE) {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          }
        } catch {}
        try { await MediaLibrary.requestPermissionsAsync(false); } catch {}
        try {
          await doCopy();
        } catch (e2) {
          throw new Error('تعذّر فتح هذا الملف — يبدو أنه داخل مجلد تطبيق لا يسمح بقراءته مباشرةً (مثل نسخ واتساب المعدّلة «OBWhatsApp»). احفظ الملف في هاتفك أولًا ثم شاركه من «الملفات» أو المعرض، أو استخدم واتساب الرسمي.');
        }
      } else {
        const src = await FileSystem.getInfoAsync(f.uri, { size: true }).catch(() => null);
        if (src?.exists && src.size) return { uri: f.uri, size: src.size, mimeType: f.mimeType };
        throw new Error('تعذّر قراءة الملف المُشارَك من هذا التطبيق. جرّب المشاركة من «الملفات» أو «المعرض».');
      }
    }
    const info = await FileSystem.getInfoAsync(dest, { size: true }).catch(() => null);
    if (!info?.exists || !info.size) throw new Error('الملف المُشارَك فارغ أو تعذّرت قراءته. جرّب المشاركة من «الملفات».');
    return { uri: dest, size: info.size, mimeType: f.mimeType };
  };

  // Stream the file with real progress. expo-file-system uploads straight from
  // disk (no huge in-memory copy → no OOM on large video) and is far more
  // reliable than RN's fetch(FormData) for shared files.
  // Preferred: PUT directly to storage with a presigned URL (the server never
  // holds the file). If that isn't available, fall back to the multipart route.
  const onProgress = (p) => { if (p.totalBytesExpectedToSend > 0) setPct(Math.min(100, Math.round((p.totalBytesSent / p.totalBytesExpectedToSend) * 100))); };
  const uploadDirect = async (localUri, name, size, mimeType) => {
    let pre;
    try {
      const r = await fetch(`${API_HOST}/api/mobile/upload/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${auth.token}`, 'X-Almaseed-App': 'android' },
        body: JSON.stringify({ name, size, type: mimeType || '' }),
      });
      pre = { status: r.status, data: await r.json().catch(() => ({})) };
    } catch { return null; }
    if (pre.status === 400 || pre.status === 401 || pre.status === 403) throw new Error(pre.data.error || `خطأ ${pre.status}`);
    if (pre.status !== 200 || !pre.data.uploadUrl) return null;
    try {
      const task = FileSystem.createUploadTask(pre.data.uploadUrl, localUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': pre.data.contentType },
      }, onProgress);
      const res = await task.uploadAsync();
      if (!res || res.status < 200 || res.status >= 300) return null;
    } catch { return null; }
    const { url, fileKind, fileType, fileSize } = pre.data;
    return { url, fileKind, fileType, fileSize };
  };
  const uploadShared = async (localUri, mimeType, size) => {
    const base = localUri.split('/').pop() || 'upload';
    const name = localUri.startsWith('file://') ? base : (file?.name || base);
    if (size) {
      const direct = await uploadDirect(localUri, name, size, mimeType);
      if (direct) return direct;
      setPct(0);
    }
    const task = FileSystem.createUploadTask(
      `${API_HOST}/api/mobile/upload`,
      localUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mimeType || 'application/octet-stream',
        headers: { Authorization: `Bearer ${auth.token}`, 'X-Almaseed-App': 'android', Accept: 'application/json' },
      },
      onProgress,
    );
    const res = await task.uploadAsync();
    if (!res || res.status < 200 || res.status >= 300) {
      let msg = `تعذّر رفع الملف${res?.status ? ` (${res.status})` : ''} — تحقّق من الاتصال وحاول مجددًا.`;
      try { const d = JSON.parse(res.body); if (d.error) msg = d.error; } catch {}
      throw new Error(msg);
    }
    return JSON.parse(res.body);
  };

  useEffect(() => { getAuth().then((a) => setAuthState(a || null)).catch(() => setAuthState(null)); }, []);
  useEffect(() => { api.fields().then(setSchema).catch((e) => setErr(String(e.message || e))); }, []);
  useEffect(() => {
    if (!schema || slug) return;
    const cats = schema.categories || [];
    const match = cats.find((c) => { const k = schema.forms?.[c.slug]?.kinds; return !k || k.includes(fileKind); });
    setSlug((match || cats[0])?.slug || '');
  }, [schema]); // eslint-disable-line react-hooks/exhaustive-deps

  const form = schema?.forms?.[slug] || null;
  const setVal = (k, v) => setVals((o) => ({ ...o, [k]: v }));

  const submit = async () => {
    if (!auth?.token) return;
    setErr('');
    if (!title.trim()) { setErr(`الحقل «${form?.titleLabel || 'العنوان'}» مطلوب`); return; }
    for (const fld of (form?.fields || [])) {
      if (fld.required && !((vals[fld.name] || '').trim())) { setErr(`الحقل «${fld.label}» مطلوب`); return; }
    }
    if (form?.kinds && !form.kinds.includes(fileKind)) { setErr('نوع الملف لا يناسب هذا القسم — اختر قسماً مناسباً.'); return; }
    if (!rights || !consent) { setErr('يجب الإقرار بحق المشاركة والموافقة على المراجعة قبل الإرسال.'); return; }
    try {
      setBusy('upload');
      setPct(0);
      const prepared = await toUploadable(file);
      const up = await uploadShared(prepared.uri, file?.mimeType, prepared.size);
      setBusy('submit');
      const clean = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, (v || '').trim()]));
      await api.submit(auth.token, {
        categorySlug: slug, title: title.trim(), ...clean,
        fileUrl: up.url, fileKind: up.fileKind, fileType: up.fileType, fileSize: String(up.fileSize),
        rightsConfirmed: 'true', reviewConsent: 'true',
      });
      setBusy('');
      Alert.alert('تم الإرسال', 'أُرسلت المادة للمراجعة. جزاك الله خيراً على مساهمتك.', [{ text: 'حسناً', onPress: onDone }]);
    } catch (e) {
      setBusy('');
      setPct(0);
      setErr(String(e.message || e));
    }
  };

  return <View style={{ flex: 1 }}>
    <Header title="إرسال مادة مُشارَكة" onBack={onBack} />
    {auth === undefined || (!schema && !err) ? <Loader /> :
     !auth ? <View style={styles.center}><Text style={styles.empty}>يجب تسجيل الدخول لإرسال مادة.</Text><TouchableOpacity style={[styles.authBtn, { paddingHorizontal: 26, marginTop: 14 }]} onPress={() => push('account')} activeOpacity={0.85}><Text style={styles.authBtnTxt}>تسجيل الدخول</Text></TouchableOpacity></View> :
     <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
       <View style={styles.shareFileCard}>
         <View style={styles.shareThumb}><KindIcon kind={fileKind} size={26} /></View>
         <View style={{ flex: 1 }}>
           <Text style={styles.feedTitle} numberOfLines={1}>{file?.name || 'ملف'}</Text>
           <Text style={styles.feedPerson}>{KIND_LABEL[fileKind] || 'ملف'}{file?.size ? `  ·  ${(file.size / 1048576).toFixed(1)} م.ب` : ''}</Text>
           <Text style={styles.shareOk}>✓ تم استلام الملف من المشاركة</Text>
         </View>
       </View>

       <Text style={styles.shareLabel}>القسم <Text style={{ color: C.danger }}>*</Text></Text>
       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
         {(schema?.categories || []).map((c) => <TouchableOpacity key={c.slug} onPress={() => setSlug(c.slug)} style={[styles.chip, slug === c.slug && styles.chipActive]} activeOpacity={0.85}><Text style={[styles.chipTxt, slug === c.slug && styles.chipTxtActive]}>{c.name}</Text></TouchableOpacity>)}
       </ScrollView>

       <Text style={styles.shareLabel}>{form?.titleLabel || 'العنوان'} <Text style={{ color: C.danger }}>*</Text></Text>
       <TextInput value={title} onChangeText={setTitle} style={styles.authInput} placeholder={form?.titleLabel || ''} placeholderTextColor="#9aa4a0" />

       {(form?.fields || []).map((fld) => <View key={fld.name}>
         <Text style={styles.shareLabel}>{fld.label}{fld.required ? <Text style={{ color: C.danger }}> *</Text> : <Text style={styles.shareOpt}> (اختياري)</Text>}</Text>
         {fld.type === 'select'
           ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>{(fld.options || []).map((o) => <TouchableOpacity key={o.value} onPress={() => setVal(fld.name, o.value)} style={[styles.chip, vals[fld.name] === o.value && styles.chipActive]} activeOpacity={0.85}><Text style={[styles.chipTxt, vals[fld.name] === o.value && styles.chipTxtActive]}>{o.label}</Text></TouchableOpacity>)}</ScrollView>
           : (schema?.suggestions?.[fld.name]?.length && fld.type !== 'textarea' && fld.type !== 'date')
             ? <NameField value={vals[fld.name] || ''} onChange={(t) => setVal(fld.name, t)} list={schema.suggestions[fld.name]} style={styles.authInput} placeholder={fld.hint || 'اكتب أو اختر من الموجود'} />
           : <TextInput value={vals[fld.name] || ''} onChangeText={(t) => setVal(fld.name, t)} style={[styles.authInput, fld.type === 'textarea' && { minHeight: 84, textAlignVertical: 'top' }]} multiline={fld.type === 'textarea'} placeholder={fld.hint || (fld.type === 'date' ? 'سنة-شهر-يوم' : '')} placeholderTextColor="#9aa4a0" />}
         {!!fld.hint && fld.type !== 'select' && <Text style={styles.shareHint}>{fld.hint}</Text>}
       </View>)}

       <TouchableOpacity style={styles.consentRow} onPress={() => setRights((v) => !v)} activeOpacity={0.8}>
         <View style={[styles.checkbox, rights && styles.checkboxOn]}>{rights && <Text style={styles.checkboxTick}>✓</Text>}</View>
         <Text style={styles.consentTxt}>أقر بأن لدي الحق في مشاركة هذه المادة، وأن مشاركتها لا تخالف حقوق الآخرين.</Text>
       </TouchableOpacity>
       <TouchableOpacity style={styles.consentRow} onPress={() => setConsent((v) => !v)} activeOpacity={0.8}>
         <View style={[styles.checkbox, consent && styles.checkboxOn]}>{consent && <Text style={styles.checkboxTick}>✓</Text>}</View>
         <Text style={styles.consentTxt}>أوافق على مراجعة المادة من فريق الإشراف قبل نشرها.</Text>
       </TouchableOpacity>

       {!!err && <Text style={styles.shareErr}>{err}</Text>}
       <TouchableOpacity style={[styles.authBtn, { marginTop: 18, opacity: busy ? 0.6 : 1 }]} onPress={submit} disabled={!!busy} activeOpacity={0.85}>
         <Text style={styles.authBtnTxt}>{busy === 'upload' ? (pct >= 100 ? 'اكتمل الرفع، جارٍ الحفظ…' : pct > 0 ? `جارٍ رفع الملف… ${pct}٪` : 'جارٍ تجهيز الملف…') : busy === 'submit' ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}</Text>
       </TouchableOpacity>
       <TouchableOpacity onPress={onBack} style={{ padding: 12, marginTop: 2 }} activeOpacity={0.7}><Text style={{ color: C.muted, textAlign: 'center', fontWeight: '700' }}>إلغاء</Text></TouchableOpacity>
     </ScrollView>}
  </View>;
}
function WebScreen({ url, title, onBack }) {
  // «رجوع» should walk BACK through the web history first (so after finishing a
  // review the admin returns to the review list to review more), and only close
  // the whole WebView once there's nowhere left to go back to inside it.
  const webRef = useRef(null);
  const canGoBack = useRef(false);
  const handleBack = useCallback(() => {
    if (canGoBack.current && webRef.current) { try { webRef.current.goBack(); return; } catch {} }
    onBack();
  }, [onBack]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current && webRef.current) { try { webRef.current.goBack(); return true; } catch {} }
      return false; // let the app stack handle it (pop the WebView)
    });
    return () => sub.remove();
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Header title={title} onBack={handleBack} />
      <WebView
        ref={webRef}
        source={{ uri: url }}
        onNavigationStateChange={(s) => { canGoBack.current = s.canGoBack; }}
        startInLoadingState
        renderLoading={() => <Loader />}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsProtectedMedia
        scalesPageToFit
        useWideViewPort
        injectedJavaScriptBeforeContentLoaded={FIT_VIEWPORT}
        injectedJavaScript={FIT_VIEWPORT}
      />
    </View>
  );
}
// Google sign-in via the website: the web handles Google OAuth (no native SDK,
// no app-signing SHA-1), then redirects to /mobile-login/done?token=… which we
// intercept here to capture the session and hand it to the app.
function GoogleLoginScreen({ onBack }) {
  const handled = useRef(false);
  const [busy, setBusy] = useState(false);
  const finish = useCallback(async (url) => {
    if (handled.current) return;
    handled.current = true;
    const token = decodeURIComponent((url.match(/[?&]token=([^&#]+)/) || [])[1] || '');
    const error = decodeURIComponent((url.match(/[?&]error=([^&#]+)/) || [])[1] || '');
    try {
      if (error || !token) {
        Alert.alert('تعذّر الدخول عبر Google', error === 'notconfigured' ? 'خدمة Google غير مُفعّلة بعد على الخادم.' : 'حاول مرة أخرى.');
        return;
      }
      setBusy(true);
      const { user } = await api.me(token);
      await setAuth({ token, user });
      reregisterPush();
      Alert.alert('تم الدخول', user?.isStaff ? 'ستصلك إشعارات المواد التي تنتظر المراجعة.' : 'تم تسجيل دخولك عبر Google.');
    } catch (e) {
      Alert.alert('تعذّر الدخول', String(e.message || e));
    } finally {
      setBusy(false);
      onBack();
    }
  }, [onBack]);
  return <View style={{ flex: 1 }}><Header title="الدخول عبر Google" onBack={onBack} />
    <WebView
      source={{ uri: `${API_BASE}/mobile-login/google` }}
      incognito
      startInLoadingState
      renderLoading={() => <Loader />}
      onShouldStartLoadWithRequest={(r) => { if (r.url.includes('/mobile-login/done')) { finish(r.url); return false; } return true; }}
      onNavigationStateChange={(s) => { if (s.url && s.url.includes('/mobile-login/done')) finish(s.url); }}
    />
    {busy && <View style={styles.center}><Loader /></View>}
  </View>;
}
// In-app document viewer. Android's WebView can't render PDFs on its own, so we
// load them through Google's hosted viewer (handles PDF/DOC/DOCX/PPT). A manual
// "open externally" fallback is always available if the embed fails.
function PdfScreen({ url, title, onBack }) {
  const [failed, setFailed] = useState(false);
  const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  return <View style={{ flex: 1 }}><Header title={title || 'المستند'} onBack={onBack} />{failed ? <View style={styles.center}><Text style={{ color: C.muted, textAlign: 'center', marginBottom: 14 }}>تعذّر عرض المستند داخل التطبيق.</Text><TouchableOpacity style={styles.docOpenBtn} onPress={() => Linking.openURL(url).catch(() => {})}><Text style={styles.docOpenTxt}>فتح بتطبيق خارجي</Text></TouchableOpacity></View> : <WebView source={{ uri: viewer }} startInLoadingState renderLoading={() => <Loader />} onError={() => setFailed(true)} onHttpError={() => setFailed(true)} originWhitelist={['*']} javaScriptEnabled domStorageEnabled />}<View style={styles.pdfFooter}><TouchableOpacity onPress={() => Linking.openURL(url).catch(() => {})}><Text style={styles.pdfFooterTxt}>فتح بتطبيق خارجي ↗</Text></TouchableOpacity></View></View>;
}

// Written materials are stored as HTML (bold, headings, alignment, font sizes).
// Render them faithfully in a WebView instead of dumping raw tags as text.
function ArticleHtml({ html }) {
  const [height, setHeight] = useState(160);
  const looksHtml = /<[a-z!/][\s\S]*>/i.test(html || '');
  const body = looksHtml ? html : `<div style="white-space:pre-wrap">${(html || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  // Match the website exactly: body text in Cairo, calligraphic headings in
  // Aref Ruqaa (the same two Google fonts the site loads).
  const doc = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet"><style>html,body{margin:0;padding:0}body{padding:16px;font-family:'Cairo','Tajawal',-apple-system,Roboto,'Segoe UI',sans-serif;font-size:17.2px;line-height:2.2;color:#20302a;background:#faf7f0;direction:rtl;text-align:right;word-wrap:break-word}h1,h2{font-family:'Aref Ruqaa','Amiri','Cairo',serif;font-weight:700;color:#1f3d33;line-height:1.6}h1{font-size:1.9em;margin:.6em 0 .4em}h2{font-size:1.5em;margin:.6em 0 .4em}strong{font-weight:700;color:#173029}img{display:block;max-width:100%;height:auto;max-height:70vh;margin:14px auto;border-radius:12px}*{max-width:100%}</style></head><body>${body}<script>function P(){try{window.ReactNativeWebView.postMessage(String(document.body.scrollHeight))}catch(e){}}window.addEventListener('load',P);setTimeout(P,250);setTimeout(P,800);setTimeout(P,1600);document.fonts&&document.fonts.ready.then(P);</script></body></html>`;
  return <View style={styles.articleWrap}><WebView originWhitelist={['*']} source={{ html: doc }} style={{ width: '100%', height }} scrollEnabled={false} showsVerticalScrollIndicator={false} onMessage={(e) => { const h = Number(e.nativeEvent.data); if (h && Math.abs(h - height) > 4) setHeight(h); }} /></View>;
}
function MaterialScreen({ id, push, onBack, onPlay, onStop, nowId }) {
  const [m, setM] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.material(id).then(setM).catch((e) => setErr(e.message)); }, [id]);
  const playingHere = m && nowId === m.id;
  const isBook = m?.category?.slug === 'readings';
  const person = isBook ? m.author : (m?.performer || m?.speaker || m?.host);
  return <View style={{ flex: 1 }}><Header title="تفاصيل المادة" onBack={onBack} />{err ? <ErrorBox msg={err} /> : !m ? <Loader /> : <ScrollView contentContainerStyle={{ padding: 16 }}><View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.detailTitle}>{m.title}</Text></View></View>{!!m.subtitle && <View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.detailSub}>{m.subtitle}</Text></View></View>}{!!person && <View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.detailPerson}>{isBook ? `الكاتب: ${person}` : person}</Text></View></View>}{!!m.contributor && <View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={[styles.detailPerson, { fontSize: 13 }]}>شاركها: {m.contributor}</Text></View></View>}{m.fileKind === 'IMAGE' && m.fileUrl ? <Image source={{ uri: m.fileUrl }} style={styles.image} resizeMode="contain" /> : m.fileKind === 'VIDEO' && m.fileUrl ? <InlineVideo url={m.fileUrl} poster={m.coverImage} /> : m.fileKind === 'DOCUMENT' && m.fileUrl ? <View style={styles.documentCard}><Text style={styles.documentIcon}>📄</Text><Text style={styles.documentTitle}>{m.fileType ? `مستند ${m.fileType}` : 'مستند'}</Text><Text style={styles.documentHint}>اعرض الكتاب أو ملف PDF داخل التطبيق، أو افتحه بتطبيق خارجي.</Text><View style={styles.docBtns}><TouchableOpacity style={styles.docViewBtn} onPress={() => push && push('pdf', { url: m.fileUrl, title: m.title })} activeOpacity={0.88}><Text style={styles.docViewTxt}>عرض داخل التطبيق</Text></TouchableOpacity><TouchableOpacity style={styles.docOpenBtn} onPress={() => Linking.openURL(m.fileUrl).catch(() => Alert.alert('تعذّر فتح المستند', 'لم يتمكن الجهاز من فتح هذا الملف.'))} activeOpacity={0.88}><Text style={styles.docOpenTxt}>فتح خارجياً</Text></TouchableOpacity></View></View> : m.fileKind === 'AUDIO' && m.fileUrl ? (playingHere ? <FullAudioPlayer title={m.title} person={person} poster={m.coverImage} onStop={onStop} /> : <TouchableOpacity style={styles.playCard} onPress={() => onPlay(m)} activeOpacity={0.9}>{m.coverImage ? <Image source={{ uri: m.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}<View style={styles.playCardOverlay}><View style={styles.playCircle}><Text style={styles.playCircleIcon}>▶</Text></View><Text style={styles.playCardLabel}>استماع</Text><Text style={styles.playCardHint}>يستمر التشغيل أثناء تصفّح باقي الصفحات</Text></View></TouchableOpacity>) : null}{!!m.bodyText && <ArticleHtml html={m.bodyText} />}{!!m.description && <View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.desc}>{m.description}</Text></View></View>}<Downloads material={m} /></ScrollView>}</View>;
}
// Video playback via expo-video (expo-av was removed in SDK 54). Inline with
// native controls plus a fullscreen button.
function InlineVideo({ url }) {
  const ref = useRef(null);
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  const fullscreen = async () => { try { await ref.current?.enterFullscreen(); } catch {} };
  return <View style={styles.videoWrap}><VideoView ref={ref} player={player} style={styles.videoInline} contentFit="contain" nativeControls allowsFullscreen /><View style={styles.videoBtns}><TouchableOpacity style={[styles.fsBtn, styles.fsBtnAlt]} onPress={fullscreen} activeOpacity={0.85}><Text style={styles.fsIcon}>⛶</Text><Text style={styles.fsTxt}>ملء الشاشة</Text></TouchableOpacity></View></View>;
}
function MiniPlayer(props) { return <MiniAudio {...props} />; }
function MiniShell({ children, onClose, onOpen, item, pct, leading, bottomInset = 0 }) { return <View style={[styles.mini, { paddingBottom: bottomInset }]}><View style={styles.miniProgress}><View style={[styles.miniProgressFill, { width: `${pct}%` }]} /></View><View style={styles.miniRow}>{leading}<TouchableOpacity style={{ flex: 1 }} onPress={onOpen} activeOpacity={0.8}><Text style={styles.miniTitle} numberOfLines={1}>{item.title}</Text>{!!item.person && <Text style={styles.miniPerson} numberOfLines={1}>{item.person}</Text>}</TouchableOpacity>{children}<TouchableOpacity onPress={onClose} style={styles.miniClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.miniCloseIcon}>✕</Text></TouchableOpacity></View></View>; }
const AUDIO_BUSY = (s) => s === State.Buffering || s === State.Loading || s === State.Connecting || s === State.None || s == null;
function MiniAudio({ item, onClose, onOpen, bottomInset }) { const playback = usePlaybackState(); const { position, duration } = useProgress(500); const state = playback?.state; const isPlaying = state === State.Playing; const toggle = () => { isPlaying ? TrackPlayer.pause() : TrackPlayer.play(); }; const pct = duration ? Math.min(100, Math.round((position / duration) * 100)) : 0; return <MiniShell item={item} onClose={onClose} onOpen={onOpen} bottomInset={bottomInset} pct={pct} leading={<TouchableOpacity onPress={onOpen} activeOpacity={0.9} style={styles.miniThumb}>{item.poster ? <Image source={{ uri: item.poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Image source={require('./assets/emblem.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />}</TouchableOpacity>}><TouchableOpacity onPress={toggle} style={styles.miniBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>{AUDIO_BUSY(state) ? <ActivityIndicator color={C.brand} /> : <Text style={styles.miniBtnIcon}>{isPlaying ? '❚❚' : '▶'}</Text>}</TouchableOpacity></MiniShell>; }
const fmtTime = (sec) => { const s = Math.max(0, Math.floor(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

// Seek bar: capture the gesture before the surrounding ScrollView can claim it.
// Use the touch coordinate relative to the seek view for both tap and drag.
function SeekBar({ position, duration, onSeek }) {
  const wRef = useRef(1);
  const [drag, setDrag] = useState(null);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const fractionFromEvent = (e) => clamp((e.nativeEvent.locationX || 0) / wRef.current);
  const begin = (e) => setDrag(fractionFromEvent(e));
  const move = (e) => setDrag(fractionFromEvent(e));
  const finish = (e) => { const f = fractionFromEvent(e); setDrag(null); onSeek(f); };
  const frac = drag != null ? drag : duration ? Math.max(0, Math.min(1, position / duration)) : 0;
  return <View style={styles.seekWrap}>
    <View
      style={styles.seekHit}
      onLayout={(e) => { wRef.current = e.nativeEvent.layout.width || 1; }}
      onStartShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponder={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={begin}
      onResponderMove={move}
      onResponderRelease={finish}
      onResponderTerminate={() => setDrag(null)}
    >
      <View style={styles.seekTrack}><View style={[styles.seekFill, { width: `${frac * 100}%` }]} /><View style={[styles.seekThumb, { left: `${frac * 100}%` }]} /></View>
    </View>
    <View style={styles.seekTimes}><Text style={styles.seekTime}>{fmtTime(drag != null ? drag * duration : position)}</Text><Text style={styles.seekTime}>{fmtTime(duration)}</Text></View>
  </View>;
}
function FullAudioPlayer({ title, person, poster, onStop }) {
  const playback = usePlaybackState(); const { position, duration } = useProgress(400); const [speedIdx, setSpeedIdx] = useState(0); const state = playback?.state; const isPlaying = state === State.Playing;
  const toggle = () => { isPlaying ? TrackPlayer.pause() : TrackPlayer.play(); }; const seekTo = (f) => TrackPlayer.seekTo(f * (duration || 0)); const jump = (d) => TrackPlayer.seekTo(Math.max(0, Math.min(duration || 0, (position || 0) + d))); const cycleSpeed = () => { const next = (speedIdx + 1) % SPEEDS.length; setSpeedIdx(next); TrackPlayer.setRate(SPEEDS[next]); };
  return <View style={styles.full}><View style={styles.fullArt}>{poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Image source={require('./assets/emblem.png')} style={{ width: '72%', height: '72%' }} resizeMode="contain" />}</View><Text style={styles.fullTitle} numberOfLines={1}>{title}</Text>{!!person && <Text style={styles.fullPerson} numberOfLines={1}>{person}</Text>}<SeekBar position={position} duration={duration} onSeek={seekTo} /><View style={styles.fullControls}><TouchableOpacity onPress={cycleSpeed} style={styles.fullSpeed}><Text style={styles.fullSpeedTxt}>{SPEEDS[speedIdx]}×</Text></TouchableOpacity><TouchableOpacity onPress={() => jump(-15)} style={styles.fullSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={styles.fullSkipTxt}>«15</Text></TouchableOpacity><TouchableOpacity onPress={toggle} style={styles.fullPlay}>{AUDIO_BUSY(state) ? <ActivityIndicator color={C.brand} /> : <Text style={styles.fullPlayIcon}>{isPlaying ? '❚❚' : '▶'}</Text>}</TouchableOpacity><TouchableOpacity onPress={() => jump(15)} style={styles.fullSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={styles.fullSkipTxt}>15»</Text></TouchableOpacity><TouchableOpacity onPress={onStop} style={styles.fullSpeed}><Text style={styles.fullStopTxt}>إيقاف</Text></TouchableOpacity></View><Text style={styles.playCardHint}>يستمر التشغيل في شريط الإشعارات وأثناء تصفّح باقي الصفحات</Text></View>;
}
// Offline audio playback via expo-audio (expo-av removed in SDK 54).
function AudioPlayer({ url, title }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const loading = !status?.isLoaded;
  const playing = !!status?.playing;
  const toggle = () => { try { playing ? player.pause() : player.play(); } catch (e) { Alert.alert('تعذّر التشغيل', String(e.message || e)); } };
  const posSec = status?.currentTime || 0; const durSec = status?.duration || 0;
  const pct = durSec ? Math.round((posSec / durSec) * 100) : 0;
  const fmt = (sec) => { const s = Math.floor(sec || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  return <View style={styles.player}><TouchableOpacity style={styles.playBtn} onPress={toggle}>{loading ? <ActivityIndicator color={C.brand} /> : <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>}</TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.playTitle} numberOfLines={1}>{title}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View><View style={styles.timeRow}><Text style={styles.time}>{fmt(posSec)}</Text><Text style={styles.time}>{fmt(durSec)}</Text></View></View></View>; }
// Load the السجادة emblem once as a base64 data URI so it can be embedded in the
// article PDF (works offline, no network fetch).
let _emblemUri = null;
async function getEmblemDataUri() {
  // Use the emblem bundled directly as a data URI — reliable in release builds
  // where runtime asset reads can fail (so the PDF seal always renders).
  if (EMBLEM_DATA_URI) return EMBLEM_DATA_URI;
  if (_emblemUri) return _emblemUri;
  try {
    const asset = Asset.fromModule(require('./assets/emblem.png'));
    await asset.downloadAsync();
    const b64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    _emblemUri = `data:image/png;base64,${b64}`;
  } catch { _emblemUri = ''; }
  return _emblemUri;
}

// Build a print-ready HTML for an article, matching the in-app article styling,
// with a السجادة header and a stamped footer repeated on every page.
function buildArticlePdfHtml(material, stamp, person) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const raw = material.bodyText || material.description || '';
  const looksHtml = /<[a-z!/][\s\S]*>/i.test(raw);
  // Plain text: split into stanzas on blank lines and wrap each as a block that
  // is never broken across pages, so a couplet is never cut in the middle.
  const stanzas = (t) => t.replace(/\r\n/g, '\n').split(/\n{2,}/)
    .map((s) => s.trim()).filter(Boolean)
    .map((s) => `<p class="stanza">${esc(s).replace(/\n/g, '<br>')}</p>`).join('');
  const body = looksHtml ? raw : stanzas(raw);
  const meta = [material.subtitle ? esc(material.subtitle) : '', person ? `الكاتب: ${esc(person)}` : '', material.contributor ? `شاركها: ${esc(material.contributor)}` : '']
    .filter(Boolean).join(' · ');
  const img = stamp ? `<img src="${stamp}" alt="">` : '';
  const source = `almaseeed.com/material/${material.id}`;
  const today = new Date().toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
  const catName = material.category?.name || 'مكتبة المسيد';
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{margin:20px}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Amiri','Scheherazade New','Noto Naskh Arabic','Cairo',serif;font-size:16px;line-height:2.05;color:#20302a;direction:rtl;text-align:justify;word-wrap:break-word}

/* The gold frame is a border on the CONTENT itself (not a fixed overlay) with
   box-decoration-break:clone, so on every page the border wraps that page's
   content with inner padding — the text never touches or crosses the frame. */
.wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;opacity:.045;z-index:0}
.wm img{width:100%;height:100%;object-fit:contain}
.content{position:relative;z-index:1;border:2px solid #cd9b44;border-radius:8px;padding:30px 40px;box-shadow:inset 0 0 0 4px #fff,inset 0 0 0 4.7px #d9c08a;-webkit-box-decoration-break:clone;box-decoration-break:clone}

/* First-page masthead */
.masthead{text-align:center;padding:6px 0 14px;margin-bottom:18px;border-bottom:2px solid #cd9b44;position:relative}
.masthead::after{content:"";display:block;height:1px;background:#d9c08a;margin-top:4px}
.masthead .seal{width:76px;height:76px;margin:0 auto 8px}
.masthead .name{font-family:'Aref Ruqaa','Amiri',serif;font-weight:700;color:#1f3d33;font-size:24px;line-height:1.4}
.masthead .sub{color:#8f612b;font-size:13px;margin-top:3px;letter-spacing:.5px}
.masthead .kicker{display:inline-block;margin-top:10px;color:#6b6b6b;font-size:12px;font-family:'Cairo',sans-serif}

.art-body img,.content img{display:block;max-width:100%;height:auto;max-height:420px;margin:14px auto;border-radius:8px;page-break-inside:avoid}
.art-title{font-family:'Aref Ruqaa','Amiri',serif;color:#1f3d33;font-size:26px;font-weight:700;margin:10px 0 4px;text-align:center;line-height:1.5}
.art-meta{color:#6b6b6b;font-size:12.5px;margin:0 auto 18px;text-align:center;font-family:'Cairo',sans-serif}
.divider{width:120px;height:0;border-top:1.5px solid #cd9b44;margin:0 auto 20px;position:relative}
.divider::after{content:"﴾﴿";position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;color:#cd9b44;font-size:16px}

.body-text{padding:0 4px}
.body-text p{margin:0 0 12px}
/* Keep a stanza/couplet together — never split across a page break. */
.stanza{margin:0 0 14px;break-inside:avoid;page-break-inside:avoid}
.body-text p,h1,h2,h3{break-inside:avoid;page-break-inside:avoid}
.body-text{orphans:2;widows:2}
h1,h2,h3{font-family:'Aref Ruqaa','Amiri',serif;font-weight:700;color:#1f3d33;line-height:1.6;text-align:right}
h1{font-size:1.6em}h2{font-size:1.35em}h3{font-size:1.15em}
strong{font-weight:700;color:#173029}
img{max-width:100%;height:auto}
.masthead .seal img,.stampblock .seal img,.ftr .brand img{width:100%;height:100%;object-fit:contain}

/* Closing stamp block at the end of the article */
.stampblock{margin-top:26px;padding-top:14px;border-top:1px dashed #d9c08a;text-align:center;page-break-inside:avoid}
.stampblock .seal{width:70px;height:70px;margin:0 auto 6px;opacity:.95}
.stampblock .cap{color:#8f612b;font-size:12px;font-family:'Cairo',sans-serif}
.stampblock .date{color:#9a9a9a;font-size:11px;margin-top:2px;font-family:'Cairo',sans-serif}

/* Slim footer repeated on every page */
.ftr{position:fixed;bottom:22px;left:26px;right:26px;height:34px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:7px;border-top:1px solid #e6ddc7;background:#fff;color:#8f612b;font-size:10.5px;font-family:'Cairo',sans-serif;z-index:2}
.ftr .brand{display:flex;align-items:center;gap:7px}
.ftr .brand img{width:26px;height:26px;opacity:.9}
.ftr .src{color:#6b6b6b;direction:ltr}
</style></head><body>
<div class="wm">${img}</div>
<div class="content">
  <div class="masthead">
    <div class="seal">${img}</div>
    <div class="name">الطريقة السمّانية — السجادة السليمانية</div>
    <div class="sub">أرشيف المسيد</div>
    <div class="kicker">${esc(catName)}${today ? ` · ${esc(today)}` : ''}</div>
  </div>
  <div class="art-title">${esc(material.title)}</div>
  ${meta ? `<div class="art-meta">${meta}</div>` : ''}
  <div class="divider"></div>
  <div class="body-text">${body}</div>
  <div class="stampblock">
    <div class="seal">${img}</div>
    <div class="cap">خُتم بخاتم أرشيف المسيد — وثيقة موثّقة</div>
    <div class="date">${esc(source)}</div>
  </div>
</div>
</body></html>`;
}

function Downloads({ material }) { const [busy, setBusy] = useState(''); const [pct, setPct] = useState(0);
  // Derive a real extension. Prefer the one on the actual file URL (uploads are
  // saved as <hash>.<ext>), then fileType, then a sane per-kind default. A wrong
  // or missing extension is exactly what makes the gallery reject a video with
  // «can't create asset», so we never let it fall through to «.dat».
  const cleanExt = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const KIND_DEFAULT_EXT = { VIDEO: 'mp4', AUDIO: 'mp3', IMAGE: 'jpg', DOCUMENT: 'pdf' };
  const urlExt = cleanExt((material.fileUrl || '').split('?')[0].split('.').pop());
  const typeExt = cleanExt(material.fileType);
  const ext = (urlExt && urlExt.length <= 4 ? urlExt : (typeExt && typeExt.length <= 4 ? typeExt : (KIND_DEFAULT_EXT[material.fileKind] || (material.bodyText ? 'txt' : 'dat'))));
  const safe = material.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'material'; const displayBase = `${safe} - أرشيف المسيد`; const filename = `${material.id}.${ext}`; const MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', '3gpp': 'video/3gpp', avi: 'video/x-msvideo', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', amr: 'audio/amr', weba: 'audio/webm' }; async function ensureLocal(onProgress) { const dest = FileSystem.documentDirectory + filename; const info = await FileSystem.getInfoAsync(dest, { size: true }); if (info.exists && info.size > 0) return dest; if (material.fileUrl) { /* Download to a .part file and only move it into place once complete and HTTP-OK — an interrupted download (app closed, network drop) used to leave a truncated file that was then treated as complete forever, and an error page could be saved as the media. */ const part = dest + '.part'; await FileSystem.deleteAsync(part, { idempotent: true }); const task = FileSystem.createDownloadResumable(material.fileUrl, part, {}, (p) => { if (onProgress && p.totalBytesExpectedToWrite > 0) onProgress(Math.min(100, Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100))); }); let dl; try { dl = await task.downloadAsync(); } catch (e) { await FileSystem.deleteAsync(part, { idempotent: true }); throw e; } if (!dl || (dl.status && dl.status !== 200 && dl.status !== 206)) { await FileSystem.deleteAsync(part, { idempotent: true }); throw new Error('تعذّر تنزيل الملف من الخادم (' + (dl && dl.status) + ')'); } await FileSystem.deleteAsync(dest, { idempotent: true }); await FileSystem.moveAsync({ from: part, to: dest }); return dest; } await FileSystem.writeAsStringAsync(dest, material.bodyText || material.description || ''); return dest; } const saveInApp = async () => { try { setBusy('app'); setPct(0); const localPath = await ensureLocal(setPct); await addDownload({ id: material.id, title: material.title, subtitle: material.subtitle || null, person: material.category?.slug === 'readings' ? material.author || null : (material.performer || material.speaker || material.host || null), fileKind: material.fileKind || (material.bodyText ? 'ARTICLE' : 'AUDIO'), localPath, bodyText: material.bodyText || null }); Alert.alert('تم الحفظ', 'حُفظت المادة داخل التطبيق، وتظهر في «التنزيلات المحفوظة».'); } catch (e) { Alert.alert('تعذّر الحفظ', String(e.message || e)); } finally { setBusy(''); } }; /* Save a media file (audio/video/image) into the visible «أرشيف المسيد» album by
   STREAMING it natively — never read the whole file into a base64 string, which
   OOMs on large videos. The album shows up in the gallery and the file manager. */
const saveMediaToAlbum = async (uri) => { const asset = await MediaLibrary.createAssetAsync(uri); try { const existing = await MediaLibrary.getAlbumAsync(DL_ALBUM); if (existing) await MediaLibrary.addAssetsToAlbumAsync([asset], existing, false); else await MediaLibrary.createAlbumAsync(DL_ALBUM, asset, false); } catch {} return asset; }; /* Save a document (pdf/doc/txt) to a user-chosen folder via SAF. Prefer a NATIVE
   streaming copy into the created file (no base64 → large PDFs save with no
   out-of-memory). Only if the native copy isn't supported do we fall back to a
   base64 write for smaller files, and finally to the share sheet. */ const saveDoc = async (uri) => { const SAF = FileSystem.StorageAccessFramework; if (Platform.OS === 'android' && SAF) { try { const perm = await SAF.requestDirectoryPermissionsAsync(); if (!perm.granted) return 'cancel'; { const target = await SAF.createFileAsync(perm.directoryUri, displayBase, MIME[ext] || 'application/octet-stream'); /* Native streamed copy: any size, low memory (expo-file-system can't stream into a picked folder). */ if (SafSave) { try { await SafSave.copyToUri(uri, target); return 'saf'; } catch {} } try { await FileSystem.copyAsync({ from: uri, to: target }); return 'saf'; } catch { let size = 0; try { const i = await FileSystem.getInfoAsync(uri, { size: true }); size = i.size || 0; } catch {} if (size > 0 && size < DL_BIG) { const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 }); return 'saf'; } try { await SAF.deleteAsync(target, { idempotent: true }); } catch {} } } } catch {} } if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); return 'share'; } if (material.fileUrl) { Linking.openURL(material.fileUrl); return 'link'; } return false; }; const saveToDevice = async () => { try { setBusy('device'); setPct(0); /* Only images/videos go to the gallery album. Audio can't be added to the gallery on Android (createAssetAsync/saveToLibraryAsync throw for mp3), which used to drop to the share sheet — so audio (and documents) save to a folder via SAF instead. */ const isGalleryMedia = ['VIDEO', 'IMAGE'].includes(material.fileKind); const uri = await ensureLocal(setPct); let saveUri = uri; try { const pretty = FileSystem.cacheDirectory + `${displayBase}.${ext}`; await FileSystem.deleteAsync(pretty, { idempotent: true }); await FileSystem.copyAsync({ from: uri, to: pretty }); saveUri = pretty; } catch {} if (isGalleryMedia) { const perm = await MediaLibrary.requestPermissionsAsync(false); if (!perm.granted) { Alert.alert('الإذن مطلوب', 'فعّل إذن الوسائط من إعدادات التطبيق لحفظ الملف في جهازك.'); return; } /* Save into the gallery natively (streams — handles any size with no OOM). Try the nicely-named copy first, then the original ASCII-named download: some devices reject the Arabic-named cache copy for VIDEO (images tolerate it), which used to drop the download to the share sheet. */ let savedOk = false; for (const src of [saveUri, uri]) { try { await saveMediaToAlbum(src); savedOk = true; break; } catch {} try { await MediaLibrary.saveToLibraryAsync(src); savedOk = true; break; } catch {} } if (savedOk) { Alert.alert('تم التنزيل', `حُفظ الملف في جهازك (يظهر في المعرض/الموسيقى، ومجلد «${DL_ALBUM}»).`); } else { /* Gallery genuinely refused it — save to a folder via SAF (small files), else share. */ const r = await saveDoc(saveUri); if (r === 'saf') Alert.alert('تم التنزيل', 'حُفظ الملف في المجلد الذي اخترته.'); else if (r === 'share') Alert.alert('اختر مكان الحفظ', 'تعذّر الحفظ في المجلد مباشرةً — اختر «الملفات» (Files) من القائمة لحفظه في جهازك.'); else if (!r) Alert.alert('غير متاح', 'تعذّر حفظ هذا الملف على الجهاز.'); } } else { const r = await saveDoc(saveUri); if (r === 'saf') Alert.alert('تم التنزيل', 'حُفظ الملف في المجلد الذي اخترته.'); else if (r === 'share') Alert.alert('اختر مكان الحفظ', 'تعذّر الحفظ في المجلد مباشرةً — اختر «الملفات» (Files) من القائمة لحفظه في جهازك.'); else if (!r) Alert.alert('غير متاح', 'تعذّر حفظ هذا النوع على الجهاز.'); } } catch (e) { Alert.alert('تعذّر التنزيل', String(e.message || e)); } finally { setBusy(''); } }; const savePdf = async () => { try { setBusy('pdf'); const stamp = await getEmblemDataUri(); const person = material.author || material.performer || material.speaker || material.host || null; const html = buildArticlePdfHtml(material, stamp, person); const { uri } = await Print.printToFileAsync({ html }); const pretty = FileSystem.cacheDirectory + `${displayBase}.pdf`; await FileSystem.deleteAsync(pretty, { idempotent: true }); await FileSystem.copyAsync({ from: uri, to: pretty }); const SAF = FileSystem.StorageAccessFramework; if (Platform.OS === 'android' && SAF) { const perm = await SAF.requestDirectoryPermissionsAsync(); if (!perm.granted) return; { const target = await SAF.createFileAsync(perm.directoryUri, displayBase, 'application/pdf'); let copied = false; if (SafSave) { try { await SafSave.copyToUri(pretty, target); copied = true; } catch {} } if (!copied) try { await FileSystem.copyAsync({ from: pretty, to: target }); } catch { const b64 = await FileSystem.readAsStringAsync(pretty, { encoding: FileSystem.EncodingType.Base64 }); await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 }); } Alert.alert('تم التنزيل', 'حُفظ المقال كملف PDF في المجلد الذي اخترته.'); return; } } if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(pretty, { mimeType: 'application/pdf', dialogTitle: material.title }); } else { Alert.alert('غير متاح', 'تعذّر حفظ الملف على هذا الجهاز.'); } } catch (e) { Alert.alert('تعذّر إنشاء PDF', String(e.message || e)); } finally { setBusy(''); } };
 const shareLink = async () => { try { await Share.share({ message: `${material.title}\n${API_BASE}/material/${material.id}` }); } catch {} }; if (!material.fileUrl && !material.bodyText) return null; return <View><FirstUseCue flag="cue-download" label="احفظ داخل التطبيق أو نزّله لجهازك" placement="above"><View style={styles.downloads}><TouchableOpacity style={styles.dlBtn} onPress={saveInApp} disabled={!!busy}><Text style={styles.dlTxt}>{busy === 'app' ? `${pct}%` : 'حفظ داخل التطبيق'}</Text></TouchableOpacity><TouchableOpacity style={[styles.dlBtn, styles.dlBtnAlt]} onPress={saveToDevice} disabled={!!busy}><Text style={[styles.dlTxt, { color: C.brand }]}>{busy === 'device' ? `${pct}%` : 'تنزيل إلى الجهاز'}</Text></TouchableOpacity></View></FirstUseCue>{!material.fileUrl && !!material.bodyText && <TouchableOpacity style={[styles.dlBtn, styles.dlBtnAlt, { marginTop: 8 }]} onPress={savePdf} disabled={!!busy} activeOpacity={0.85}><Text style={[styles.dlTxt, { color: C.brand }]}>{busy === 'pdf' ? 'جارٍ إنشاء PDF…' : 'تنزيل المقال PDF (بالختم)'}</Text></TouchableOpacity>}<TouchableOpacity style={styles.shareBtn} onPress={shareLink} activeOpacity={0.85}><Ionicons name="share-social" size={18} color={C.brand} /><Text style={styles.shareTxt}>مشاركة الرابط</Text></TouchableOpacity></View>; }
function Library({ push, onBack }) { const [items, setItems] = useState(null); const reload = useCallback(() => { getDownloads().then(setItems); }, []); useEffect(reload, [reload]); const del = (id) => Alert.alert('حذف', 'حذف هذه المادة من التنزيلات؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => setItems(await removeDownload(id)) }]); return <View style={{ flex: 1 }}><Header title="التنزيلات المحفوظة" onBack={onBack} />{!items ? <Loader /> : items.length === 0 ? <View style={styles.center}><Text style={styles.empty}>لا توجد تنزيلات محفوظة بعد.</Text><Text style={{ color: C.muted, textAlign: 'center', marginTop: 6 }}>احفظ أي مادة عبر «حفظ داخل التطبيق» لتظهر هنا وتُشغَّل دون اتصال.</Text></View> : <ScrollView contentContainerStyle={{ padding: 12 }}>{items.map((it) => <View key={it.id} style={styles.feedCard}><TouchableOpacity style={[styles.thumb, { width: 64, height: 64 }]} onPress={() => push('offline', { item: it })}><KindIcon kind={it.fileKind} size={26} /></TouchableOpacity><TouchableOpacity style={{ flex: 1 }} onPress={() => push('offline', { item: it })}><Text style={styles.feedTitle} numberOfLines={2}>{it.title}</Text><Text style={styles.feedPerson} numberOfLines={1}>{(it.person || '') + '  ·  ' + (KIND_LABEL[it.fileKind] || 'مقال')}</Text></TouchableOpacity><TouchableOpacity onPress={() => del(it.id)} style={{ padding: 6 }}><Text style={{ color: C.danger, fontSize: 18 }}>✕</Text></TouchableOpacity></View>)}</ScrollView>}</View>; }
function OfflineVideo({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls allowsFullscreen />;
}
function OfflineScreen({ item, onBack }) { const isImage = item.fileKind === 'IMAGE'; const isVideo = item.fileKind === 'VIDEO'; return <View style={{ flex: 1 }}><Header title="مادة محفوظة" onBack={onBack} /><ScrollView contentContainerStyle={{ padding: 16 }}><View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.detailTitle}>{item.title}</Text></View></View>{!!item.subtitle && <View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.detailSub}>{item.subtitle}</Text></View></View>}{!!item.person && <View style={styles.detailHead}><View style={{ flex: 1 }}><Text style={styles.detailPerson}>{item.person}</Text></View></View>}{isImage && item.localPath ? <Image source={{ uri: item.localPath }} style={styles.image} resizeMode="contain" /> : isVideo && item.localPath ? <OfflineVideo uri={item.localPath} /> : item.localPath && item.fileKind !== 'ARTICLE' && item.fileKind !== 'DOCUMENT' ? <AudioPlayer url={item.localPath} title={item.title} /> : null}{item.fileKind === 'DOCUMENT' && item.localPath ? <TouchableOpacity style={styles.documentCard} onPress={() => Linking.openURL(item.localPath).catch(() => Alert.alert('تعذّر فتح المستند', 'لم يتمكن الجهاز من فتح هذا الملف.'))} activeOpacity={0.88}><Text style={styles.documentIcon}>📄</Text><Text style={styles.documentTitle}>فتح المستند</Text></TouchableOpacity> : null}{!!item.bodyText && <ArticleHtml html={item.bodyText} />}<Text style={{ color: C.muted, fontSize: 12, marginTop: 16, textAlign: 'center' }}>محفوظة داخل التطبيق — متاحة دون اتصال.</Text></ScrollView></View>; }
function Loader() { return <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>; }
function ErrorBox({ msg, onRetry }) { return <View style={styles.center}><Text style={{ color: C.danger, textAlign: 'center', marginBottom: 12 }}>{msg}</Text>{onRetry && <TouchableOpacity style={styles.searchGo} onPress={onRetry}><Text style={{ color: C.brand, fontWeight: '800' }}>إعادة المحاولة</Text></TouchableOpacity>}</View>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ivory }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topbar: { backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }, topLogo: { width: 38, height: 38 }, topTitle: { color: C.white, fontSize: 20, fontWeight: '900' }, topSub: { color: C.gold300, fontSize: 12, marginTop: 2 }, iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }, iconBtnGold: { backgroundColor: C.gold }, attnRing: { position: 'absolute', width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.gold }, addCue: { position: 'absolute', top: 44, left: -84, width: 210, alignItems: 'center', zIndex: 60 }, addCueArrow: { color: C.gold, fontSize: 18, marginBottom: -3, textShadowColor: '#0006', textShadowRadius: 3 }, iconBtnTxt: { color: C.white, fontSize: 20, fontWeight: '900' }, badge: { position: 'absolute', top: 4, right: 4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#d9534f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, badgeTxt: { color: C.white, fontSize: 10, fontWeight: '900' }, notifItem: { backgroundColor: C.white, borderRadius: 14, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line }, notifThumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, notifLead: { fontSize: 11, color: C.gold, fontWeight: '800', textAlign: 'right' }, notifTitle: { fontSize: 15, fontWeight: '800', color: C.brand, textAlign: 'right', marginTop: 2 }, notifTime: { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 3 }, newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d9534f' }, notifItemReview: { borderColor: C.gold, borderWidth: 1.5, backgroundColor: '#fcf7ea' }, notifLeadReview: { color: '#b5892a' }, newDotReview: { backgroundColor: C.gold },
  searchWrap: { backgroundColor: C.brand, flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 }, searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12 }, search: { flex: 1, paddingHorizontal: 14, paddingVertical: 9, textAlign: 'right', color: C.ink }, searchClear: { paddingRight: 8, paddingLeft: 4 }, searchGo: { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, sugBox: { backgroundColor: '#ffffff', marginHorizontal: 12, marginTop: -4, marginBottom: 4, borderRadius: 12, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, sugRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, sugTitle: { color: C.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' }, sugSub: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 2 }, chips: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, gap: 8 }, typeChips: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, gap: 8 }, filterCap: { color: C.gold, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', width: '100%', paddingHorizontal: 14, marginTop: 8 }, filterDivider: { height: 1, backgroundColor: C.line, marginHorizontal: 12, marginTop: 8 }, chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, marginLeft: 8 }, chipActive: { backgroundColor: C.brand, borderColor: C.brand }, chipTxt: { color: C.brand, fontWeight: '700', fontSize: 13 }, chipTxtActive: { color: C.white },
  feedCard: { backgroundColor: C.white, borderRadius: 16, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line }, thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, thumbVideo: { width: 120, height: 78, backgroundColor: '#12241d' }, thumbGlyph: { color: C.gold300, fontSize: 30, fontWeight: '900' }, kindBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#00000066', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, kindBadgeTxt: { color: C.white, fontSize: 10, fontWeight: '700' }, feedTitle: { fontSize: 16, fontWeight: '800', color: C.brand, textAlign: 'right' }, feedPerson: { fontSize: 13, color: C.muted, marginTop: 3, textAlign: 'right' }, feedCat: { fontSize: 11, color: C.gold, marginTop: 4, textAlign: 'right', fontWeight: '700' }, empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
  shareFileCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  shareThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shareOk: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#eaf3ee', color: C.brand, fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, textAlign: 'right' },
  shareLabel: { fontSize: 13, fontWeight: '700', color: C.brand, textAlign: 'right', marginTop: 14, marginBottom: 6 },
  shareOpt: { color: C.muted, fontSize: 12, fontWeight: '400' },
  shareHint: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  suggBox: { marginTop: 4, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.white, overflow: 'hidden' },
  suggItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  suggTxt: { color: C.brand, fontSize: 14, textAlign: 'right', fontWeight: '600' },
  variantBox: { marginTop: 6, backgroundColor: '#faf6ec', borderWidth: 1, borderColor: '#ecdcb0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  variantTxt: { color: C.brand, fontSize: 13, textAlign: 'right', lineHeight: 20 },
  shareErr: { color: C.danger, fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 14 },
  consentRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.brand, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: C.brand },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: '900' },
  consentTxt: { flex: 1, fontSize: 13, lineHeight: 22, color: C.ink, textAlign: 'right' },
  acctCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.line }, acctTitle: { fontSize: 18, fontWeight: '800', color: C.brand, textAlign: 'right' }, acctDesc: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'right' }, authInput: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 15, color: C.ink, textAlign: 'right', backgroundColor: C.ivory50 }, authBtn: { backgroundColor: C.brand, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 }, authBtnTxt: { color: C.white, fontWeight: '800', fontSize: 15 }, orRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }, orLine: { flex: 1, height: 1, backgroundColor: C.line }, orTxt: { color: C.muted, fontSize: 12, fontWeight: '700' }, googleBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 11 }, googleG: { color: '#4285F4', fontSize: 18, fontWeight: '900' }, googleTxt: { color: C.ink, fontWeight: '800', fontSize: 14 }, guestBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line }, guestTxt: { color: C.brand, fontWeight: '800', fontSize: 14 }, logoutBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#f3e6e6', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 }, logoutTxt: { color: '#b23b3b', fontWeight: '800', fontSize: 13 }, footerText: { color: C.muted, textAlign: 'center', marginTop: 20, fontSize: 12 },
  offlineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#eaf3ee', paddingVertical: 8, paddingHorizontal: 12 },
  offlineBarTxt: { color: C.brand, fontWeight: '700', fontSize: 12.5, textAlign: 'center', flexShrink: 1 },
  offlineToggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#cdd5d0', padding: 3, justifyContent: 'center' },
  offlineToggleOn: { backgroundColor: C.brand },
  offlineKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.white, alignSelf: 'flex-start' },
  offlineKnobOn: { alignSelf: 'flex-end' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brand, paddingBottom: 12, paddingHorizontal: 12 }, headerTitle: { color: C.white, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' }, backBtn: { width: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#ffffff22', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 }, backChevron: { color: C.white, fontSize: 20, fontWeight: '900', lineHeight: 22, marginTop: -2 }, backTxt: { color: C.white, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  detailHead: { flexDirection: 'row', width: '100%' }, detailTitle: { fontSize: 24, fontWeight: '900', color: C.brand, textAlign: 'right' }, detailSub: { fontSize: 16, color: C.brand500, marginTop: 4, textAlign: 'right' }, detailPerson: { fontSize: 15, color: C.muted, marginTop: 4, textAlign: 'right' }, image: { width: '100%', height: 260, borderRadius: 16, marginTop: 16, backgroundColor: '#000' }, video: { width: '100%', height: 220, borderRadius: 16, marginTop: 16, backgroundColor: '#000' },
  documentCard: { marginTop: 16, backgroundColor: C.ivory50, borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: C.line }, documentIcon: { fontSize: 42, marginBottom: 8 }, documentTitle: { color: C.brand, fontSize: 18, fontWeight: '900' }, documentHint: { color: C.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  docBtns: { flexDirection: 'row', gap: 10, marginTop: 14 }, docViewBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 }, docViewTxt: { color: C.white, fontWeight: '800', fontSize: 14 }, docOpenBtn: { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 }, docOpenTxt: { color: C.brand, fontWeight: '800', fontSize: 14 }, pdfFooter: { backgroundColor: '#12241d', paddingVertical: 10, alignItems: 'center' }, pdfFooterTxt: { color: C.gold300, fontWeight: '800', fontSize: 13 },
  contribCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: C.gold }, contribIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.ivory, alignItems: 'center', justifyContent: 'center' }, contribTitle: { fontSize: 15.5, fontWeight: '800', color: C.brand, textAlign: 'right' }, contribSub: { fontSize: 12, color: C.muted, marginTop: 3, textAlign: 'right', lineHeight: 18 },
  guideCard: { backgroundColor: C.white, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  guidePlayer: { width: '100%', height: 360, backgroundColor: '#12241d' },
  guideCompact: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 12 },
  guideThumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: '#12241d', overflow: 'hidden', position: 'relative' },
  guideThumbPlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  guidePlayIcon: { color: C.white, fontSize: 24, fontWeight: '900', marginRight: -3, textShadowColor: '#0009', textShadowRadius: 6 },
  guideTitle: { fontSize: 15, fontWeight: '800', color: C.brand, textAlign: 'right' },
  guideSub: { fontSize: 12.5, color: C.muted, marginTop: 3, textAlign: 'right' },
  guideBtns: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  guidePlayBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.brand, borderRadius: 12, paddingVertical: 10 },
  guidePlayTxt: { color: C.white, fontSize: 13.5, fontWeight: '800' },
  guideDocBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.brand, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  guideDocTxt: { color: C.brand, fontSize: 13.5, fontWeight: '800' },
  videoWrap: { marginTop: 16 }, videoInline: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#000' }, videoBtns: { flexDirection: 'row', gap: 10, marginTop: 10 }, fsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.brand }, fsBtnAlt: { backgroundColor: '#294a3d' }, fsIcon: { color: C.gold300, fontSize: 16, fontWeight: '900' }, fsTxt: { color: C.white, fontSize: 14, fontWeight: '800' }, videoErr: { color: C.danger, fontSize: 13, marginTop: 10, textAlign: 'center' },
  pip: { position: 'absolute', width: 168, height: 112, borderRadius: 12, backgroundColor: '#000', overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 50 }, pipVideo: { width: '100%', height: '100%' }, pipTap: { ...StyleSheet.absoluteFillObject }, pipPause: { position: 'absolute', left: '50%', top: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 20, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' }, pipClose: { position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' }, pipCtrlIcon: { color: '#fff', fontSize: 15, fontWeight: '900' },
  playCard: { height: 150, borderRadius: 16, marginTop: 16, overflow: 'hidden', backgroundColor: C.brand }, playCardVideo: { height: 200, backgroundColor: '#12241d' }, playCardOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000055', gap: 8 }, playCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, playCircleIcon: { color: C.brand, fontSize: 24, fontWeight: '900', marginLeft: 3 }, playCardLabel: { color: C.white, fontSize: 15, fontWeight: '800' }, playCardHint: { color: '#e6efe9', fontSize: 11 },
  mini: { backgroundColor: '#12241d', borderTopWidth: 1, borderTopColor: '#294a3d' }, miniProgress: { height: 3, backgroundColor: '#294a3d' }, miniProgressFill: { height: 3, backgroundColor: C.gold }, miniRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 }, miniVideo: { width: 96, height: 54, borderRadius: 8, backgroundColor: '#000' }, miniThumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, miniThumbGlyph: { color: C.gold300, fontSize: 22, fontWeight: '900' }, miniTitle: { color: C.white, fontSize: 14, fontWeight: '800', textAlign: 'right' }, miniPerson: { color: '#aebfb6', fontSize: 12, textAlign: 'right', marginTop: 1 }, miniBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, miniBtnIcon: { color: C.brand, fontSize: 16, fontWeight: '900' }, miniClose: { width: 30, alignItems: 'center', justifyContent: 'center' }, miniCloseIcon: { color: '#8fa79b', fontSize: 16, fontWeight: '900' },
  full: { backgroundColor: '#12241d', borderRadius: 20, padding: 18, marginTop: 16, alignItems: 'center' }, fullArt: { width: 128, height: 128, borderRadius: 16, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }, fullArtGlyph: { color: C.gold300, fontSize: 46, fontWeight: '900' }, fullTitle: { color: C.white, fontSize: 17, fontWeight: '900', textAlign: 'center' }, fullPerson: { color: '#aebfb6', fontSize: 13, marginTop: 2, textAlign: 'center' }, seekWrap: { width: '100%', alignSelf: 'stretch', marginTop: 10 }, seekHit: { width: '100%', paddingVertical: 12 }, seekTrack: { height: 8, borderRadius: 4, backgroundColor: '#3f6357', justifyContent: 'center' }, seekFill: { position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: C.gold }, seekThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, marginLeft: -10, top: -6, borderWidth: 2, borderColor: '#12241d' }, seekTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, seekTime: { color: '#e6efe9', fontSize: 12, fontWeight: '700' }, fullControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }, fullSkip: { paddingHorizontal: 6, paddingVertical: 6 }, fullSkipTxt: { color: C.white, fontSize: 15, fontWeight: '800' }, fullPlay: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, fullPlayIcon: { color: C.brand, fontSize: 22, fontWeight: '900' }, fullSpeed: { minWidth: 46, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#ffffff18', alignItems: 'center' }, fullSpeedTxt: { color: C.gold300, fontSize: 13, fontWeight: '900' }, fullStopTxt: { color: '#e0a39c', fontSize: 12, fontWeight: '800' },
  player: { backgroundColor: C.brand, borderRadius: 18, padding: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, playIcon: { fontSize: 20, color: C.brand, fontWeight: '900' }, playTitle: { color: C.white, fontWeight: '700', marginBottom: 8, textAlign: 'right' }, progressTrack: { height: 6, backgroundColor: '#ffffff33', borderRadius: 3, overflow: 'hidden' }, progressFill: { height: 6, backgroundColor: C.gold }, timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, time: { color: '#cdd8d1', fontSize: 11 }, article: { backgroundColor: C.ivory50, borderRadius: 16, padding: 16, marginTop: 18, borderWidth: 1, borderColor: C.line }, articleWrap: { backgroundColor: '#faf7f0', borderRadius: 16, marginTop: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }, articleText: { fontSize: 16, lineHeight: 30, color: C.ink, textAlign: 'right' }, desc: { fontSize: 15, lineHeight: 28, color: C.ink, marginTop: 16, textAlign: 'right' }, downloads: { flexDirection: 'row', gap: 10, marginTop: 22 }, dlBtn: { flex: 1, backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, dlBtnAlt: { backgroundColor: C.gold }, dlTxt: { color: C.white, fontWeight: '800' }, shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, paddingVertical: 12 }, shareTxt: { color: C.brand, fontWeight: '800' },
});
