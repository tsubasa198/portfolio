/**
 * 制作実績の詳細ページを src/core/works.ts のデータから生成する。
 *
 * 文言をHTMLへ直接書くと、トップの一覧カードと詳細ページで内容がずれる。
 * データを唯一の出所にして、ページはそこから組み立てる。
 *
 * 実行:
 *   node scripts/build-work-pages.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(PROJECT_ROOT, "works");

/**
 * 実績データを読む。
 * works.ts と同じJSONを見るので、一覧カードと詳細ページで内容がずれない。
 */
function loadWorks() {
  const json = readFileSync(
    join(PROJECT_ROOT, "src", "core", "works.data.json"),
    "utf8",
  );
  const works = JSON.parse(json);
  if (!Array.isArray(works) || works.length === 0) {
    throw new Error("works.data.json から実績を読み取れませんでした");
  }
  return works;
}

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderPage(work, works) {
  const index = works.findIndex((w) => w.slug === work.slug);
  const next = works[(index + 1) % works.length];

  const sections = work.sections
    .map(
      (section) => `        <section class="work-detail__block">
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </section>`,
    )
    .join("\n");

  const results = work.results
    .map((result) => `            <li>${escapeHtml(result)}</li>`)
    .join("\n");

  const chips = work.chips
    .map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`)
    .join("");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(work.summary)}" />
    <title>${escapeHtml(work.title)} | T.KITAOKA</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <script type="module" src="/src/works.ts"></script>
  </head>
  <body class="work-detail-page">
    <header class="site-header">
      <a class="site-header__logo" href="/">TSUBASA's PORTFOLIO</a>
      <a class="site-header__cta" href="/#contact">お問い合わせ</a>
    </header>

    <main class="work-detail">
      <div class="work-detail__inner">
        <a class="work-detail__back" href="/#works">← 制作実績一覧へ戻る</a>

        <p class="work-detail__eyebrow">WORKS</p>
        <h1 class="work-detail__title">${escapeHtml(work.title)}</h1>
        <p class="work-detail__lead">${escapeHtml(work.lead)}</p>
        <div class="scene-copy__chips">${chips}</div>

        <div
          class="work-detail__hero work-card__thumb--${work.thumb}"
          aria-hidden="true"
        ></div>

${sections}

        <section class="work-detail__block">
          <h2>成果</h2>
          <ul class="work-detail__results">
${results}
          </ul>
        </section>

        <nav class="work-detail__nav">
          <a class="work-detail__next" href="/works/${next.slug}.html">
            次の実績 → ${escapeHtml(next.title)}
          </a>
          <a class="contact-cta" href="/#contact">お問い合わせはこちら →</a>
        </nav>
      </div>
    </main>

    <footer class="footer">
      <p>© 2026 T.KITAOKA — AI Engineer Portfolio</p>
    </footer>
  </body>
</html>
`;
}

function main() {
  const works = loadWorks();
  mkdirSync(OUT_DIR, { recursive: true });

  for (const work of works) {
    const html = renderPage(work, works);
    writeFileSync(join(OUT_DIR, `${work.slug}.html`), html);
    console.log(`  works/${work.slug}.html  ${work.title}`);
  }
  console.log(`\n${works.length}件の詳細ページを生成しました`);
}

main();
