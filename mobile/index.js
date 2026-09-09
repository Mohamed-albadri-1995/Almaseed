import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './service';

// Do not let a JavaScript/native startup problem leave the user permanently
// trapped on the static Android splash screen.
registerRootComponent(App);
setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 1500);

// Register the background playback service used by the audio player.
TrackPlayer.registerPlaybackService(() => PlaybackService);
