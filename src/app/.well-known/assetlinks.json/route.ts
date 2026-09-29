import { NextResponse } from 'next/server';
import { ANDROID_APP } from '@/lib/constants';

// Digital Asset Links: proves to Android that almaseeed.com belongs to the app,
// so tapping https://almaseeed.com/material/… opens the app directly (no
// browser, no chooser). Lists every certificate the app can be signed with:
//   - the upload key (APKs built by our GitHub workflow), and
//   - Google Play's app-signing keys (installs from Play), from the
//     certificates Play Console provides (deployment + hybrid classical).
// More can be added without a code change via ANDROID_SHA256_CERTS in Railway
// (comma-separated).
const KNOWN_CERTS = [
  // Upload key
  '51:BE:B3:D3:4A:A2:7E:14:2C:A8:F4:22:84:35:FD:C6:53:4E:39:C5:9D:94:FA:F4:AE:FC:34:FD:AB:35:15:E9',
  // Play app signing — deployment certificate
  '62:81:69:AA:5C:CD:75:0E:15:98:B8:B9:FF:C8:12:BC:F8:B0:F9:79:CD:4F:B8:2E:35:B6:B6:3A:2E:15:CC:5F',
  // Play app signing — hybrid classical certificate
  '25:C5:8A:20:61:F7:8C:B7:59:A9:7B:23:FF:B6:13:93:D4:0D:11:47:1F:64:20:7B:56:65:52:FE:14:CD:68:3C',
];

export const dynamic = 'force-dynamic';

export function GET() {
  const certs = Array.from(new Set(
    [...KNOWN_CERTS, ...(process.env.ANDROID_SHA256_CERTS || '').split(',')]
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
