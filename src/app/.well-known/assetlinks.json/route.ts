import { NextResponse } from 'next/server';
import { ANDROID_APP } from '@/lib/constants';

// Digital Asset Links: proves to Android that almaseeed.com belongs to the app,
// so tapping https://almaseeed.com/material/… opens the app directly (no
// browser, no chooser). Lists every certificate the app can be signed with:
//   - the upload key (APKs built by our GitHub workflow), and
//   - Google Play's app-signing key (installs from Play) — from Play Console →
//     Test and release → App integrity → App signing → SHA-256, set in Railway as
//     ANDROID_SHA256_CERTS (comma-separated; more than one is fine).
const UPLOAD_KEY_SHA256 = '51:BE:B3:D3:4A:A2:7E:14:2C:A8:F4:22:84:35:FD:C6:53:4E:39:C5:9D:94:FA:F4:AE:FC:34:FD:AB:35:15:E9';

export const dynamic = 'force-dynamic';

export function GET() {
  const certs = Array.from(new Set(
    [UPLOAD_KEY_SHA256, ...(process.env.ANDROID_SHA256_CERTS || '').split(',')]
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(c)),
  ));
  return NextResponse.json(
    [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_APP.packageId, sha256_cert_fingerprints: certs },
    }],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
