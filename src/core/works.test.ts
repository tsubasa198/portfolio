import { describe, expect, it } from "vitest";
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { existsSync, readFileSync } from "node:fs";
import pageHtml from "../../index.html?raw";
import { WORKS, findWork, workDetailPath } from "./works";

const detailHtml = (slug: string) =>
  readFileSync(new URL(`../../works/${slug}.html`, import.meta.url), "utf8");

describe("制作実績データ", () => {
  it("識別子が重複しない", () => {
    const slugs = WORKS.map((work) => work.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("サムネイルの配色が重複しない", () => {
    const thumbs = WORKS.map((work) => work.thumb);
    expect(new Set(thumbs).size).toBe(thumbs.length);
  });

  it("詳細ページに必要な項目が揃っている", () => {
    for (const work of WORKS) {
      expect(work.title.length).toBeGreaterThan(0);
      expect(work.lead.length).toBeGreaterThan(0);
      expect(work.sections.length).toBeGreaterThanOrEqual(3);
      expect(work.results.length).toBeGreaterThanOrEqual(1);
      expect(work.chips.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("slugから引ける", () => {
    expect(findWork(WORKS[0].slug)?.title).toBe(WORKS[0].title);
    expect(findWork("存在しない")).toBeUndefined();
  });
});

describe("一覧カードと詳細ページの対応", () => {
  it("最終レイヤーのカードがすべて詳細ページへのリンクになっている", () => {
    const finalLayer = pageHtml.slice(
      pageHtml.indexOf("works-flight-final-layer"),
      pageHtml.indexOf("</main>"),
    );
    // クリックできることが分かるよう、リンク要素として置く
    expect(finalLayer.match(/work-card--link/g)).toHaveLength(WORKS.length);
    for (const work of WORKS) {
      expect(finalLayer).toContain(`href="${workDetailPath(work.slug)}"`);
    }
  });

  it("カードの見出しがデータと一致する", () => {
    for (const work of WORKS) {
      expect(pageHtml).toContain(`<h3>${work.title}</h3>`);
    }
  });

  it.each(WORKS.map((work) => work.slug))(
    "%s の詳細ページが存在する",
    (slug) => {
      expect(
        existsSync(new URL(`../../works/${slug}.html`, import.meta.url)),
      ).toBe(true);
    },
  );

  it("詳細ページの内容がデータと一致する", () => {
    for (const work of WORKS) {
      const html = detailHtml(work.slug);
      expect(html).toContain(work.title);
      expect(html).toContain(work.lead);
      for (const section of work.sections) {
        expect(html).toContain(section.heading);
      }
      for (const result of work.results) {
        expect(html).toContain(result);
      }
    }
  });

  it("詳細ページからトップの実績一覧へ戻れる", () => {
    for (const work of WORKS) {
      expect(detailHtml(work.slug)).toContain('href="/#works"');
    }
  });

  it("詳細ページが次の実績へ循環して繋がる", () => {
    WORKS.forEach((work, index) => {
      const next = WORKS[(index + 1) % WORKS.length];
      expect(detailHtml(work.slug)).toContain(workDetailPath(next.slug));
    });
  });
});
