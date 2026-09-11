// Landing page the app's WebView is redirected to after Google sign-in. The app
// intercepts this URL, reads ?token / ?error, and closes the WebView — so this
// page is only ever seen if opened outside the app.
export const dynamic = 'force-dynamic';

export default function MobileLoginDone({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const ok = !!searchParams.token && !searchParams.error;
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Tahoma, Arial, sans-serif',
        color: '#1f3d33',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>
        {ok ? 'تم تسجيل الدخول' : 'تعذّر تسجيل الدخول'}
      </h1>
      <p style={{ color: '#6b7280', marginTop: 8 }}>
        {ok ? 'يمكنك العودة إلى التطبيق الآن.' : 'أغلق هذه الصفحة وحاول مرة أخرى من التطبيق.'}
      </p>
    </div>
  );
}
