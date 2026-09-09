import TrackPlayer, { Event, State } from 'react-native-track-player';

// Handles the media controls the OS shows in the notification shade / lock
// screen (and headset buttons). Runs in a background service registered from
// index.js.
export async function PlaybackService() {
  let pausedByInterruption = false;

  // Keep the player alive when the app UI is removed from recent apps.
  // Temporary audio-focus interruptions are handled separately below.
  try {
    await TrackPlayer.updateOptions({
      android: { appKilledPlaybackBehavior: 'ContinuePlayback' },
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

  // Android can temporarily take audio focus when another app starts audio.
  // Pause only for a transient interruption and resume when focus returns.
  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused, permanent }) => {
    if (permanent) {
      pausedByInterruption = false;
      return;
    }

    if (paused) {
      const state = await TrackPlayer.getState();
      pausedByInterruption = state === State.Playing || state === State.Buffering;
      if (pausedByInterruption) await TrackPlayer.pause();
    } else if (pausedByInterruption) {
      pausedByInterruption = false;
      await TrackPlayer.play();
    }
  });
}
