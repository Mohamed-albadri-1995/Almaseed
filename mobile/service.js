import TrackPlayer, { Event } from 'react-native-track-player';

// Handles the media controls the OS shows in the notification shade / lock
// screen (and headset buttons). Runs in a background service registered from
// index.js.
export async function PlaybackService() {
  // Keep the player alive when the app UI is removed from recent apps, and let
  // us — not the library — decide what happens on an audio-focus change.
  try {
    await TrackPlayer.updateOptions({
      android: { appKilledPlaybackBehavior: 'ContinuePlayback' },
      autoHandleInterruptions: false,
    });
  } catch {}

  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => TrackPlayer.seekTo(position));
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({ interval }) => {
    const p = await TrackPlayer.getProgress();
    TrackPlayer.seekTo(p.position + (interval || 15));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
    const p = await TrackPlayer.getProgress();
    TrackPlayer.seekTo(Math.max(0, p.position - (interval || 15)));
  });

  // Audio-focus changes. A short notification ping (ChatGPT, WhatsApp, …) is a
  // TRANSIENT interruption: many Android OEMs (Huawei/Honor/Samsung) never send
  // the "focus regained" event, so pausing on it would leave playback stopped
  // for good — exactly the bug users hit. So we keep playing through transient
  // interruptions and only stop when another media app PERMANENTLY takes over
  // (e.g. the user starts YouTube or a music app).
  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ permanent }) => {
    if (permanent) {
      try { await TrackPlayer.pause(); } catch {}
    }
  });
}
