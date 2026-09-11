const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'App.js');
let src = fs.readFileSync(file, 'utf8');

// Fix Android physical seek direction: dragging right moves forward.
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

// PDFs must be downloaded through the server file endpoint.
src = src.replace(
  /if \(material\.fileUrl\) \{ const dl = await FileSystem\.downloadAsync\(material\.fileUrl, dest\); return dl\.uri; \}/,
  "if (material.fileUrl) { const sourceUrl = material.fileKind === 'DOCUMENT' ? `https://almaseeed.com/api/materials/${material.id}/download` : material.fileUrl; const dl = await FileSystem.downloadAsync(sourceUrl, dest); return dl.uri; }"
);

// PDFs are saved directly into Android's public Downloads folder.
src = src.replace(
  "} else if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); } else if (material.fileUrl) {",
  "} else if (Platform.OS === 'android') { const { PdfDownloader } = require('react-native').NativeModules; if (!PdfDownloader || !PdfDownloader.saveToDownloads) throw new Error('خدمة حفظ PDF غير متاحة في هذه النسخة.'); const rawName = String(material.title || 'document').replace(/[\\\\/:*?\"<>|]/g, '_').trim() || 'document'; const fileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`; await PdfDownloader.saveToDownloads(uri, fileName); Alert.alert('تم التنزيل', 'تم حفظ ملف PDF في مجلد التنزيلات.'); } else if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); } else if (material.fileUrl) {"
);

fs.writeFileSync(file, src);
console.log('Almaseed Android preparation applied.');
