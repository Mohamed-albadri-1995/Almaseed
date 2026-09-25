// Syntax check for the app's JavaScript (no bundler needed): a typo in
// mobile/App.js would otherwise only surface in the 10-minute APK build.
import { readFileSync, readdirSync } from 'fs';
import ts from 'typescript';

const files = [
  ...readdirSync('mobile').filter((f) => f.endsWith('.js')).map((f) => `mobile/${f}`),
  'mobile/modules/saf-save/index.js',
];
let bad = 0;
for (const f of files) {
  const r = ts.transpileModule(readFileSync(f, 'utf8'), {
    reportDiagnostics: true, fileName: f, compilerOptions: { jsx: ts.JsxEmit.React, allowJs: true },
  });
  for (const d of r.diagnostics ?? []) {
    bad++;
    const { line } = d.file ? d.file.getLineAndCharacterOfPosition(d.start ?? 0) : { line: 0 };
    console.error(`${f}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  }
}
console.log(bad ? `✗ ${bad} syntax error(s)` : `✓ ${files.length} app files OK`);
process.exit(bad ? 1 : 0);
