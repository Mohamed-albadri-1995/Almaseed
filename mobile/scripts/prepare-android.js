const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'App.js');
let src = fs.readFileSync(file, 'utf8');

// expo-av conflicts with expo-video on Android in some Expo 51 builds.
src = src.replace(/import \{ Audio \} from 'expo-av';\n?/, '');

fs.writeFileSync(file, src);
console.log('Almaseed Android preparation applied.');
