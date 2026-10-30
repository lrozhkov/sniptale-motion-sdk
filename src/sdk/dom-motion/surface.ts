import { evaluateTimelineKeyframes } from "../timeline/keyframe-value.js";
import { createDomMotionWorld } from "./world.js";
import { createDomMotionScrollbars } from "./scrollbars.js";
import { renderDomMotionBackgrounds } from "./appearance.js";
import { readDomMotionPose } from "./pose.js";
import type { TimelineTrack } from "../types.js";
import {
  buildDomMotionParts,
  restoreDomMotionPart,
  type DomMotionPart,
} from "./elements.js";
import { prepareDomMotionMarkup } from "./markup.js";
import {
  parseDomMotionDocument,
  parseDomMotionTimeline,
} from "./validation.js";

export function createDomMotionSurface(host: HTMLElement, input: unknown) {
  const document = parseDomMotionDocument(input);
  const owner = host.ownerDocument;
  const element = owner.createElement("div");
  element.dataset.domMotionSurface = document.id;
  Object.assign(element.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    background: "#161c29",
  });
  const fit = owner.createElement("div");
  Object.assign(fit.style, {
    position: "absolute",
    width: `${document.width}px`,
    height: `${document.height}px`,
    transformOrigin: "0 0",
    perspective: "none",
  });
  const camera = owner.createElement("div");
  Object.assign(camera.style, {
    width: `${document.width}px`,
    height: `${document.height}px`,
    transformOrigin: "50% 50%",
  });
  const frame = owner.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.title = document.label.ru;
  Object.assign(frame.style, {
    display: "block",
    border: "0",
    width: `${document.width}px`,
    height: `${document.height}px`,
    background: "white",
  });
  camera.append(frame);
  fit.append(camera);
  element.append(fit);
  host.append(element);
  let disposed = false;
  let loaded = false;
  let parts: DomMotionPart[] = [];
  let world: ReturnType<typeof createDomMotionWorld> | null = null;
  let scrollbars: ReturnType<typeof createDomMotionScrollbars> | null = null;

  let tracks = new Map<string, TimelineTrack>();
  let duration = document.duration;
  const targets = new Set(["page", ...document.bindings.map((b) => b.id)]);

  let visibleTargets = new Set(targets);
  const observedTracks = new Set<string>();
  const observedTargets = new Set<string>();
  function setVisibleTargets(value: unknown) {
    if (
      !Array.isArray(value) ||
      value.length > targets.size ||
      value.some((id) => typeof id !== "string" || !targets.has(id))
    )
      throw new Error("Invalid DOM motion visible targets");
    visibleTargets = new Set(value);
  }
  function setTimeline(value: unknown, nextDuration: number = duration) {
    if (
      !Number.isFinite(nextDuration) ||
      nextDuration < 0.1 ||
      nextDuration > 300
    )
      throw new Error("Invalid DOM motion duration");
    const timeline = parseDomMotionTimeline(value, nextDuration, targets);
    tracks = new Map(
      timeline.tracks
        .filter((t) => t.enabled !== false)
        .map((t) => [
          t.id,
          { ...t, keyframes: t.keyframes.filter((k) => k.enabled !== false) },
        ]),
    );

    duration = nextDuration;
  }
  setTimeline(document.timeline);
  const read = (
    target: string,
    property: string,
    time: number,
    fallback: number,
  ) => {
    const id = `${target}.${property}`;
    if (tracks.has(id)) observedTracks.add(id);
    return evaluateTimelineKeyframes(
      tracks.get(id)?.keyframes ?? [],
      time,
      fallback,
    );
  };
  function resize() {
    const scale = Math.min(
      host.clientWidth / document.width,
      host.clientHeight / document.height,
    );
    fit.style.left = `${Math.round((host.clientWidth - document.width * scale) / 2)}px`;
    fit.style.top = `${Math.round((host.clientHeight - document.height * scale) / 2)}px`;
    fit.style.transform = scale === 1 ? "none" : `scale(${scale})`;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let cancelLoad: (() => void) | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    cancelLoad = () => reject(new Error("DOM motion surface disposed"));
    frame.addEventListener(
      "load",
      () => {
        void (async () => {
          if (disposed) return;
          const doc = frame.contentDocument;
          if (!doc) throw new Error("DOM motion source unavailable");
          // Layout starts font loads before ready resolves and boxes are measured.
          void doc.body.offsetHeight;
          await doc.fonts.ready;
          if (disposed) return;
          parts = buildDomMotionParts(doc, document.bindings);
          scrollbars = createDomMotionScrollbars(doc);
          world = createDomMotionWorld(doc, parts);
          loaded = true;
          cancelLoad = null;
          resolve();
        })().catch(reject);
      },
      { once: true },
    );
    frame.srcdoc = prepareDomMotionMarkup(document.html, owner);
  });
  function render(rawTime: unknown): void {
    if (disposed) throw new Error("DOM motion surface disposed");
    if (!loaded) throw new Error("DOM motion surface is not ready");
    if (typeof rawTime !== "number" || !Number.isFinite(rawTime))
      throw new Error("Invalid DOM motion time");
    const time = Math.min(duration, Math.max(0, rawTime));
    observedTracks.clear();
    observedTargets.clear();
    observedTargets.add("page");
    element.dataset.domMotionTime = String(time);
    const cameraValues = [
      "x",
      "y",
      "z",
      "rotateX",
      "rotateY",
      "rotateZ",
      "blur",
    ].map((p) => read("page", p, time, 0));
    const scale = read("page", "scale", time, 1);
    const poses = parts.map((part) =>
      readDomMotionPose(
        part.binding,
        time,
        read(part.binding.id, "assembly", time, 1),
        read,
      ),
    );
    const settled =
      cameraValues.every((v) => Math.abs(v) < 0.00001) &&
      scale === 1 &&
      poses.every((pose) => pose.settled) &&
      parts.every(
        (p) =>
          read(
            p.binding.id,
            "assembly",
            time -
              (p.children.length ? (p.binding.partDelay ?? 0) : 0) -
              Math.max(0, p.children.length - 1) * p.binding.stagger,
            1,
          ) === 1,
      );
    scrollbars!.restore();
    parts.forEach(restoreDomMotionPart);
    world!.render(
      `translate3d(${cameraValues[0]}px,${cameraValues[1]}px,${cameraValues[2]}px) rotateX(${cameraValues[3]}deg) rotateY(${cameraValues[4]}deg) rotateZ(${cameraValues[5]}deg) scale(${scale})`,
      settled,
    );
    frame.style.filter = settled ? "none" : `blur(${cameraValues[6]}px)`;
    frame.style.opacity = String(
      visibleTargets.has("page") ? read("page", "opacity", time, 1) : 0,
    );
    for (const [partIndex, part] of parts.entries()) {
      observedTargets.add(part.binding.id);
      if (!visibleTargets.has(part.binding.id)) {
        part.source.style.visibility = "hidden";
        continue;
      }
      if (settled) continue;
      const progress = read(part.binding.id, "assembly", time, 1);
      const remaining = 1 - progress;
      if (progress <= 0) {
        part.source.style.opacity = "0";
        continue;
      }
      renderDomMotionBackgrounds(part.backgrounds, progress);
      part.source.style.transform = poses[partIndex].transform;
      part.source.style.transformOrigin = "50% 50%";
      if (remaining > 0.00001) {
        // A panel travels as one UI surface; its natural box still owns layout.
        part.source.style.boxShadow = `0 ${22 * remaining}px ${45 * remaining}px rgba(24, 46, 72, ${0.12 * progress * remaining})`;
        part.source.style.willChange = "transform";
      }
      part.source.style.width = part.width;
      part.source.style.height = part.height;
      part.source.style.transformStyle = "preserve-3d";
      part.source.style.overflow = "visible";
      for (const [index, child] of part.children.entries()) {
        const childProgress = read(
          part.binding.id,
          "assembly",
          time - (part.binding.partDelay ?? 0) - index * part.binding.stagger,
          1,
        );
        if (childProgress >= 1) continue;
        const rest = 1 - childProgress;
        const level = 65 + (index % 5) * 28;
        const offset = ((index % 3) - 1) * 18;
        const lift = part.binding.partLift ?? 28 + (index % 4) * 12;
        child.element.style.transform = `translate3d(${offset * rest}px,${-lift * rest}px,${level * rest}px) rotateX(${4 * rest}deg)`;
        child.element.style.opacity = String(
          childProgress * childProgress * (3 - 2 * childProgress),
        );
        child.element.style.filter = `blur(${1.1 * rest}px)`;
        child.element.style.willChange = "transform, opacity";
      }
    }
    scrollbars!.render(read("page", "scrollbarOpacity", time, 1));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelLoad?.();
    observer.disconnect();
    world?.restore();
    scrollbars?.restore();
    parts.forEach(restoreDomMotionPart);
    element.remove();
    parts = [];
  }
  return {
    element,
    frame,
    ready,
    setTimeline,
    setVisibleTargets,
    render,
    resize,
    dispose,
    get bindingReads() {
      return {
        tracks: [...observedTracks],
        layers: [...observedTargets],
        layerGateReads: [...observedTargets],
      };
    },
    get elementCount() {
      return parts.reduce((n, p) => n + 1 + p.children.length, 0);
    },
  };
}
export type DomMotionSurface = ReturnType<typeof createDomMotionSurface>;
