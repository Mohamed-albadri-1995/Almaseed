const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'App.js');
let src = fs.readFileSync(file, 'utf8');

// expo-av conflicts with expo-video on Android in some Expo 51 builds.
src = src.replace(/\nimport \{ Audio \} from 'expo-av';\n/, '\n');
src = src.replace(/function AudioPlayer\(\{ url, title \}\) \{[\s\S]*?\n\}\nfunction Downloads\(/, 'function Downloads(');

// Do not initialize the native audio player during app startup. It is initialized
// lazily when the user actually starts an audio item. This prevents a native
// TrackPlayer startup failure from leaving the Android splash screen visible.
src = src.replace(/\n  useEffect\(\(\) => \{ ensureTrackPlayer\(\); \}, \[\]\);/, '\n  // TrackPlayer is initialized lazily when playback starts.');

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

// TextureView is a safer Android rendering surface for expo-video when native surfaces overlap.
src = src.replace(/<VideoView ref=\{ref\} player=\{player\} style=\{styles\.videoInline\} contentFit="contain"/, '<VideoView ref={ref} player={player} style={styles.videoInline} surfaceType="textureView" contentFit="contain"');
src = src.replace(/<VideoView ref=\{ref\} player=\{player\} style=\{styles\.video\} contentFit="contain"/, '<VideoView ref={ref} player={player} style={styles.video} surfaceType="textureView" contentFit="contain"');

fs.writeFileSync(file, src);
console.log('Almaseed Android preparation applied.');
