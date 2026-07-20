import { describe, expect, it } from "vitest";
// テスト実行環境はNodeだが、本番バンドルへ不要な@types/nodeは追加しない。
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { readFileSync } from "node:fs";
import pageHtml from "../../index.html?raw";
import { TRANSITION_CONFIG } from "../scenes/portalTransitionConfig";
import { WORKS_FLIGHT_CONFIG } from "../scenes/worksFlightConfig";

const mainStyles = readFileSync(
  new URL("../styles/main.css", import.meta.url),
  "utf8",
);

/**
 * シーンの高さは3箇所に分散している。
 *   1. *_CONFIG          … 唯一の情報源。main.tsが実行時にCSS変数へ注入する
 *   2. main.cssの:root   … CSS読み込み後・JS実行前のフォールバック
 *   3. index.htmlの<style> … CSS読み込み前のちらつき/レイアウトシフト防止
 * 2と3は初期描画のために静的値である必要があり、1へ集約できない。
 * そのため値の同一性をテストで保証し、設定変更時の取り残しを検出する。
 */
const criticalCss = pageHtml.slice(
  pageHtml.indexOf("<style>"),
  pageHtml.indexOf("</style>"),
);

const cssCustomProperty = (source: string, name: string): string => {
  const matched = source.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!matched) throw new Error(`CSS変数 --${name} が見つかりません`);
  return matched[1].trim();
};

const declaredHeight = (source: string, selector: string): string => {
  const matched = source.match(
    new RegExp(`\\.${selector}\\s*\\{[^}]*?height:\\s*([^;]+);`),
  );
  if (!matched) throw new Error(`.${selector} のheight宣言が見つかりません`);
  return matched[1].trim();
};

describe("シーン長の三箇所同期", () => {
  it("main.cssのフォールバックがTRANSITION_CONFIGと一致する", () => {
    expect(cssCustomProperty(mainStyles, "intro-desktop-length")).toBe(
      `${TRANSITION_CONFIG.desktopLengthVh}vh`,
    );
    expect(cssCustomProperty(mainStyles, "intro-mobile-length")).toBe(
      `${TRANSITION_CONFIG.mobileLengthVh}svh`,
    );
  });

  it("main.cssのフォールバックがWORKS_FLIGHT_CONFIGと一致する", () => {
    expect(cssCustomProperty(mainStyles, "works-flight-desktop-length")).toBe(
      `${WORKS_FLIGHT_CONFIG.desktopLengthVh}vh`,
    );
    expect(cssCustomProperty(mainStyles, "works-flight-mobile-length")).toBe(
      `${WORKS_FLIGHT_CONFIG.mobileLengthSvh}svh`,
    );
  });

  it("index.htmlのクリティカルCSSがPC向け設定値と一致する", () => {
    expect(declaredHeight(criticalCss, "scene-intro")).toBe(
      `${TRANSITION_CONFIG.desktopLengthVh}vh`,
    );
    expect(declaredHeight(criticalCss, "scene-works-flight")).toBe(
      `${WORKS_FLIGHT_CONFIG.desktopLengthVh}vh`,
    );
  });

  it("index.htmlのクリティカルCSSがモバイル向け設定値と一致する", () => {
    // モバイル値はメディアクエリ内にあるため、その範囲へ絞ってから検査する。
    const mobileBlock = criticalCss.slice(
      criticalCss.indexOf("@media (max-width: 820px)"),
    );
    expect(declaredHeight(mobileBlock, "scene-intro")).toBe(
      `${TRANSITION_CONFIG.mobileLengthVh}svh`,
    );
    expect(declaredHeight(mobileBlock, "scene-works-flight")).toBe(
      `${WORKS_FLIGHT_CONFIG.mobileLengthSvh}svh`,
    );
  });

  it("main.tsが実行時にCSS変数を注入し、設定値を最終的な情報源にする", () => {
    const mainSource = readFileSync(
      new URL("../main.ts", import.meta.url),
      "utf8",
    );
    for (const property of [
      "--intro-desktop-length",
      "--intro-mobile-length",
      "--works-flight-desktop-length",
      "--works-flight-mobile-length",
    ]) {
      expect(mainSource).toContain(property);
    }
  });
});
