import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './service';

// Register the app root and the background playback service that keeps audio
// (and its notification/lock-screen controls) alive when the app is backgrounded.
registerRootComponent(App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
