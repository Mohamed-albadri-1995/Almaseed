import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, StyleSheet, I18nManager, Alert, Image, RefreshControl, Linking, BackHandler, Share,
  Platform, StatusBar as RNStatusBar, PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { Audio, Video, ResizeMode } from 'expo-av';
import TrackPlayer, {
  Capability, State, RepeatMode, usePlaybackState, useProgress,
} from 'react-native-track-player';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';
import { api } from './api';
import { ADMIN_URL, CONTRIBUTOR_URL, BUILD, API_BASE } from './config';
import { getDownloads, addDownload, removeDownload, getNotifSeen, setNotifSeen, getAuth, setAuth, clearAuth } from './storage';
import { registerForPush, attachNotificationTap, reregisterPush } from './push';

try { I18nManager.allowRTL(true); I18nManager.forceRTL(true); } catch {}

const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة', ARTICLE: 'مقال' };
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

export default function App() {
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);
  const push = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const top = stack[stack.length - 1];
  // Feed filters live here (not in Feed) so they survive navigating into a
  // material and back — otherwise returning always reset to «الكل».
  const [feedCat, setFeedCat] = useState('');
  const [feedKind, setFeedKind] = useState('');
  const [now, setNow] = useState(null);
  const play = useCallback((m) => {
    if (!m?.fileUrl || m.fileKind !== 'AUDIO') return;
    setNow({ id: m.id, title: m.title, subtitle: m.subtitle || null,
      person: m.performer || m.speaker || m.host || null,
      fileUrl: m.fileUrl, fileKind: m.fileKind, poster: m.coverImage || null });
  }, []);
  useEffect(() => { ensureTrackPlayer(); }, []);
  // Register for OS push notifications and open the material when one is tapped.
  useEffect(() => {
    registerForPush();
    const detach = attachNotificationTap((materialId) => push('material', { id: materialId }));
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
        {top.name === 'home' && <Feed push={push} active={feedCat} setActive={setFeedCat} kind={feedKind} setKind={setFeedKind} />}
        {top.name === 'material' && <MaterialScreen id={top.params.id} push={push} onBack={pop} onPlay={play} onStop={stopNow} nowId={now?.id} />}
        {top.name === 'notifications' && <NotificationsScreen push={push} onBack={pop} />}
        {top.name === 'googlelogin' && <GoogleLoginScreen onBack={pop} />}
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

function Feed({ push, active, setActive, kind, setKind }) {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => { api.categories().then((d) => setCats(d.items)).catch(() => {}); }, []);
  // Count how many materials were published since the user last opened the bell.
  useEffect(() => { (async () => {
    try {
      const seen = await getNotifSeen();
      const d = await api.notifications();
      const n = (d.items || []).filter((x) => x.publishedAt && new Date(x.publishedAt).getTime() > seen).length;
      setUnread(n);
    } catch {}
  })(); }, []);
  const load = useCallback((cat, query, k) => {
    setErr(''); setItems(null);
    return api.materials(cat || undefined, query || undefined, 1, k || undefined).then((d) => setItems(d.items)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(active, q, kind); /* eslint-disable-next-line */ }, [active, kind]);
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.topbar, { paddingTop: STATUSBAR_H + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('./assets/emblem.png')} style={styles.topLogo} />
          <View><Text style={styles.topTitle}>الطريقة السمّانية</Text><Text style={styles.topSub}>السجادة السليمانية</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}><TouchableOpacity onPress={() => push('notifications')} style={styles.iconBtn} activeOpacity={0.8}><Ionicons name="notifications-outline" size={21} color={C.white} />{unread > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View>}</TouchableOpacity><IconBtn label="⤓" onPress={() => push('library')} /><IconBtn label="☰" onPress={() => push('account')} /></View>
      </View>
      <View style={styles.searchWrap}>
        <TextInput value={q} onChangeText={setQ} placeholder="ابحث في الأرشيف…" placeholderTextColor="#cbd5cf" style={styles.search} returnKeyType="search" onSubmitEditing={() => load(active, q, kind)} />
        <TouchableOpacity style={styles.searchGo} onPress={() => load(active, q, kind)}><Text style={{ color: C.brand, fontWeight: '800' }}>بحث</Text></TouchableOpacity>
      </View>
      <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="الكل" active={active === ''} onPress={() => setActive('')} />{cats.map((c) => <Chip key={c.slug} label={c.name} active={active === c.slug} onPress={() => setActive(c.slug)} />)}</ScrollView></View>
      <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>{CONTENT_TYPES.map((t) => <Chip key={t.value || 'all'} label={t.label} active={kind === t.value} onPress={() => setKind(t.value)} />)}</ScrollView></View>
      {err ? <ErrorBox msg={err} onRetry={() => load(active, q, kind)} /> : !items ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4 }} refreshControl={<RefreshControl tintColor={C.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(active, q, kind); setRefreshing(false); }} />}>
          {items.length === 0 && <Text style={styles.empty}>لا توجد مواد.</Text>}{items.map((m) => <FeedCard key={m.id} m={m} onPress={() => push('material', { id: m.id })} />)}<View style={{ height: 20 }} />
        </ScrollView>
      )}
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
  const load = useCallback(() => {
    setErr('');
    return api.notifications().then((d) => setItems(d.items || [])).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { (async () => {
    setSeen(await getNotifSeen());
    await load();
    // Opening the screen marks everything up to now as seen (clears the badge).
    await setNotifSeen(Date.now());
  })(); }, [load]);
  return (
    <View style={{ flex: 1 }}>
      <Header title="الإشعارات" onBack={onBack} />
      {err ? <ErrorBox msg={err} onRetry={load} /> : !items ? <Loader /> : items.length === 0 ? (
        <Text style={styles.empty}>لا توجد إشعارات بعد.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {items.map((m) => {
            const isNew = m.publishedAt && new Date(m.publishedAt).getTime() > seen;
            return (
              <TouchableOpacity key={m.id} style={styles.notifItem} activeOpacity={0.85} onPress={() => push('material', { id: m.id })}>
                <View style={styles.notifThumb}>{m.coverImage ? <Image source={{ uri: m.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <KindIcon kind={m.fileUrl ? m.fileKind : 'ARTICLE'} size={22} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifLead}>إضافة جديدة{m.category ? ` · ${m.category.name}` : ''}</Text>
                  <Text style={styles.notifTitle} numberOfLines={2}>{m.title}</Text>
                  <Text style={styles.notifTime}>{timeAgo(m.publishedAt)}</Text>
                </View>
                {isNew && <View style={styles.newDot} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}
function Account({ push, onBack }) {
  const [auth, setAuthState] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getAuth().then((a) => setAuthState(a)).catch(() => {}); }, []);
  const doLogin = async () => {
    if (!email.trim() || !pass) { Alert.alert('بيانات ناقصة', 'أدخل البريد وكلمة المرور.'); return; }
    try {
      setBusy(true);
      const r = await api.login(email.trim().toLowerCase(), pass);
      await setAuth(r); setAuthState(r); setPass('');
      // Refresh this device's role on the server so staff get review alerts.
      reregisterPush();
      Alert.alert('تم الدخول', r.user?.isStaff ? 'ستصلك إشعارات المواد التي تنتظر المراجعة.' : 'تم تسجيل دخولك.');
    } catch (e) { Alert.alert('تعذّر الدخول', String(e.message || e)); } finally { setBusy(false); }
  };
  const doLogout = async () => { await clearAuth(); setAuthState(null); reregisterPush(); };
  return (
    <View style={{ flex: 1 }}>
      <Header title="الدخول والإدارة" onBack={onBack} />
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
            <TouchableOpacity style={styles.googleBtn} onPress={() => push('googlelogin')} activeOpacity={0.85}><Text style={styles.googleG}>G</Text><Text style={styles.googleTxt}>الدخول عبر Google</Text></TouchableOpacity>
            <Text style={[styles.acctDesc, { marginTop: 12 }]}>التصفّح متاح للجميع دون حساب — التسجيل اختياري وهو للمشرفين والمساهمين.</Text>
            <TouchableOpacity style={styles.guestBtn} onPress={onBack} activeOpacity={0.85}><Text style={styles.guestTxt}>متابعة كزائر</Text></TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.acctCard} onPress={() => push('web', { url: CONTRIBUTOR_URL, title: 'حسابي' })}><Text style={styles.acctTitle}>صفحة المساهم</Text><Text style={styles.acctDesc}>إرسال مادة ومتابعة موادك</Text></TouchableOpacity>
        <TouchableOpacity style={styles.acctCard} onPress={() => push('web', { url: ADMIN_URL, title: 'لوحة الإشراف' })}><Text style={styles.acctTitle}>لوحة الإشراف</Text><Text style={styles.acctDesc}>مراجعة المحتوى وإدارة الأرشيف</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.acctCard, { backgroundColor: C.ivory50 }]} onPress={() => push('library')}><Text style={styles.acctTitle}>التنزيلات المحفوظة</Text><Text style={styles.acctDesc}>الاستماع دون اتصال</Text></TouchableOpacity>
        <Text style={styles.footerText}>الطريقة السمّانية — السجادة السليمانية</Text>
        <Text style={styles.footerText}>إصدار التطبيق: {BUILD}</Text>
      </ScrollView>
    </View>
  );
}
function Header({ title, onBack }) { return <View style={[styles.header, { paddingTop: STATUSBAR_H + 8 }]}><View style={{ width: 92 }} /><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>{onBack ? <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}><Text style={[styles.backTxt, { writingDirection: 'ltr', flex: 1 }]}>‹ رجوع</Text></TouchableOpacity> : <View style={{ width: 92 }} />}</View>; }
function WebScreen({ url, title, onBack }) { return <View style={{ flex: 1 }}><Header title={title} onBack={onBack} /><WebView source={{ uri: url }} startInLoadingState renderLoading={() => <Loader />} /></View>; }
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
  const doc = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet"><style>html,body{margin:0;padding:0}body{padding:16px;font-family:'Cairo','Tajawal',-apple-system,Roboto,'Segoe UI',sans-serif;font-size:17.2px;line-height:2.2;color:#20302a;background:#faf7f0;direction:rtl;text-align:right;word-wrap:break-word}h1,h2{font-family:'Aref Ruqaa','Amiri','Cairo',serif;font-weight:700;color:#1f3d33;line-height:1.6}h1{font-size:1.9em;margin:.6em 0 .4em}h2{font-size:1.5em;margin:.6em 0 .4em}strong{font-weight:700;color:#173029}img{max-width:100%;height:auto}*{max-width:100%}</style></head><body>${body}<script>function P(){try{window.ReactNativeWebView.postMessage(String(document.body.scrollHeight))}catch(e){}}window.addEventListener('load',P);setTimeout(P,250);setTimeout(P,800);setTimeout(P,1600);document.fonts&&document.fonts.ready.then(P);</script></body></html>`;
  return <View style={styles.articleWrap}><WebView originWhitelist={['*']} source={{ html: doc }} style={{ width: '100%', height }} scrollEnabled={false} showsVerticalScrollIndicator={false} onMessage={(e) => { const h = Number(e.nativeEvent.data); if (h && Math.abs(h - height) > 4) setHeight(h); }} /></View>;
}
function MaterialScreen({ id, push, onBack, onPlay, onStop, nowId }) {
  const [m, setM] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.material(id).then(setM).catch((e) => setErr(e.message)); }, [id]);
  const playingHere = m && nowId === m.id;
  const isBook = m?.category?.slug === 'readings';
  const person = isBook ? m.author : (m?.performer || m?.speaker || m?.host);
  return <View style={{ flex: 1 }}><Header title="تفاصيل المادة" onBack={onBack} />{err ? <ErrorBox msg={err} /> : !m ? <Loader /> : <ScrollView contentContainerStyle={{ padding: 16 }}><Text style={styles.detailTitle}>{m.title}</Text>{!!m.subtitle && <Text style={styles.detailSub}>{m.subtitle}</Text>}{!!person && <Text style={styles.detailPerson}>{isBook ? `الكاتب: ${person}` : person}</Text>}{!!m.contributor && <Text style={[styles.detailPerson, { fontSize: 13 }]}>شاركها: {m.contributor}</Text>}{m.fileKind === 'IMAGE' && m.fileUrl ? <Image source={{ uri: m.fileUrl }} style={styles.image} resizeMode="contain" /> : m.fileKind === 'VIDEO' && m.fileUrl ? <InlineVideo url={m.fileUrl} poster={m.coverImage} /> : m.fileKind === 'DOCUMENT' && m.fileUrl ? <View style={styles.documentCard}><Text style={styles.documentIcon}>📄</Text><Text style={styles.documentTitle}>{m.fileType ? `مستند ${m.fileType}` : 'مستند'}</Text><Text style={styles.documentHint}>اعرض الكتاب أو ملف PDF داخل التطبيق، أو افتحه بتطبيق خارجي.</Text><View style={styles.docBtns}><TouchableOpacity style={styles.docViewBtn} onPress={() => push && push('pdf', { url: m.fileUrl, title: m.title })} activeOpacity={0.88}><Text style={styles.docViewTxt}>عرض داخل التطبيق</Text></TouchableOpacity><TouchableOpacity style={styles.docOpenBtn} onPress={() => Linking.openURL(m.fileUrl).catch(() => Alert.alert('تعذّر فتح المستند', 'لم يتمكن الجهاز من فتح هذا الملف.'))} activeOpacity={0.88}><Text style={styles.docOpenTxt}>فتح خارجياً</Text></TouchableOpacity></View></View> : m.fileKind === 'AUDIO' && m.fileUrl ? (playingHere ? <FullAudioPlayer title={m.title} person={person} poster={m.coverImage} onStop={onStop} /> : <TouchableOpacity style={styles.playCard} onPress={() => onPlay(m)} activeOpacity={0.9}>{m.coverImage ? <Image source={{ uri: m.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}<View style={styles.playCardOverlay}><View style={styles.playCircle}><Text style={styles.playCircleIcon}>▶</Text></View><Text style={styles.playCardLabel}>استماع</Text><Text style={styles.playCardHint}>يستمر التشغيل أثناء تصفّح باقي الصفحات</Text></View></TouchableOpacity>) : null}{!!m.bodyText && <ArticleHtml html={m.bodyText} />}{!!m.description && <Text style={styles.desc}>{m.description}</Text>}<Downloads material={m} /></ScrollView>}</View>;
}
// Video playback via expo-av (reliable native rendering on Android). Inline
// with native controls plus a fullscreen button.
function InlineVideo({ url, poster }) {
  const ref = useRef(null); const [err, setErr] = useState(false);
  const fullscreen = async () => { try { await ref.current?.presentFullscreenPlayer(); } catch {} };
  return <View style={styles.videoWrap}><Video ref={ref} source={{ uri: url }} useNativeControls resizeMode={ResizeMode.CONTAIN} usePoster={!!poster} posterSource={poster ? { uri: poster } : undefined} style={styles.videoInline} onError={() => setErr(true)} />{err ? <Text style={styles.videoErr}>تعذّر تشغيل الفيديو — جرّب التنزيل.</Text> : <View style={styles.videoBtns}><TouchableOpacity style={[styles.fsBtn, styles.fsBtnAlt]} onPress={fullscreen} activeOpacity={0.85}><Text style={styles.fsIcon}>⛶</Text><Text style={styles.fsTxt}>ملء الشاشة</Text></TouchableOpacity></View>}</View>;
}
function MiniPlayer(props) { return <MiniAudio {...props} />; }
function MiniShell({ children, onClose, onOpen, item, pct, leading }) { return <View style={styles.mini}><View style={styles.miniProgress}><View style={[styles.miniProgressFill, { width: `${pct}%` }]} /></View><View style={styles.miniRow}>{leading}<TouchableOpacity style={{ flex: 1 }} onPress={onOpen} activeOpacity={0.8}><Text style={styles.miniTitle} numberOfLines={1}>{item.title}</Text>{!!item.person && <Text style={styles.miniPerson} numberOfLines={1}>{item.person}</Text>}</TouchableOpacity>{children}<TouchableOpacity onPress={onClose} style={styles.miniClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.miniCloseIcon}>✕</Text></TouchableOpacity></View></View>; }
const AUDIO_BUSY = (s) => s === State.Buffering || s === State.Loading || s === State.Connecting || s === State.None || s == null;
function MiniAudio({ item, onClose, onOpen }) { const playback = usePlaybackState(); const { position, duration } = useProgress(500); const state = playback?.state; const isPlaying = state === State.Playing; const toggle = () => { isPlaying ? TrackPlayer.pause() : TrackPlayer.play(); }; const pct = duration ? Math.min(100, Math.round((position / duration) * 100)) : 0; return <MiniShell item={item} onClose={onClose} onOpen={onOpen} pct={pct} leading={<TouchableOpacity onPress={onOpen} activeOpacity={0.9} style={styles.miniThumb}>{item.poster ? <Image source={{ uri: item.poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Image source={require('./assets/emblem.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />}</TouchableOpacity>}><TouchableOpacity onPress={toggle} style={styles.miniBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>{AUDIO_BUSY(state) ? <ActivityIndicator color={C.brand} /> : <Text style={styles.miniBtnIcon}>{isPlaying ? '❚❚' : '▶'}</Text>}</TouchableOpacity></MiniShell>; }
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
function AudioPlayer({ url, title }) { const soundRef = useRef(null); const [status, setStatus] = useState({ isPlaying: false, positionMillis: 0, durationMillis: 1 }); const [loading, setLoading] = useState(false); useEffect(() => () => { if (soundRef.current) soundRef.current.unloadAsync(); }, []); const toggle = async () => { try { if (!soundRef.current) { setLoading(true); await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true }); const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true }); soundRef.current = sound; sound.setOnPlaybackStatusUpdate((s) => setStatus(s)); setLoading(false); } else if (status.isPlaying) await soundRef.current.pauseAsync(); else await soundRef.current.playAsync(); } catch (e) { setLoading(false); Alert.alert('تعذّر التشغيل', String(e.message || e)); } }; const pct = status.durationMillis ? Math.round((status.positionMillis / status.durationMillis) * 100) : 0; const fmt = (ms) => { const s = Math.floor((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }; return <View style={styles.player}><TouchableOpacity style={styles.playBtn} onPress={toggle}>{loading ? <ActivityIndicator color={C.brand} /> : <Text style={styles.playIcon}>{status.isPlaying ? '❚❚' : '▶'}</Text>}</TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.playTitle} numberOfLines={1}>{title}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View><View style={styles.timeRow}><Text style={styles.time}>{fmt(status.positionMillis)}</Text><Text style={styles.time}>{fmt(status.durationMillis)}</Text></View></View></View>; }
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
  const safe = material.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'material'; const displayBase = `${safe} - أرشيف المسيد`; const filename = `${material.id}.${ext}`; const MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', '3gpp': 'video/3gpp', avi: 'video/x-msvideo', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', amr: 'audio/amr', weba: 'audio/webm' }; async function ensureLocal(onProgress) { const dest = FileSystem.documentDirectory + filename; const info = await FileSystem.getInfoAsync(dest); if (info.exists) return dest; if (material.fileUrl) { const task = FileSystem.createDownloadResumable(material.fileUrl, dest, {}, (p) => { if (onProgress && p.totalBytesExpectedToWrite > 0) onProgress(Math.min(100, Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100))); }); const dl = await task.downloadAsync(); return dl.uri; } await FileSystem.writeAsStringAsync(dest, material.bodyText || material.description || ''); return dest; } const saveInApp = async () => { try { setBusy('app'); setPct(0); const localPath = await ensureLocal(setPct); await addDownload({ id: material.id, title: material.title, subtitle: material.subtitle || null, person: material.category?.slug === 'readings' ? material.author || null : (material.performer || material.speaker || material.host || null), fileKind: material.fileKind || (material.bodyText ? 'ARTICLE' : 'AUDIO'), localPath, bodyText: material.bodyText || null }); Alert.alert('تم الحفظ', 'حُفظت المادة داخل التطبيق، وتظهر في «التنزيلات المحفوظة».'); } catch (e) { Alert.alert('تعذّر الحفظ', String(e.message || e)); } finally { setBusy(''); } }; const saveViaSAF = async (uri) => { const SAF = FileSystem.StorageAccessFramework; if (Platform.OS === 'android' && SAF) { const perm = await SAF.requestDirectoryPermissionsAsync(); if (!perm.granted) { Alert.alert('الإذن مطلوب', 'اختر مجلدًا لحفظ الملف في جهازك.'); return false; } const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); const target = await SAF.createFileAsync(perm.directoryUri, displayBase, MIME[ext] || 'application/octet-stream'); await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 }); return true; } if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); return true; } if (material.fileUrl) { Linking.openURL(material.fileUrl); return true; } return false; }; const saveToDevice = async () => { try { setBusy('device'); setPct(0); const isMedia = ['AUDIO', 'VIDEO', 'IMAGE'].includes(material.fileKind); const uri = await ensureLocal(setPct); let saveUri = uri; try { const pretty = FileSystem.cacheDirectory + `${displayBase}.${ext}`; await FileSystem.deleteAsync(pretty, { idempotent: true }); await FileSystem.copyAsync({ from: uri, to: pretty }); saveUri = pretty; } catch {} if (isMedia) { const perm = await MediaLibrary.requestPermissionsAsync(false); if (!perm.granted) { Alert.alert('الإذن مطلوب', 'فعّل إذن الوسائط من إعدادات التطبيق لحفظ الملف في جهازك.'); return; } try { await MediaLibrary.saveToLibraryAsync(saveUri); Alert.alert('تم التنزيل', 'حُفظ الملف في جهازك (المعرض / الموسيقى).'); } catch (mediaErr) { const ok = await saveViaSAF(saveUri); if (ok) Alert.alert('تم التنزيل', 'تعذّر حفظه في المعرض، فحُفظ في المجلد الذي اخترته.'); else throw mediaErr; } } else { const ok = await saveViaSAF(saveUri); if (ok) Alert.alert('تم التنزيل', 'حُفظ الملف في المجلد الذي اخترته.'); else Alert.alert('غير متاح', 'تعذّر حفظ هذا النوع على الجهاز.'); } } catch (e) { Alert.alert('تعذّر التنزيل', String(e.message || e)); } finally { setBusy(''); } }; const shareLink = async () => { try { await Share.share({ message: `${material.title}\n${API_BASE}/material/${material.id}` }); } catch {} }; if (!material.fileUrl && !material.bodyText) return null; return <View><View style={styles.downloads}><TouchableOpacity style={styles.dlBtn} onPress={saveInApp} disabled={!!busy}><Text style={styles.dlTxt}>{busy === 'app' ? `${pct}%` : 'حفظ داخل التطبيق'}</Text></TouchableOpacity><TouchableOpacity style={[styles.dlBtn, styles.dlBtnAlt]} onPress={saveToDevice} disabled={!!busy}><Text style={[styles.dlTxt, { color: C.brand }]}>{busy === 'device' ? `${pct}%` : 'تنزيل إلى الجهاز'}</Text></TouchableOpacity></View><TouchableOpacity style={styles.shareBtn} onPress={shareLink} activeOpacity={0.85}><Ionicons name="share-social" size={18} color={C.brand} /><Text style={styles.shareTxt}>مشاركة الرابط</Text></TouchableOpacity></View>; }
function Library({ push, onBack }) { const [items, setItems] = useState(null); const reload = useCallback(() => { getDownloads().then(setItems); }, []); useEffect(reload, [reload]); const del = (id) => Alert.alert('حذف', 'حذف هذه المادة من التنزيلات؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => setItems(await removeDownload(id)) }]); return <View style={{ flex: 1 }}><Header title="التنزيلات المحفوظة" onBack={onBack} />{!items ? <Loader /> : items.length === 0 ? <View style={styles.center}><Text style={styles.empty}>لا توجد تنزيلات محفوظة بعد.</Text><Text style={{ color: C.muted, textAlign: 'center', marginTop: 6 }}>احفظ أي مادة عبر «حفظ داخل التطبيق» لتظهر هنا وتُشغَّل دون اتصال.</Text></View> : <ScrollView contentContainerStyle={{ padding: 12 }}>{items.map((it) => <View key={it.id} style={styles.feedCard}><TouchableOpacity style={[styles.thumb, { width: 64, height: 64 }]} onPress={() => push('offline', { item: it })}><KindIcon kind={it.fileKind} size={26} /></TouchableOpacity><TouchableOpacity style={{ flex: 1 }} onPress={() => push('offline', { item: it })}><Text style={styles.feedTitle} numberOfLines={2}>{it.title}</Text><Text style={styles.feedPerson} numberOfLines={1}>{(it.person || '') + '  ·  ' + (KIND_LABEL[it.fileKind] || 'مقال')}</Text></TouchableOpacity><TouchableOpacity onPress={() => del(it.id)} style={{ padding: 6 }}><Text style={{ color: C.danger, fontSize: 18 }}>✕</Text></TouchableOpacity></View>)}</ScrollView>}</View>; }
function OfflineVideo({ uri }) {
  return <Video source={{ uri }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={styles.video} />;
}
function OfflineScreen({ item, onBack }) { const isImage = item.fileKind === 'IMAGE'; const isVideo = item.fileKind === 'VIDEO'; return <View style={{ flex: 1 }}><Header title="مادة محفوظة" onBack={onBack} /><ScrollView contentContainerStyle={{ padding: 16 }}><Text style={styles.detailTitle}>{item.title}</Text>{!!item.subtitle && <Text style={styles.detailSub}>{item.subtitle}</Text>}{!!item.person && <Text style={styles.detailPerson}>{item.person}</Text>}{isImage && item.localPath ? <Image source={{ uri: item.localPath }} style={styles.image} resizeMode="contain" /> : isVideo && item.localPath ? <OfflineVideo uri={item.localPath} /> : item.localPath && item.fileKind !== 'ARTICLE' && item.fileKind !== 'DOCUMENT' ? <AudioPlayer url={item.localPath} title={item.title} /> : null}{item.fileKind === 'DOCUMENT' && item.localPath ? <TouchableOpacity style={styles.documentCard} onPress={() => Linking.openURL(item.localPath).catch(() => Alert.alert('تعذّر فتح المستند', 'لم يتمكن الجهاز من فتح هذا الملف.'))} activeOpacity={0.88}><Text style={styles.documentIcon}>📄</Text><Text style={styles.documentTitle}>فتح المستند</Text></TouchableOpacity> : null}{!!item.bodyText && <ArticleHtml html={item.bodyText} />}<Text style={{ color: C.muted, fontSize: 12, marginTop: 16, textAlign: 'center' }}>محفوظة داخل التطبيق — متاحة دون اتصال.</Text></ScrollView></View>; }
function Loader() { return <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>; }
function ErrorBox({ msg, onRetry }) { return <View style={styles.center}><Text style={{ color: C.danger, textAlign: 'center', marginBottom: 12 }}>{msg}</Text>{onRetry && <TouchableOpacity style={styles.searchGo} onPress={onRetry}><Text style={{ color: C.brand, fontWeight: '800' }}>إعادة المحاولة</Text></TouchableOpacity>}</View>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ivory }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topbar: { backgroundColor: C.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }, topLogo: { width: 38, height: 38 }, topTitle: { color: C.white, fontSize: 20, fontWeight: '900' }, topSub: { color: C.gold300, fontSize: 12, marginTop: 2 }, iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }, iconBtnTxt: { color: C.white, fontSize: 20, fontWeight: '900' }, badge: { position: 'absolute', top: 4, right: 4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#d9534f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, badgeTxt: { color: C.white, fontSize: 10, fontWeight: '900' }, notifItem: { backgroundColor: C.white, borderRadius: 14, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line }, notifThumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, notifLead: { fontSize: 11, color: C.gold, fontWeight: '800', textAlign: 'right' }, notifTitle: { fontSize: 15, fontWeight: '800', color: C.brand, textAlign: 'right', marginTop: 2 }, notifTime: { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 3 }, newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d9534f' },
  searchWrap: { backgroundColor: C.brand, flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 }, search: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, textAlign: 'right', color: C.ink }, searchGo: { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 }, typeChips: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 }, chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, marginLeft: 8 }, chipActive: { backgroundColor: C.brand, borderColor: C.brand }, chipTxt: { color: C.brand, fontWeight: '700', fontSize: 13 }, chipTxtActive: { color: C.white },
  feedCard: { backgroundColor: C.white, borderRadius: 16, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line }, thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, thumbVideo: { width: 120, height: 78, backgroundColor: '#12241d' }, thumbGlyph: { color: C.gold300, fontSize: 30, fontWeight: '900' }, kindBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#00000066', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, kindBadgeTxt: { color: C.white, fontSize: 10, fontWeight: '700' }, feedTitle: { fontSize: 16, fontWeight: '800', color: C.brand, textAlign: 'right' }, feedPerson: { fontSize: 13, color: C.muted, marginTop: 3, textAlign: 'right' }, feedCat: { fontSize: 11, color: C.gold, marginTop: 4, textAlign: 'right', fontWeight: '700' }, empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
  acctCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.line }, acctTitle: { fontSize: 18, fontWeight: '800', color: C.brand, textAlign: 'right' }, acctDesc: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'right' }, authInput: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 15, color: C.ink, textAlign: 'right', backgroundColor: C.ivory50 }, authBtn: { backgroundColor: C.brand, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 }, authBtnTxt: { color: C.white, fontWeight: '800', fontSize: 15 }, orRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }, orLine: { flex: 1, height: 1, backgroundColor: C.line }, orTxt: { color: C.muted, fontSize: 12, fontWeight: '700' }, googleBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 11 }, googleG: { color: '#4285F4', fontSize: 18, fontWeight: '900' }, googleTxt: { color: C.ink, fontWeight: '800', fontSize: 14 }, guestBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line }, guestTxt: { color: C.brand, fontWeight: '800', fontSize: 14 }, logoutBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#f3e6e6', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 }, logoutTxt: { color: '#b23b3b', fontWeight: '800', fontSize: 13 }, footerText: { color: C.muted, textAlign: 'center', marginTop: 20, fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brand, paddingBottom: 12, paddingHorizontal: 12 }, headerTitle: { color: C.white, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' }, backBtn: { width: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#ffffff22', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 }, backChevron: { color: C.white, fontSize: 20, fontWeight: '900', lineHeight: 22, marginTop: -2 }, backTxt: { color: C.white, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  detailTitle: { fontSize: 24, fontWeight: '900', color: C.brand, textAlign: 'right' }, detailSub: { fontSize: 16, color: C.brand500, marginTop: 4, textAlign: 'right' }, detailPerson: { fontSize: 15, color: C.muted, marginTop: 4, textAlign: 'right' }, image: { width: '100%', height: 260, borderRadius: 16, marginTop: 16, backgroundColor: '#000' }, video: { width: '100%', height: 220, borderRadius: 16, marginTop: 16, backgroundColor: '#000' },
  documentCard: { marginTop: 16, backgroundColor: C.ivory50, borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: C.line }, documentIcon: { fontSize: 42, marginBottom: 8 }, documentTitle: { color: C.brand, fontSize: 18, fontWeight: '900' }, documentHint: { color: C.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  docBtns: { flexDirection: 'row', gap: 10, marginTop: 14 }, docViewBtn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 }, docViewTxt: { color: C.white, fontWeight: '800', fontSize: 14 }, docOpenBtn: { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 }, docOpenTxt: { color: C.brand, fontWeight: '800', fontSize: 14 }, pdfFooter: { backgroundColor: '#12241d', paddingVertical: 10, alignItems: 'center' }, pdfFooterTxt: { color: C.gold300, fontWeight: '800', fontSize: 13 },
  videoWrap: { marginTop: 16 }, videoInline: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#000' }, videoBtns: { flexDirection: 'row', gap: 10, marginTop: 10 }, fsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.brand }, fsBtnAlt: { backgroundColor: '#294a3d' }, fsIcon: { color: C.gold300, fontSize: 16, fontWeight: '900' }, fsTxt: { color: C.white, fontSize: 14, fontWeight: '800' }, videoErr: { color: C.danger, fontSize: 13, marginTop: 10, textAlign: 'center' },
  pip: { position: 'absolute', width: 168, height: 112, borderRadius: 12, backgroundColor: '#000', overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 50 }, pipVideo: { width: '100%', height: '100%' }, pipTap: { ...StyleSheet.absoluteFillObject }, pipPause: { position: 'absolute', left: '50%', top: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 20, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' }, pipClose: { position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' }, pipCtrlIcon: { color: '#fff', fontSize: 15, fontWeight: '900' },
  playCard: { height: 150, borderRadius: 16, marginTop: 16, overflow: 'hidden', backgroundColor: C.brand }, playCardVideo: { height: 200, backgroundColor: '#12241d' }, playCardOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000055', gap: 8 }, playCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, playCircleIcon: { color: C.brand, fontSize: 24, fontWeight: '900', marginLeft: 3 }, playCardLabel: { color: C.white, fontSize: 15, fontWeight: '800' }, playCardHint: { color: '#e6efe9', fontSize: 11 },
  mini: { backgroundColor: '#12241d', borderTopWidth: 1, borderTopColor: '#294a3d' }, miniProgress: { height: 3, backgroundColor: '#294a3d' }, miniProgressFill: { height: 3, backgroundColor: C.gold }, miniRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 }, miniVideo: { width: 96, height: 54, borderRadius: 8, backgroundColor: '#000' }, miniThumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, miniThumbGlyph: { color: C.gold300, fontSize: 22, fontWeight: '900' }, miniTitle: { color: C.white, fontSize: 14, fontWeight: '800', textAlign: 'right' }, miniPerson: { color: '#aebfb6', fontSize: 12, textAlign: 'right', marginTop: 1 }, miniBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, miniBtnIcon: { color: C.brand, fontSize: 16, fontWeight: '900' }, miniClose: { width: 30, alignItems: 'center', justifyContent: 'center' }, miniCloseIcon: { color: '#8fa79b', fontSize: 16, fontWeight: '900' },
  full: { backgroundColor: '#12241d', borderRadius: 20, padding: 18, marginTop: 16, alignItems: 'center' }, fullArt: { width: 128, height: 128, borderRadius: 16, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }, fullArtGlyph: { color: C.gold300, fontSize: 46, fontWeight: '900' }, fullTitle: { color: C.white, fontSize: 17, fontWeight: '900', textAlign: 'center' }, fullPerson: { color: '#aebfb6', fontSize: 13, marginTop: 2, textAlign: 'center' }, seekWrap: { width: '100%', alignSelf: 'stretch', marginTop: 10, direction: 'ltr' }, seekHit: { width: '100%', paddingVertical: 12 }, seekTrack: { height: 8, borderRadius: 4, backgroundColor: '#3f6357', justifyContent: 'center' }, seekFill: { position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: C.gold }, seekThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, marginLeft: -10, top: -6, borderWidth: 2, borderColor: '#12241d' }, seekTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, seekTime: { color: '#e6efe9', fontSize: 12, fontWeight: '700' }, fullControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }, fullSkip: { paddingHorizontal: 6, paddingVertical: 6 }, fullSkipTxt: { color: C.white, fontSize: 15, fontWeight: '800' }, fullPlay: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, fullPlayIcon: { color: C.brand, fontSize: 22, fontWeight: '900' }, fullSpeed: { minWidth: 46, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#ffffff18', alignItems: 'center' }, fullSpeedTxt: { color: C.gold300, fontSize: 13, fontWeight: '900' }, fullStopTxt: { color: '#e0a39c', fontSize: 12, fontWeight: '800' },
  player: { backgroundColor: C.brand, borderRadius: 18, padding: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, playIcon: { fontSize: 20, color: C.brand, fontWeight: '900' }, playTitle: { color: C.white, fontWeight: '700', marginBottom: 8, textAlign: 'right' }, progressTrack: { height: 6, backgroundColor: '#ffffff33', borderRadius: 3, overflow: 'hidden' }, progressFill: { height: 6, backgroundColor: C.gold }, timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, time: { color: '#cdd8d1', fontSize: 11 }, article: { backgroundColor: C.ivory50, borderRadius: 16, padding: 16, marginTop: 18, borderWidth: 1, borderColor: C.line }, articleWrap: { backgroundColor: '#faf7f0', borderRadius: 16, marginTop: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }, articleText: { fontSize: 16, lineHeight: 30, color: C.ink, textAlign: 'right' }, desc: { fontSize: 15, lineHeight: 28, color: C.ink, marginTop: 16, textAlign: 'right' }, downloads: { flexDirection: 'row', gap: 10, marginTop: 22 }, dlBtn: { flex: 1, backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, dlBtnAlt: { backgroundColor: C.gold }, dlTxt: { color: C.white, fontWeight: '800' }, shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, paddingVertical: 12 }, shareTxt: { color: C.brand, fontWeight: '800' },
});
