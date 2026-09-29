export default function NotFound() {
  return (
    <main id="main" className="wrap">
      <section className="page-heading">
        <p className="eyebrow">404</p>
        <h1 className="long-title">ページが見つかりません</h1>
      </section>
      <p>URLをご確認いただくか、トップページへお戻りください。</p>
      <p style={{ marginTop: "2rem", marginBottom: "4rem" }}>
        <a className="pill-link" href="/index.html">
          トップページへ <span aria-hidden="true">↗</span>
        </a>
      </p>
    </main>
  );
}
