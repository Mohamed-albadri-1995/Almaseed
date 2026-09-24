import { requireOptionalNativeModule } from 'expo-modules-core';

// null on builds that don't include the native side (older APKs / Expo Go).
export default requireOptionalNativeModule('SafSave');
