const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'App.js');
let src = fs.readFileSync(file, 'utf8');

// Keep the seek thumb physically aligned with the user's finger in RTL.
// Dragging left moves the thumb left and advances playback; dragging right
// moves the thumb right and rewinds playback.
src = src.replace(/function SeekBar\(\{ position, duration, onSeek \}\) \{[\s\S]*?\n\}\nfunction FullAudioPlayer\(/, `function SeekBar({ position, duration, onSeek }) {
  const wRef = useRef(1);
  const [drag, setDrag] = useState(null);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const fractionFromEvent = (e) => clamp(1 - ((e.nativeEvent.locationX || 0) / wRef.current));
  const begin = (e) => setDrag(fractionFromEvent(e));
  const move = (e) => setDrag(fractionFromEvent(e));
  const finish = (e) => { const f = fractionFromEvent(e); setDrag(null); onSeek(f); };
  const frac = drag != null ? drag : duration ? Math.max(0, Math.min(1, position / duration)) : 0;
  const thumbLeft = (1 - frac) * 100;
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
      <View style={styles.seekTrack}>
        <View style={[styles.seekFill, { width: frac * 100 + '%', right: 0, left: 'auto' }]} />
        <View style={[styles.seekThumb, { left: thumbLeft + '%', right: 'auto' }]} />
      </View>
    </View>
    <View style={styles.seekTimes}><Text style={styles.seekTime}>{fmtTime(drag != null ? drag * duration : position)}</Text><Text style={styles.seekTime}>{fmtTime(duration)}</Text></View>
  </View>;
}
function FullAudioPlayer(`);

fs.writeFileSync(file, src);
console.log('Almaseed Android preparation applied.');