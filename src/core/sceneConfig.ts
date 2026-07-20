/**
 * シーン定義 (ionicのシーン管理システム相当のメタ情報)。
 * インジケータ・ナビ・デバッグHUDが参照する唯一の情報源。
 */

export interface SceneMeta {
  id: string;
  label: string;
}

export const SCENES: readonly SceneMeta[] = [
  { id: "hero", label: "はじまり" },
  { id: "tunnel", label: "プロセス" },
  { id: "hearing", label: "ヒアリング" },
  { id: "requirements", label: "要件定義" },
  { id: "workflow", label: "構築" },
  { id: "build", label: "成果" },
  { id: "works", label: "実績" },
  { id: "skills", label: "スキル" },
  { id: "contact", label: "連絡" },
];

export function sceneLabel(id: string): string {
  const scene = SCENES.find((s) => s.id === id);
  return scene ? scene.label : id;
}

const STUDIO_NAVIGATION_SCENES = new Set([
  "hearing",
  "requirements",
  "workflow",
  "build",
]);

/** 4工程は同じStudio導線なので、ヘッダーではヒアリング項目を維持する。 */
export function navigationSceneId(id: string): string {
  return STUDIO_NAVIGATION_SCENES.has(id) ? "hearing" : id;
}
