/**
 * ファーストビューの分解素材をWebPへ変換する。
 *
 * 素材は用途ごとに3種類に分かれる。
 *   screen : 純黒背景の発光素材。CSSのmix-blend-mode:screenで合成する。
 *            screenは result = 1-(1-a)(1-b) なので、背景が完全な黒(0)なら
 *            下のレイヤーがそのまま残り、透過と同じ振る舞いになる。
 *            逆に黒が浮いていると画面全体にモヤが乗るため、変換前に検証する。
 *   alpha  : 本物の透過が必要な素材（発光しない立体物）。
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
/** 球体の芯とみなす輝度下限。黒背景から光球を切り出すために使う。 */
const SPHERE_LUMA_THRESHOLD = Number(process.env.SPHERE_LUMA_THRESHOLD ?? 60);
/** 球体検出でノイズを除外する下限面積(px)。 */
const MIN_SPHERE_AREA = 3000;
/** 切り出し時に球体の外周へ残す余白(px)。発光のにじみを欠けさせない。 */
const SPHERE_PADDING = 8;

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
    src: "2-3.png",
    out: "hero-portal-inner.webp",
    quality: 0.95,
    mode: "screen",
    role: "ポータル内部光",
  },
  {
    src: "2-2.png",
    out: "hero-portal-ring.webp",
    quality: 0.95,
    mode: "screen",
    role: "ポータルリング",
  },
  {
    src: "2-4.png",
    out: "hero-orbit-particles.webp",
    quality: 0.94,
    mode: "screen",
    role: "軌道線・粒子",
  },
  {
    src: "2-5.png",
    out: "hero-platform.webp",
    quality: 0.95,
    mode: "alpha",
    role: "台座",
  },
  {
    src: "2-7.png",
    out: "hero-ui-panel-code.webp",
    quality: 0.95,
    mode: "screen",
    role: "UIパネル(コード)",
  },
  {
    src: "2-6.png",
    out: "hero-ui-panel-chart.webp",
    quality: 0.95,
    mode: "screen",
    role: "UIパネル(グラフ)",
  },
];

/** 2-8はスプライトシートなので、球体を個別に切り出してから変換する。 */
const SPRITE_SHEET = {
  src: "2-8.png",
  quality: 0.94,
  mode: "screen",
  role: "球体",
  /** 面積の降順に並べた検出結果へ、この順で名前を割り当てる。 */
  outputs: [
    "hero-sphere-front-left.webp",
    "hero-sphere-front-right.webp",
    "hero-sphere-small-a.webp",
    "hero-sphere-small-b.webp",
  ],
};

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
    canvas.getContext("2d").drawImage(image, 0, 0);
    const { data } = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);

    const luma = (i) =>
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

    // 四辺の縁を背景のサンプルとみなす
    let edgeLumaSum = 0;
    let edgeLumaMax = 0;
    let edgeCount = 0;
    const inspectPixel = (x, y) => {
      const i = (y * canvas.width + x) * 4;
      const value = luma(i);
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
    let partial = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
      else if (data[i] < 255) partial++;
    }

    return {
      width: canvas.width,
      height: canvas.height,
      edgeLumaAverage: edgeLumaSum / edgeCount,
      edgeLumaMax,
      transparentRatio: transparent / (canvas.width * canvas.height),
      partialRatio: partial / (canvas.width * canvas.height),
    };
  }, dataUrl);
}

/** 素材が仕様を満たしているか検証し、満たさなければ理由を返す。 */
function validateSource(spec, info) {
  if (spec.mode === "screen") {
    if (info.edgeLumaAverage > CHECKERED_SUSPECT_LUMA) {
      return (
        `背景が明るすぎます(平均輝度 ${info.edgeLumaAverage.toFixed(0)})。` +
        `市松模様入りの旧素材のままか、黒背景で書き出されていません。`
      );
    }
    if (info.edgeLumaAverage > MAX_BACKGROUND_LUMA) {
      return (
        `背景の黒が浮いています(平均輝度 ${info.edgeLumaAverage.toFixed(1)}, ` +
        `最大 ${info.edgeLumaMax.toFixed(0)})。screen合成でモヤになります。` +
        `背景を #000000 にして書き出し直してください。`
      );
    }
  }

  if (spec.mode === "alpha") {
    if (info.transparentRatio + info.partialRatio === 0) {
      return (
        `透過がありません(全ピクセル不透明)。` +
        `背景を透明にしたPNGで書き出し直してください。`
      );
    }
  }

  return null;
}

/** Chromiumの中でPNGをWebPへ再エンコードする。透過はcanvasが保持する。 */
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
 * 黒背景の中から光球を輝度で検出し、1つずつ切り出す。
 * 座標をハードコードしないので、スプライトの配置が変わっても追従する。
 */
async function extractSpheres(page, dataUrl, quality, count) {
  return page.evaluate(
    async ({ dataUrl, quality, count, minArea, padding, lumaThreshold }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const { naturalWidth: width, naturalHeight: height } = image;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, width, height);

      const isLit = (index) => {
        const i = index * 4;
        const luma =
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        return luma > lumaThreshold;
      };

      // 幅優先探索で連結成分を求める。再帰だと深さでスタックが尽きる。
      const visited = new Uint8Array(width * height);
      const components = [];

      for (let start = 0; start < visited.length; start++) {
        if (visited[start] || !isLit(start)) continue;

        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let area = 0;
        const queue = [start];
        visited[start] = 1;

        while (queue.length > 0) {
          const index = queue.pop();
          const x = index % width;
          const y = (index - x) / width;
          area++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          const neighbors = [
            x > 0 ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y < height - 1 ? index + width : -1,
          ];
          for (const neighbor of neighbors) {
            if (neighbor < 0 || visited[neighbor] || !isLit(neighbor)) continue;
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }

        if (area >= minArea) {
          components.push({ minX, minY, maxX, maxY, area });
        }
      }

      // 大きいものほど前景向き。上位から必要数だけ切り出す。
      components.sort((a, b) => b.area - a.area);

      return {
        detected: components.length,
        crops: components.slice(0, count).map((component) => {
          const left = Math.max(0, component.minX - padding);
          const top = Math.max(0, component.minY - padding);
          const right = Math.min(width, component.maxX + padding + 1);
          const bottom = Math.min(height, component.maxY + padding + 1);
          const cropWidth = right - left;
          const cropHeight = bottom - top;

          const crop = document.createElement("canvas");
          crop.width = cropWidth;
          crop.height = cropHeight;
          // screen合成前提なので、切り出しの余白は黒で埋める
          const cropContext = crop.getContext("2d");
          cropContext.fillStyle = "#000000";
          cropContext.fillRect(0, 0, cropWidth, cropHeight);
          cropContext.drawImage(
            canvas,
            left,
            top,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight,
          );

          return {
            base64: crop.toDataURL("image/webp", quality).split(",")[1],
            width: cropWidth,
            height: cropHeight,
          };
        }),
      };
    },
    {
      dataUrl,
      quality,
      count,
      minArea: MIN_SPHERE_AREA,
      padding: SPHERE_PADDING,
      lumaThreshold: SPHERE_LUMA_THRESHOLD,
    },
  );
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
      "素材      用途      → 生成物                        品質   変換前 → 変換後",
    );
    console.log("─".repeat(84));

    for (const spec of [...ASSET_SPECS, SPRITE_SHEET]) {
      const srcPath = join(SRC_DIR, spec.src);
      if (!existsSync(srcPath)) {
        missing.push(`${spec.src} (${spec.role})`);
        continue;
      }

      const dataUrl = toDataUrl(srcPath);
      const info = await inspectSource(page, dataUrl);
      const problem = validateSource(spec, info);
      if (problem) {
        problems.push(`${spec.src} (${spec.role}): ${problem}`);
        continue;
      }

      const sourceSize = statSync(srcPath).size;
      totalSource += sourceSize;

      // スプライトシートは切り出してから個別に書き出す
      if (spec === SPRITE_SHEET) {
        const { detected, crops } = await extractSpheres(
          page,
          dataUrl,
          spec.quality,
          spec.outputs.length,
        );
        if (crops.length < spec.outputs.length) {
          problems.push(
            `${spec.src}: 球体の検出数が足りません(検出${detected} / 必要${spec.outputs.length})。` +
              `SPHERE_LUMA_THRESHOLD環境変数で閾値を調整できます。`,
          );
          continue;
        }
        crops.forEach((crop, index) => {
          const out = spec.outputs[index];
          const buffer = Buffer.from(crop.base64, "base64");
          writeFileSync(join(OUT_DIR, out), buffer);
          totalOutput += buffer.length;
          console.log(
            `${spec.src.padEnd(9)} ${"screen".padEnd(9)} → ${out.padEnd(28)} ${spec.quality} ${`${crop.width}x${crop.height}`.padStart(9)} → ${formatKb(buffer.length).padStart(6)}`,
          );
        });
        continue;
      }

      const buffer = await encodeWebp(page, dataUrl, spec.quality);
      writeFileSync(join(OUT_DIR, spec.out), buffer);
      totalOutput += buffer.length;
      console.log(
        `${spec.src.padEnd(9)} ${spec.mode.padEnd(9)} → ${spec.out.padEnd(28)} ${spec.quality} ${formatKb(sourceSize).padStart(9)} → ${formatKb(buffer.length).padStart(6)}`,
      );
    }

    console.log("─".repeat(84));

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
        `\n✅ ${mb(totalSource)} → ${mb(totalOutput)} ` +
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
