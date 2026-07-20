/**
 * AI社員マスコット (もくもくした雲型キャラクター) のSVGファクトリ。
 * REZENT風の「かわいいAI社員」世界観の中心部品。
 * XSSシンク(innerHTML等)を避け、createElementNSでDOMを直接構築する。
 */

export type MascotVariant = "sky" | "lavender" | "mint" | "peach" | "cream";

const VARIANT_COLORS: Record<MascotVariant, string> = {
  sky: "#a9c8ff",
  lavender: "#c9b8ff",
  mint: "#a8f0dc",
  peach: "#ffd3b8",
  // ヒーローのAI生成アートワーク(暖色)と調和する色
  cream: "#ffe7c8",
};

const SVG_NS = "http://www.w3.org/2000/svg";
const FACE_DARK = "#232537";
const BLUSH_PINK = "#ff9fb0";

type Attrs = Record<string, string>;

function svgEl(tag: string, attrs: Attrs): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/** 体を構成する円の配置 (cx, cy, r) */
const BODY_CIRCLES: ReadonlyArray<[number, number, number]> = [
  [36, 64, 24],
  [84, 64, 24],
  [44, 42, 22],
  [76, 42, 22],
  [60, 58, 34],
];

export function createMascot(
  variant: MascotVariant,
  extraClass = "",
): SVGElement {
  const color = VARIANT_COLORS[variant];
  const svg = svgEl("svg", { viewBox: "0 0 120 112", "aria-hidden": "true" });
  svg.setAttribute("class", `mascot ${extraClass}`.trim());

  const body = svgEl("g", { class: "mascot__body" });

  // 足元の影
  body.appendChild(
    svgEl("ellipse", {
      cx: "60",
      cy: "104",
      rx: "30",
      ry: "6",
      fill: "rgba(0,0,0,0.25)",
      class: "mascot__shadow",
    }),
  );
  // 両腕
  body.appendChild(
    svgEl("ellipse", { cx: "18", cy: "74", rx: "10", ry: "8", fill: color }),
  );
  body.appendChild(
    svgEl("ellipse", { cx: "102", cy: "74", rx: "10", ry: "8", fill: color }),
  );
  // もくもくボディ
  for (const [cx, cy, r] of BODY_CIRCLES) {
    body.appendChild(
      svgEl("circle", {
        cx: String(cx),
        cy: String(cy),
        r: String(r),
        fill: color,
      }),
    );
  }
  // 目 (ハイライト付き)
  body.appendChild(
    svgEl("circle", { cx: "48", cy: "58", r: "5.5", fill: FACE_DARK }),
  );
  body.appendChild(
    svgEl("circle", { cx: "72", cy: "58", r: "5.5", fill: FACE_DARK }),
  );
  body.appendChild(
    svgEl("circle", { cx: "50", cy: "56", r: "2", fill: "#ffffff" }),
  );
  body.appendChild(
    svgEl("circle", { cx: "74", cy: "56", r: "2", fill: "#ffffff" }),
  );
  // ほっぺ
  body.appendChild(
    svgEl("circle", {
      cx: "38",
      cy: "68",
      r: "5",
      fill: BLUSH_PINK,
      opacity: "0.6",
    }),
  );
  body.appendChild(
    svgEl("circle", {
      cx: "82",
      cy: "68",
      r: "5",
      fill: BLUSH_PINK,
      opacity: "0.6",
    }),
  );
  // 口
  body.appendChild(
    svgEl("path", {
      d: "M54 68 Q60 74 66 68",
      stroke: FACE_DARK,
      "stroke-width": "2.4",
      "stroke-linecap": "round",
      fill: "none",
    }),
  );

  svg.appendChild(body);
  return svg;
}

/** コンテナ要素にマスコットを追加する */
export function mountMascot(
  container: Element | null,
  variant: MascotVariant,
  extraClass = "",
): void {
  if (!container) return;
  container.appendChild(createMascot(variant, extraClass));
}
