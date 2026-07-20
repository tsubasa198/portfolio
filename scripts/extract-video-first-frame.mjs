/**
 * ファーストビュー動画の「ブラウザが最初に描画するフレーム」を抽出する。
 *
 * ハンドオフの位置合わせでは、動画ファイルの0秒ではなく実際に画面へ出る
 * フレームが唯一の基準になる。requestVideoFrameCallback で最初のデコード済み
 * フレームを待ってから取り込む。
 *
 * 生成物は位置合わせと検証、および動画のposterに使う。
 *
 * 実行:
 *   node scripts/extract-video-first-frame.mjs
 */

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(PROJECT_ROOT, "public", "assets", "hero");
const OUT_FILE = "hero-video-first-frame.webp";

/**
 * 実際のページを開き、そこで使われている動画要素からフレームを取り込む。
 * about:blankへ別途読み込むとオリジンが異なりcanvasが汚染されるうえ、
 * ページ側と同じデコード結果である保証もない。
 */
const PAGE_URL = process.env.HERO_PAGE_URL ?? "http://localhost:5199";
const VIDEO_SELECTOR = ".js-portal-video";
/** posterや位置合わせに使うため、劣化が判別できない品質で保存する。 */
const QUALITY = 0.95;

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    join(
      process.env.HOME ?? "",
      ".claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill/node_modules/playwright",
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // 次の候補を試す
    }
  }
  throw new Error(
    "playwrightが見つかりません。PLAYWRIGHT_MODULE環境変数でパスを指定してください。",
  );
}

async function main() {
  const { chromium } = loadPlaywright();
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // ページ側の初期化が動画のsrc設定と読み込み完了まで面倒を見る
    await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(
      () => document.body.dataset.portalMedia === "ready",
      { timeout: 60000 },
    );

    const result = await page.evaluate(
      async ({ selector, quality }) => {
        const video = document.querySelector(selector);
        if (!video) throw new Error(`${selector} が見つかりません`);
        if (!video.videoWidth) throw new Error("動画の解像度を取得できません");

        // ブラウザが最初に見せるのは0秒のフレーム
        video.currentTime = 0;

        await new Promise((resolve, reject) => {
          const done = () => resolve(undefined);
          if ("requestVideoFrameCallback" in video) {
            // デコード済みフレームが実際に描画可能になるのを待つ
            video.requestVideoFrameCallback(done);
            // seekだけではコールバックが来ない環境があるため保険を置く
            video.addEventListener(
              "seeked",
              () => {
                setTimeout(done, 120);
              },
              { once: true },
            );
          } else {
            video.addEventListener("seeked", () => setTimeout(done, 120), {
              once: true,
            });
          }
          setTimeout(
            () => reject(new Error("フレーム描画がタイムアウト")),
            20000,
          );
        });

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);

        return {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          base64: canvas.toDataURL("image/webp", quality).split(",")[1],
        };
      },
      { selector: VIDEO_SELECTOR, quality: QUALITY },
    );

    const buffer = Buffer.from(result.base64, "base64");
    writeFileSync(join(OUT_DIR, OUT_FILE), buffer);

    console.log("動画の先頭フレームを抽出しました");
    console.log(`  解像度: ${result.width}x${result.height}`);
    console.log(`  尺    : ${result.duration.toFixed(2)}秒`);
    console.log(`  品質  : ${QUALITY}`);
    console.log(
      `  出力  : ${join(OUT_DIR, OUT_FILE)} (${(buffer.length / 1024).toFixed(0)}KB)`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("先頭フレームの抽出に失敗しました:", error.message);
  console.error(
    "開発サーバー(localhost:5199)が起動しているか確認してください。",
  );
  process.exit(1);
});
