const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'App.js');
let src = fs.readFileSync(file, 'utf8');

// Let the seek bar own the gesture before the surrounding ScrollView can claim it.
src = src.replace(/function SeekBar\(\{ position, duration, onSeek \}\) \{[\s\S]*?\n\}\nfunction FullAudioPlayer\(/, `function SeekBar({ position, duration, onSeek }) {
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
      <View style={styles.seekTrack}><View style={[styles.seekFill, { width: \`\${frac * 100}%\` }]} /><View style={[styles.seekThumb, { left: \`\${frac * 100}%\` }]} /></View>
    </View>
    <View style={styles.seekTimes}><Text style={styles.seekTime}>{fmtTime(drag != null ? drag * duration : position)}</Text><Text style={styles.seekTime}>{fmtTime(duration)}</Text></View>
  </View>;
}
function FullAudioPlayer(`);

// Use proper vector icons in the native app instead of emoji/text glyphs.
if (!src.includes("from '@expo/vector-icons'")) {
  src = src.replace(
    "import { StatusBar } from 'expo-status-bar';",
    "import { StatusBar } from 'expo-status-bar';\nimport { Ionicons } from '@expo/vector-icons';",
  );
}

if (!src.includes('const CATEGORY_ICON_MAP')) {
  src = src.replace(
    "const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة' };",
    `const KIND_LABEL = { AUDIO: 'صوت', VIDEO: 'فيديو', DOCUMENT: 'مستند', IMAGE: 'صورة' };
const CATEGORY_ICON_MAP = {
  madeeh: 'headset-outline',
  lectures: 'mic-outline',
  sermons: 'book-outline',
  seminars: 'people-outline',
  occasions: 'calendar-outline',
  images: 'images-outline',
  readings: 'library-outline',
};
const CATEGORY_ICON_FALLBACK = 'grid-outline';`,
  );
}

// The API already bypasses Cloudflare. Media also uses the Railway origin so
// native Android video requests never need to pass through Cloudflare/R2.
src = src.replace(
  "import { ADMIN_URL, CONTRIBUTOR_URL, BUILD } from './config';",
  "import { API_HOST, ADMIN_URL, CONTRIBUTOR_URL, BUILD } from './config';",
);
src = src.replace(
  /m\.fileKind === 'VIDEO' && m\.fileUrl \? <InlineVideo url=\{m\.fileUrl\} poster=\{m\.coverImage\} \/>/g,
  "m.fileKind === 'VIDEO' && m.fileUrl ? <InlineVideo url={`${API_HOST}/api/mobile/media/${m.id}`} poster={m.coverImage} />",
);

// Category chips: show the same semantic icons configured by the website/admin.
src = src.replace(
  /<Chip label=\{c\.name\} active=\{active === c\.slug\} onPress=\{\(\) => setActive\(c\.slug\)\} \/>/g,
  "<Chip label={c.name} icon={c.icon || CATEGORY_ICON_MAP[c.slug] || CATEGORY_ICON_FALLBACK} active={active === c.slug} onPress={() => setActive(c.slug)} />",
);
src = src.replace(
  /function Chip\(\{ label, active, onPress \}\) \{ return <TouchableOpacity onPress=\{onPress\} style=\{\[styles\.chip, active && styles\.chipActive\]\}><Text style=\{\[styles\.chipTxt, active && styles\.chipTxtActive\]\}>\{label\}<\/Text><\/TouchableOpacity>; \}/,
  `function Chip({ label, active, onPress, icon }) {
  return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.82}>
    <Ionicons name={icon || CATEGORY_ICON_FALLBACK} size={18} color={active ? C.gold : '#d7e2dc'} />
    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
  </TouchableOpacity>;
}`,
);

// Replace the feed-card emoji thumbnails with polished vector media icons.
src = src.replace(
  /function FeedCard\(\{ m, onPress \}\) \{[\s\S]*?\n\}\nfunction Chip\(/,
  `function FeedCard({ m, onPress }) {
  const icon = m.fileKind === 'VIDEO' ? 'videocam-outline' : m.fileKind === 'IMAGE' ? 'image-outline' : m.fileKind === 'DOCUMENT' ? 'document-text-outline' : 'headset-outline';
  const person = m.category?.slug === 'readings' ? m.author : (m.performer || m.speaker || m.host);
  return <TouchableOpacity style={styles.feedCard} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.thumb, m.fileKind === 'VIDEO' && styles.thumbVideo]}>
      <View style={styles.thumbIconCircle}><Ionicons name={icon} size={28} color={C.gold} /></View>
      <View style={styles.kindBadge}><Text style={styles.kindBadgeTxt}>{KIND_LABEL[m.fileKind] || 'مادة'}</Text></View>
    </View>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.feedTitle} numberOfLines={2}>{m.title}</Text>{!!person && <Text style={styles.feedPerson} numberOfLines={1}>{person}</Text>}{!!m.category && <Text style={styles.feedCat}>{m.category.name}</Text>}</View>
  </TouchableOpacity>;
}
function Chip(`,
);

// Make video downloads use the same Cloudflare-safe origin proxy.
src = src.replace(
  /if \(material\.fileUrl\) \{ const dl = await FileSystem\.downloadAsync\(material\.fileUrl, dest\);/,
  "const sourceUrl = material.fileKind === 'VIDEO' ? `${API_HOST}/api/mobile/media/${material.id}` : material.fileUrl; if (sourceUrl) { const dl = await FileSystem.downloadAsync(sourceUrl, dest);",
);

// Give the new icon thumbnail a subtle elevated circle.
if (!src.includes('thumbIconCircle:')) {
  src = src.replace(
    /thumbGlyph: \{[^}]*\},/,
    "thumbGlyph: { color: C.gold300, fontSize: 46, fontWeight: '900' }, thumbIconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#ffffff12', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff18' },",
  );
}

fs.writeFileSync(file, src);
console.log('Almaseed Android preparation applied.');
