import TrackPlayer, { Event } from 'react-native-track-player';

// Handles the media controls the OS shows in the notification shade / lock
// screen (and headset buttons). Runs in a background service registered from
// index.js.
export async function PlaybackService() {
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
}
