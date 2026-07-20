/**
 * シーン03-06: MacBookの中でプロジェクトが進む。
 * AI社員マスコットが横で「操作」しながら、蓋の開閉・画面内UIの進行を
 * しきい値ベースのクラストグルで順次見せる (ionicの積み上げ演出方式)。
 * 開始時は光のベールから現れ、終端はマスコットの飛行シーンへ連続して繋ぐ。
 */

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { segmentProgress } from "../core/sceneProgress";
import {
  applyToggles,
  staggerRanges,
  type ToggleRange,
} from "../core/segmentToggle";
import { TRANSITION_CONFIG } from "./portalTransitionConfig";
import { initStudioMascot } from "./studioMascot";
import {
  STUDIO_PRESENTATIONS,
  studioPresentationAt,
  type StudioSceneId,
} from "./studioPresentation";

const [HEARING, REQUIREMENTS, WORKFLOW, BUILD] = STUDIO_PRESENTATIONS;

// シーン内の区間割り (合計1.0)。各ビューの終わりに「静止区間」を含む
const SEG = {
  lidOpen: { start: 0, end: 0.07 },
  hearing: { start: HEARING.start, end: HEARING.end },
  /*
    蓋が開き切ってから会話を始める。
    開く途中で出し始めると、モックアップが現れた時点で会話が完成して見え、
    やり取りが進んでいく感じが出ない。
  */
  chatItems: { start: 0.085, end: 0.22 },
  requirements: { start: REQUIREMENTS.start, end: REQUIREMENTS.end },
  docLines: { start: 0.3, end: 0.48 },
  workflow: { start: WORKFLOW.start, end: WORKFLOW.end },
  flowNodes: { start: 0.54, end: 0.68 },
  flowPaths: { start: 0.58, end: 0.74 },
  build: { start: BUILD.start, end: BUILD.end }, // 1.01: シーン末尾でも非表示に戻らないように
  appStatus: { start: 0.78 },
  appRows: { start: 0.79, end: 0.9 },
  appToast: { start: 0.91 },
  counters: { start: 0.8, end: 0.93 },
} as const;

const LID_CLOSED_DEG = -89;
const PATH_DASH_LENGTH = 400; // CSSのstroke-dasharrayと合わせる

export interface StudioScene {
  readonly progress: () => number;
  readonly activeSceneId: () => StudioSceneId;
  readonly setMascotVisible: (visible: boolean) => void;
  readonly destroy: () => void;
}

export function initStudioScene(onUpdate?: () => void): StudioScene {
  const section = document.querySelector<HTMLElement>(".js-studio");
  const stage = document.querySelector<HTMLElement>(".js-studio-stage");
  const introSection = document.querySelector<HTMLElement>(".js-intro");
  const lid = document.querySelector<HTMLElement>(".js-macbook-lid");
  if (!section || !stage || !introSection || !lid) {
    throw new Error("StudioScene: 必要なDOM要素が見つかりません");
  }

  const toggles: ToggleRange[] = [];
  const mascot = initStudioMascot();

  // ビューとコピーは同じ区間を共有する。
  const viewSegments: Record<StudioSceneId, { start: number; end: number }> = {
    hearing: SEG.hearing,
    requirements: SEG.requirements,
    workflow: SEG.workflow,
    build: SEG.build,
  };
  for (const [id, seg] of Object.entries(viewSegments)) {
    const view = section.querySelector(`[data-view="${id}"]`);
    const copy = section.querySelector(`[data-copy="${id}"]`);
    if (view) toggles.push({ el: view, ...seg, className: "is-active" });
    if (copy) toggles.push({ el: copy, ...seg });
  }

  // 画面内の順次出現アイテム
  const chatItems = [...section.querySelectorAll(".js-chat-item")];
  toggles.push(
    ...staggerRanges(chatItems, SEG.chatItems.start, SEG.chatItems.end),
  );

  const docLines = [...section.querySelectorAll(".js-doc-line")];
  toggles.push(
    ...staggerRanges(docLines, SEG.docLines.start, SEG.docLines.end),
  );

  const flowNodes = [...section.querySelectorAll(".js-flow-node")];
  toggles.push(
    ...staggerRanges(flowNodes, SEG.flowNodes.start, SEG.flowNodes.end),
  );

  const appRows = [...section.querySelectorAll(".js-app-row")];
  toggles.push(...staggerRanges(appRows, SEG.appRows.start, SEG.appRows.end));

  const appStatus = section.querySelector(".js-dash-status");
  if (appStatus) toggles.push({ el: appStatus, start: SEG.appStatus.start });

  const appToast = section.querySelector(".js-app-toast");
  if (appToast) toggles.push({ el: appToast, start: SEG.appToast.start });

  const flowPaths = [
    ...section.querySelectorAll<SVGPathElement>(".js-flow-path"),
  ];
  const counters = [...section.querySelectorAll<HTMLElement>(".js-counter")];

  /*
    接続線をノードの実位置から引き直す。
    pathを固定座標で持つとノードのサイズや折返しが変わるたびにずれ、
    線が途中で切れたり次のノードへ届かなくなる。
  */
  const flowLines = section.querySelector<SVGSVGElement>(".js-flow-lines");
  const flowNodeElements = [
    ...section.querySelectorAll<HTMLElement>(".js-flow-node"),
  ];
  /** 何番目のノードから何番目へ繋ぐか。 */
  const FLOW_CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ] as const;
  /** 各pathの実長。dasharrayを実長へ合わせないと線が出切らない。 */
  const pathLengths = new Map<SVGPathElement, number>();

  const layoutFlowPaths = () => {
    const container = flowLines?.parentElement;
    if (!flowLines || !container) return;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    if (width === 0 || height === 0) return;

    /*
      MacBookは3D変形の中にあるので、getBoundingClientRectでは変形後の
      座標が返り、変形前を基準にしたSVGのviewBoxと合わない。
      offsetLeft/offsetTopのレイアウト座標を使えば変形の影響を受けない。
    */
    const viewBox = flowLines.viewBox.baseVal;
    const toX = (x: number) => (x / width) * viewBox.width;
    const toY = (y: number) => (y / height) * viewBox.height;
    const boxOf = (el: HTMLElement) => ({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      right: el.offsetLeft + el.offsetWidth,
      bottom: el.offsetTop + el.offsetHeight,
    });

    FLOW_CONNECTIONS.forEach(([fromIndex, toIndex], i) => {
      const path = flowPaths[i];
      const from = flowNodeElements[fromIndex];
      const to = flowNodeElements[toIndex];
      if (!path || !from || !to) return;

      const a = boxOf(from);
      const b = boxOf(to);
      const sameRow = Math.abs(a.top - b.top) < a.height;

      let d: string;
      if (sameRow) {
        // 横並びは端どうしを水平に結ぶ
        const leftToRight = a.left < b.left;
        const x1 = toX(leftToRight ? a.right : a.left);
        const x2 = toX(leftToRight ? b.left : b.right);
        const y = toY(a.top + a.height / 2);
        const mid = (x1 + x2) / 2;
        d = `M${x1.toFixed(1)} ${y.toFixed(1)} C ${mid.toFixed(1)} ${y.toFixed(1)}, ${mid.toFixed(1)} ${y.toFixed(1)}, ${x2.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        // 段が変わるときは下端から上端へ回り込ませる
        const x1 = toX(a.left + a.width / 2);
        const y1 = toY(a.bottom);
        const x2 = toX(b.left + b.width / 2);
        const y2 = toY(b.top);
        const midY = (y1 + y2) / 2;
        d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }

      path.setAttribute("d", d);
      const length = path.getTotalLength();
      pathLengths.set(path, length);
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    });
  };

  let progress = 0;

  const update = (value: number) => {
    progress = value;
    section.dataset.studioProgress = progress.toFixed(4);

    // MacBookの蓋: 閉→開をスクラブ (逆スクロールで閉じ直せる)
    const open = segmentProgress(progress, SEG.lidOpen.start, SEG.lidOpen.end);
    lid.style.transform = `rotateX(${LID_CLOSED_DEG * (1 - open)}deg)`;

    applyToggles(progress, toggles);
    mascot.setProgress(progress, studioPresentationAt(progress));

    // フローの接続線: stroke-dashoffsetを進捗で直接スクラブ
    const pathProgress = segmentProgress(
      progress,
      SEG.flowPaths.start,
      SEG.flowPaths.end,
    );
    flowPaths.forEach((path, i) => {
      const local = segmentProgress(
        pathProgress,
        i / flowPaths.length,
        (i + 1) / flowPaths.length,
      );
      // 実長で割り当てないと、線が最後まで届かないか早く出切ってしまう
      const length = pathLengths.get(path) ?? PATH_DASH_LENGTH;
      path.style.strokeDashoffset = String(length * (1 - local));
    });

    // 処理件数カウンタ: 進捗に比例して数値が育つ
    const countProgress = segmentProgress(
      progress,
      SEG.counters.start,
      SEG.counters.end,
    );
    for (const counter of counters) {
      const target = Number(counter.dataset.target ?? "0");
      counter.textContent = String(Math.round(target * countProgress));
    }

    onUpdate?.();
  };

  const studioPreludeStart = () =>
    Math.max(0, introSection.offsetHeight - window.innerHeight) *
    TRANSITION_CONFIG.studioPreludeStart;

  const trigger = ScrollTrigger.create({
    trigger: introSection,
    start: () => `top+=${studioPreludeStart()} top`,
    endTrigger: section,
    end: "bottom bottom",
    invalidateOnRefresh: true,
    onEnter: () => mascot.setVisible(true),
    // 次の飛行シーン冒頭でも同じマスコットを保持し、posterとの重なり内で引き継ぐ。
    onLeave: () => mascot.setVisible(true),
    onEnterBack: () => mascot.setVisible(true),
    onLeaveBack: () => mascot.setVisible(false),
    onUpdate: (self) => update(self.progress),
  });

  /*
    接続線はノードの実位置から引くので、レイアウトが決まってから計算する。
    画面幅が変わるとノードの折返しも変わるため、リサイズでも引き直す。
  */
  const relayoutFlow = () => {
    layoutFlowPaths();
    update(progress);
  };
  const flowResizeObserver = new ResizeObserver(relayoutFlow);
  const flowContainer = flowLines?.parentElement;
  if (flowContainer) flowResizeObserver.observe(flowContainer);
  layoutFlowPaths();

  // 初回ロード時(リロードで途中位置から始まる場合を含む)に一度だけ状態を反映する
  update(trigger.progress);

  return {
    progress: () => progress,
    activeSceneId: () => studioPresentationAt(progress).id,
    setMascotVisible: (visible) => mascot.setVisible(visible),
    destroy: () => {
      trigger.kill();
      flowResizeObserver.disconnect();
      mascot.destroy();
      delete section.dataset.studioProgress;
    },
  };
}
