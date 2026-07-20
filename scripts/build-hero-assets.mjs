/**
 * ファーストビューの分解素材をWebPへ変換する。
 *
 * 素材は用途ごとに3種類に分かれる。
 *   screen : 純黒背景の発光素材。CSSのmix-blend-mode:screenで合成する。
 *            screenは result = 1-(1-a)(1-b) なので、背景が完全な黒(0)なら
 *            下のレイヤーがそのまま残り、透過と同じ振る舞いになる。
 *            逆に黒が浮いていると画面全体にモヤが乗るため、変換前に検証する。
 *   matte  : 黒背景で届いた非発光の立体物。screenだと暗部が浮いて金属感が
 *            失われるので、シルエットを塗りつぶしてアルファを作る。
 *   opaque : 最背面に敷く不透明な背景。
 *
 * Playwright付属のChromiumをエンコーダとして使うため、画像処理用の
 * npm依存もネットワークアクセスも追加していない。素材を差し替えたら
 * このスクリプトを再実行すれば生成物が作り直される。
 *
 * 実行:
 *   node scripts/build-hero-assets.mjs
 *
 * playwrightがプロジェクト外にある場合は環境変数で場所を渡せる:
 *   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/build-hero-assets.mjs
 */

import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(PROJECT_ROOT, "画像", "ファーストビューの画像");
const OUT_DIR = join(PROJECT_ROOT, "public", "assets", "hero");

/** screen素材の背景として許容する最大輝度。これを超えると合成時にモヤになる。 */
const MAX_BACKGROUND_LUMA = 12;
/** 市松模様入りの旧素材を検出する閾値。背景がこれより明るければ差し替え漏れ。 */
const CHECKERED_SUSPECT_LUMA = 120;
/** matte素材でシルエットの内側とみなす輝度下限。 */
const MATTE_LUMA_THRESHOLD = 14;
/** シルエット境界をなめらかにするぼかし半径(px)。 */
const MATTE_FEATHER_RADIUS = 2;

/**
 * 目立つ要素ほど高品質にする。背景は暗いグラデーションが主体で劣化が
 * 視認されないため低めに寄せ、容量を稼ぐ。screen素材は黒が浮くと
 * 直接モヤになるため高品質側へ倒す。
 */
const ASSET_SPECS = [
  {
    src: "2-9.png",
    out: "hero-background.webp",
    quality: 0.9,
    mode: "opaque",
    role: "背景・床の反射",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_08 (2).png",
    out: "hero-portal.webp",
    quality: 0.95,
    mode: "screen",
    role: "ポータル(リング+内部光)",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_08 (3).png",
    out: "hero-platform.webp",
    quality: 0.95,
    mode: "matte",
    role: "台座",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_08 (4).png",
    out: "hero-orbit-particles.webp",
    quality: 0.94,
    mode: "screen",
    role: "軌道線・粒子",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_09 (5).png",
    out: "hero-ui-panel-code-tilted.webp",
    quality: 0.95,
    mode: "screen",
    role: "UIパネル(コード・傾き)",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_09 (6).png",
    out: "hero-ui-panel-chart.webp",
    quality: 0.95,
    mode: "screen",
    role: "UIパネル(グラフ)",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_09 (7).png",
    out: "hero-ui-panel-code.webp",
    quality: 0.95,
    mode: "screen",
    role: "UIパネル(コード・正面)",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_09 (8).png",
    out: "hero-sphere-bright.webp",
    quality: 0.94,
    mode: "screen",
    role: "光球(明るい)",
  },
  {
    src: "ChatGPT Image 2026年7月20日 18_15_10 (9).png",
    out: "hero-sphere-glass.webp",
    quality: 0.94,
    mode: "screen",
    role: "光球(ガラス質)",
  },
];

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

const toDataUrl = (path) =>
  `data:image/png;base64,${readFileSync(path).toString("base64")}`;

const formatKb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

/** 素材が用途どおりの体裁になっているかをChromium内で調べる。 */
async function inspectSource(page, dataUrl) {
  return page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

    const luma = (i) =>
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

    let edgeLumaSum = 0;
    let edgeLumaMax = 0;
    let edgeCount = 0;
    const inspectPixel = (x, y) => {
      const value = luma((y * canvas.width + x) * 4);
      edgeLumaSum += value;
      if (value > edgeLumaMax) edgeLumaMax = value;
      edgeCount++;
    };
    for (let x = 0; x < canvas.width; x += 4) {
      inspectPixel(x, 0);
      inspectPixel(x, canvas.height - 1);
    }
    for (let y = 0; y < canvas.height; y += 4) {
      inspectPixel(0, y);
      inspectPixel(canvas.width - 1, y);
    }

    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) transparent++;
    }

    return {
      width: canvas.width,
      height: canvas.height,
      edgeLumaAverage: edgeLumaSum / edgeCount,
      edgeLumaMax,
      alphaRatio: transparent / (canvas.width * canvas.height),
    };
  }, dataUrl);
}

/** 素材が仕様を満たしているか検証し、満たさなければ理由を返す。 */
function validateSource(spec, info) {
  if (spec.mode === "screen" || spec.mode === "matte") {
    if (info.edgeLumaAverage > CHECKERED_SUSPECT_LUMA) {
      return (
        `背景が明るすぎます(平均輝度 ${info.edgeLumaAverage.toFixed(0)})。` +
        `市松模様入りの旧素材のままか、黒背景で書き出されていません。`
      );
    }
    if (info.edgeLumaAverage > MAX_BACKGROUND_LUMA) {
      return (
        `背景の黒が浮いています(平均輝度 ${info.edgeLumaAverage.toFixed(1)}, ` +
        `最大 ${info.edgeLumaMax.toFixed(0)})。背景を #000000 にして書き出し直してください。`
      );
    }
  }
  return null;
}

/** Chromiumの中でPNGをWebPへ再エンコードする。 */
async function encodeWebp(page, dataUrl, quality) {
  const base64 = await page.evaluate(
    async ({ dataUrl, quality }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", quality).split(",")[1];
    },
    { dataUrl, quality },
  );
  return Buffer.from(base64, "base64");
}

/**
 * 黒背景の立体物からアルファを作る。
 * 輝度だけでアルファにすると暗い金属部分が透けてしまうため、
 * シルエットの輪郭を求めて内側を一様に不透明で塗りつぶす。
 */
async function encodeMatte(page, dataUrl, quality) {
  const result = await page.evaluate(
    async ({ dataUrl, quality, lumaThreshold, featherRadius }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const w = image.naturalWidth;
      const h = image.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, w, h);
      const d = imageData.data;

      const lit = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        lit[p] = luma > lumaThreshold ? 1 : 0;
      }

      // 画像の外周から到達できる黒だけを「外側」とする。
      // 到達しない黒は物体内部の陰影なので不透明のまま残す。
      const outside = new Uint8Array(w * h);
      const stack = [];
      const pushIfDark = (x, y) => {
        const p = y * w + x;
        if (!outside[p] && !lit[p]) {
          outside[p] = 1;
          stack.push(p);
        }
      };
      for (let x = 0; x < w; x++) {
        pushIfDark(x, 0);
        pushIfDark(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        pushIfDark(0, y);
        pushIfDark(w - 1, y);
      }
      while (stack.length > 0) {
        const p = stack.pop();
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) pushIfDark(x - 1, y);
        if (x < w - 1) pushIfDark(x + 1, y);
        if (y > 0) pushIfDark(x, y - 1);
        if (y < h - 1) pushIfDark(x, y + 1);
      }

      // シルエット(外側でない領域)を不透明にする
      const alpha = new Float32Array(w * h);
      let solidCount = 0;
      for (let p = 0; p < w * h; p++) {
        alpha[p] = outside[p] ? 0 : 1;
        if (!outside[p]) solidCount++;
      }

      // 境界のジャギーを均すため、アルファだけを軽くぼかす
      const blurred = new Float32Array(w * h);
      const temp = new Float32Array(w * h);
      const r = featherRadius;
      const span = r * 2 + 1;
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = -r; x <= r; x++)
          sum += alpha[y * w + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          temp[y * w + x] = sum / span;
          sum +=
            alpha[y * w + Math.min(w - 1, x + r + 1)] -
            alpha[y * w + Math.max(0, x - r)];
        }
      }
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -r; y <= r; y++)
          sum += temp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          blurred[y * w + x] = sum / span;
          sum +=
            temp[Math.min(h - 1, y + r + 1) * w + x] -
            temp[Math.max(0, y - r) * w + x];
        }
      }

      for (let p = 0; p < w * h; p++) {
        d[p * 4 + 3] = Math.round(Math.min(1, blurred[p]) * 255);
      }
      context.putImageData(imageData, 0, 0);

      return {
        base64: canvas.toDataURL("image/webp", quality).split(",")[1],
        solidRatio: solidCount / (w * h),
      };
    },
    {
      dataUrl,
      quality,
      lumaThreshold: MATTE_LUMA_THRESHOLD,
      featherRadius: MATTE_FEATHER_RADIUS,
    },
  );
  return {
    buffer: Buffer.from(result.base64, "base64"),
    solidRatio: result.solidRatio,
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const problems = [];
  const missing = [];
  let totalSource = 0;
  let totalOutput = 0;

  try {
    const page = await browser.newPage();
    await page.goto("about:blank");

    console.log(
      "用途     素材の役割              → 生成物                             品質   変換前 → 変換後",
    );
    console.log("─".repeat(100));

    for (const spec of ASSET_SPECS) {
      const srcPath = join(SRC_DIR, spec.src);
      if (!existsSync(srcPath)) {
        missing.push(`${spec.role} (${spec.src})`);
        continue;
      }

      const dataUrl = toDataUrl(srcPath);
      const info = await inspectSource(page, dataUrl);
      const problem = validateSource(spec, info);
      if (problem) {
        problems.push(`${spec.role} (${spec.src}): ${problem}`);
        continue;
      }

      const sourceSize = statSync(srcPath).size;
      totalSource += sourceSize;

      let buffer;
      let note = "";
      if (spec.mode === "matte") {
        const matte = await encodeMatte(page, dataUrl, spec.quality);
        buffer = matte.buffer;
        note = ` シルエット${(matte.solidRatio * 100).toFixed(0)}%`;
      } else {
        buffer = await encodeWebp(page, dataUrl, spec.quality);
      }

      writeFileSync(join(OUT_DIR, spec.out), buffer);
      totalOutput += buffer.length;
      console.log(
        `${spec.mode.padEnd(8)} ${spec.role.padEnd(22)} → ${spec.out.padEnd(34)} ${spec.quality} ${formatKb(sourceSize).padStart(8)} → ${formatKb(buffer.length).padStart(6)}${note}`,
      );
    }

    console.log("─".repeat(100));

    if (missing.length > 0) {
      console.log("\n⏳ 未配置の素材:");
      missing.forEach((item) => console.log(`   - ${item}`));
    }

    if (problems.length > 0) {
      console.log("\n❌ 仕様を満たしていない素材:");
      problems.forEach((item) => console.log(`   - ${item}`));
      console.log(
        "\n仕様を満たす素材へ差し替えてから再実行してください。" +
          "旧素材から自動生成した中途半端な画像は採用しません。",
      );
      process.exitCode = 1;
      return;
    }

    if (totalOutput > 0) {
      const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;
      console.log(
        `\n✅ ${ASSET_SPECS.length}ファイル  ${mb(totalSource)} → ${mb(totalOutput)} ` +
          `(-${(((totalSource - totalOutput) / totalSource) * 100).toFixed(0)}%)`,
      );
      console.log(`出力先: ${OUT_DIR}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("素材の生成に失敗しました:", error.message);
  process.exit(1);
});
