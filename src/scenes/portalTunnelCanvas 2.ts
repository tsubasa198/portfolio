import {
  canvasProfileForViewport,
  transitionStateAt,
  type CanvasProfile,
} from "./portalTransitionConfig";

interface ParticleSeed {
  readonly angle: number;
  readonly depth: number;
  readonly size: number;
  readonly drift: number;
  readonly phase: number;
}

interface StreakSeed {
  readonly angle: number;
  readonly length: number;
  readonly phase: number;
  readonly width: number;
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 91.731 + salt * 17.113) * 43758.5453;
  return value - Math.floor(value);
}

function createParticles(count: number): ParticleSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: seededUnit(index, 1) * Math.PI * 2,
    depth: seededUnit(index, 2),
    size: 0.6 + seededUnit(index, 3) * 2.8,
    drift: (seededUnit(index, 4) - 0.5) * 0.22,
    phase: seededUnit(index, 5) * Math.PI * 2,
  }));
}

function createStreaks(count: number): StreakSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: seededUnit(index, 7) * Math.PI * 2,
    length: 0.08 + seededUnit(index, 8) * 0.2,
    phase: seededUnit(index, 9),
    width: 0.5 + seededUnit(index, 10) * 1.6,
  }));
}

/**
 * 完成画像の間を埋めるIntro専用Canvas。
 * 画像とは独立した時間軸を持つため、スクロール停止中も空間が呼吸し続ける。
 */
export class PortalTunnelCanvas {
  private readonly context: CanvasRenderingContext2D;
  private readonly particles = createParticles(72);
  private readonly streaks = createStreaks(28);
  private width = 1;
  private height = 1;
  private profile: CanvasProfile = canvasProfileForViewport(1, 1, false);

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("PortalTunnelCanvas: 2D描画を開始できません");
    this.context = context;
  }

  resize(
    width: number,
    height: number,
    devicePixelRatio: number,
    reducedMotion = false,
  ): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.profile = canvasProfileForViewport(
      this.width,
      devicePixelRatio,
      reducedMotion,
    );
    this.canvas.width = Math.round(this.width * this.profile.dpr);
    this.canvas.height = Math.round(this.height * this.profile.dpr);
  }

  render(progress: number, timeMs: number): void {
    const ctx = this.context;
    const state = transitionStateAt(progress);
    ctx.setTransform(this.profile.dpr, 0, 0, this.profile.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.profile.particleCount === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawPortal(
      ctx,
      state.portalCenterX,
      state.approachProgress,
      state.faceProgress,
      state.entryProgress,
      timeMs,
    );
    this.drawAmbientParticles(ctx, state.portalCenterX, progress, timeMs);

    if (progress >= 0.48) {
      const tunnelOpacity = Math.min(1, (progress - 0.48) / 0.17);
      ctx.globalAlpha = tunnelOpacity;
      this.drawTunnelRings(ctx, state.tunnelDepth, state.tunnelSpeed, timeMs);
      this.drawStreaks(ctx, state.tunnelDepth, state.tunnelSpeed, timeMs);
      this.drawTunnelParticles(
        ctx,
        state.tunnelDepth,
        state.tunnelSpeed,
        timeMs,
      );
      this.drawPanels(ctx, state.tunnelDepth, state.tunnelSpeed, timeMs);
    }
    ctx.restore();
  }

  clear(): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawPortal(
    ctx: CanvasRenderingContext2D,
    centerPercent: number,
    approachProgress: number,
    faceProgress: number,
    entryProgress: number,
    timeMs: number,
  ): void {
    if (entryProgress >= 1) return;
    const mobile = this.width <= 820;
    const cx = (centerPercent / 100) * this.width;
    const mobileApproachY = 0.76 + (0.46 - 0.76) * approachProgress;
    const mobileCenterY = mobileApproachY + (0.46 - mobileApproachY) * faceProgress;
    const cy = this.height * (mobile ? mobileCenterY : 0.46);
    const pulse = 1 + Math.sin(timeMs * 0.0017) * 0.025;
    const expansion = 1 + entryProgress * 3.2;
    const rx = Math.min(this.width, this.height) * (mobile ? 0.22 : 0.17);
    const ry = this.height * (mobile ? 0.31 : 0.34);

    for (let index = 0; index < 4; index += 1) {
      const ringScale = pulse * expansion * (0.83 + index * 0.08);
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        rx * ringScale,
        ry * ringScale,
        Math.sin(timeMs * 0.00018 + index) * 0.012,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = `rgba(255, ${156 + index * 18}, ${70 + index * 18}, ${0.2 - index * 0.025})`;
      ctx.lineWidth = 1.2 + (3 - index) * 0.65;
      ctx.shadowBlur = 13 + entryProgress * 22;
      ctx.shadowColor = "rgba(255, 150, 54, 0.8)";
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  private drawAmbientParticles(
    ctx: CanvasRenderingContext2D,
    portalCenterPercent: number,
    progress: number,
    timeMs: number,
  ): void {
    const fade = 1 - Math.min(1, Math.max(0, (progress - 0.45) / 0.2));
    if (fade <= 0) return;
    const centerX = (portalCenterPercent / 100) * this.width;
    const centerY = this.height * 0.47;
    const radius = Math.min(this.width, this.height) * 0.55;

    for (const [index, particle] of this.particles
      .slice(0, this.profile.particleCount)
      .entries()) {
      const drift = timeMs * 0.000035 * (0.6 + particle.depth);
      const angle = particle.angle + drift + particle.drift;
      const orbit = radius * (0.16 + particle.depth * 0.9);
      const x = centerX + Math.cos(angle) * orbit;
      const y = centerY + Math.sin(angle) * orbit * 0.62;
      const flicker = 0.35 + Math.sin(timeMs * 0.002 + particle.phase) * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, ${170 + (index % 4) * 14}, 105, ${fade * flicker})`;
      ctx.fill();
    }
  }

  private drawTunnelRings(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.505;
    const cy = this.height * 0.515;
    const maxRadius = Math.hypot(this.width, this.height) * 0.72;
    const flow = timeMs * 0.00006 * speed + depth * 1.65;

    for (let index = 0; index < this.profile.ringCount; index += 1) {
      const z = (index / this.profile.ringCount + flow) % 1;
      const eased = z * z;
      const radius = 12 + eased * maxRadius;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(timeMs * 0.000025 * (index % 2 === 0 ? 1 : -1));
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.58, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, ${128 + Math.round(z * 85)}, ${48 + Math.round(z * 52)}, ${0.035 + z * 0.17})`;
      ctx.lineWidth = 0.55 + z * 2.4;
      ctx.shadowBlur = 4 + z * 10;
      ctx.shadowColor = "rgba(255, 112, 32, 0.65)";
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  private drawStreaks(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.505;
    const cy = this.height * 0.515;
    const maxRadius = Math.hypot(this.width, this.height) * 0.65;
    const flow = timeMs * 0.00012 * speed + depth * 2.4;

    for (const streak of this.streaks.slice(0, this.profile.streakCount)) {
      const z = (streak.phase + flow) % 1;
      const near = z * z;
      const startRadius = 16 + near * maxRadius * 0.72;
      const endRadius = startRadius + maxRadius * streak.length * (0.25 + z);
      const wobble = Math.sin(timeMs * 0.0005 + streak.phase * 10) * 0.018;
      const angle = streak.angle + wobble;
      const gradient = ctx.createLinearGradient(
        cx + Math.cos(angle) * startRadius,
        cy + Math.sin(angle) * startRadius,
        cx + Math.cos(angle) * endRadius,
        cy + Math.sin(angle) * endRadius,
      );
      gradient.addColorStop(0, "rgba(255, 155, 64, 0)");
      gradient.addColorStop(1, `rgba(255, 222, 164, ${0.14 + z * 0.42})`);
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(angle) * startRadius,
        cy + Math.sin(angle) * startRadius * 0.64,
      );
      ctx.lineTo(
        cx + Math.cos(angle) * endRadius,
        cy + Math.sin(angle) * endRadius * 0.64,
      );
      ctx.strokeStyle = gradient;
      ctx.lineWidth = streak.width * (0.5 + z * 1.8);
      ctx.stroke();
    }
  }

  private drawTunnelParticles(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.505;
    const cy = this.height * 0.515;
    const maxRadius = Math.hypot(this.width, this.height) * 0.62;
    const flow = timeMs * 0.00008 * speed + depth * 1.9;

    for (const particle of this.particles.slice(0, this.profile.particleCount)) {
      const z = (particle.depth + flow) % 1;
      const projected = z * z;
      const angle = particle.angle + Math.sin(timeMs * 0.00025 + particle.phase) * 0.04;
      const radius = 8 + projected * maxRadius;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.62;
      const size = particle.size * (0.35 + projected * 2.1);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, ${150 + Math.round(z * 80)}, 112, ${0.15 + z * 0.52})`;
      ctx.fill();
    }
  }

  private drawPanels(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.505;
    const cy = this.height * 0.515;
    const maxRadius = Math.hypot(this.width, this.height) * 0.48;
    const flow = timeMs * 0.000035 * speed + depth * 0.85;

    for (let index = 0; index < this.profile.panelCount; index += 1) {
      const z = (index / this.profile.panelCount + flow) % 1;
      const angle = index * 2.399 + 0.45;
      const radius = 24 + z * z * maxRadius;
      const width = 22 + z * 90;
      const height = width * 0.58;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.62;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + timeMs * 0.000045 * (index % 2 === 0 ? 1 : -1));
      ctx.strokeStyle = `rgba(255, 189, 110, ${0.06 + z * 0.2})`;
      ctx.fillStyle = `rgba(65, 29, 19, ${0.03 + z * 0.09})`;
      ctx.lineWidth = 0.7 + z * 1.2;
      ctx.beginPath();
      ctx.roundRect(-width / 2, -height / 2, width, height, 5 + z * 7);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
