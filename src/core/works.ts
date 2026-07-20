/**
 * 制作実績のデータ。
 * トップの一覧カードと詳細ページの両方がここを参照するので、
 * 文言を直すときは1か所で済む。
 *
 * 実体は works.data.json に置いてある。詳細ページを生成するスクリプトは
 * Node から直接そのJSONを読むため、TypeScriptを解釈する仕組みを
 * ビルドへ持ち込まずに済む。
 */

import worksData from "./works.data.json";

export interface WorkDetailSection {
  readonly heading: string;
  readonly body: string;
}

export interface Work {
  /** 詳細ページのファイル名にもなる識別子。 */
  readonly slug: string;
  /** サムネイルの配色バリエーション (work-card__thumb--a 〜 d)。 */
  readonly thumb: "a" | "b" | "c" | "d";
  readonly title: string;
  /** 一覧カードに出す一行説明。 */
  readonly summary: string;
  readonly chips: readonly string[];
  /** 詳細ページの導入文。 */
  readonly lead: string;
  readonly sections: readonly WorkDetailSection[];
  /** 成果を数字で示す。定量化できないものは無理に入れない。 */
  readonly results: readonly string[];
}

export const WORKS = worksData as readonly Work[];

export function findWork(slug: string): Work | undefined {
  return WORKS.find((work) => work.slug === slug);
}

/** 詳細ページのURL。ビルド後も同じ階層に置かれる。 */
export function workDetailPath(slug: string): string {
  return `/works/${slug}.html`;
}
