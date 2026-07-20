import { createRoot, extend, flushSync } from "@react-three/fiber";
import * as THREE from "three";
import {
  createBindingAuditBitmap,
  createWebGlCanvas,
  positiveNumber,
  resolveThreeRenderSize,
  shouldBypassThreeRenderForBindingAudit,
} from "./three-render-plan.js";

const THREE_CATALOGUE = Object.freeze({
  AmbientLight: THREE.AmbientLight,
  BoxGeometry: THREE.BoxGeometry,
  BufferAttribute: THREE.BufferAttribute,
  BufferGeometry: THREE.BufferGeometry,
  Color: THREE.Color,
  DirectionalLight: THREE.DirectionalLight,
  Group: THREE.Group,
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshLambertMaterial: THREE.MeshLambertMaterial,
  MeshNormalMaterial: THREE.MeshNormalMaterial,
  MeshPhongMaterial: THREE.MeshPhongMaterial,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  Object3D: THREE.Object3D,
  OrthographicCamera: THREE.OrthographicCamera,
  PerspectiveCamera: THREE.PerspectiveCamera,
  PlaneGeometry: THREE.PlaneGeometry,
  PointLight: THREE.PointLight,
  RingGeometry: THREE.RingGeometry,
  Scene: THREE.Scene,
  SphereGeometry: THREE.SphereGeometry,
  TorusGeometry: THREE.TorusGeometry,
  TorusKnotGeometry: THREE.TorusKnotGeometry,
});

let r3fCatalogueExtended = false;

export function createThreeSandboxFacade({
  getBindingReadMode = () => null,
  getRenderViewport = () => null,
}: {
  getBindingReadMode?: () => unknown;
  getRenderViewport?: () => { height?: number; width?: number } | null;
} = {}) {
  const isBindingAudit = () =>
    shouldBypassThreeRenderForBindingAudit(getBindingReadMode());
  return Object.freeze({
    THREE: createCuratedThreeFacade(),
    r3f: Object.freeze({
      createFrameRenderer: (options: any = {}) =>
        createR3fFrameRenderer(options, getRenderViewport, isBindingAudit),
    }),
    three: Object.freeze({
      createFrameRenderer: (options: any = {}) =>
        createThreeFrameRenderer(options, getRenderViewport, isBindingAudit),
    }),
  });
}

function createCuratedThreeFacade() {
  return Object.freeze({
    ...THREE_CATALOGUE,
    ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
    AdditiveBlending: THREE.AdditiveBlending,
    BackSide: THREE.BackSide,
    CanvasTexture: THREE.CanvasTexture,
    Clock: THREE.Clock,
    DoubleSide: THREE.DoubleSide,
    Euler: THREE.Euler,
    FrontSide: THREE.FrontSide,
    MathUtils: THREE.MathUtils,
    Matrix4: THREE.Matrix4,
    MultiplyBlending: THREE.MultiplyBlending,
    NoBlending: THREE.NoBlending,
    NoToneMapping: THREE.NoToneMapping,
    NormalBlending: THREE.NormalBlending,
    Quaternion: THREE.Quaternion,
    SRGBColorSpace: THREE.SRGBColorSpace,
    Texture: THREE.Texture,
    Vector2: THREE.Vector2,
    Vector3: THREE.Vector3,
    Vector4: THREE.Vector4,
  });
}

function createThreeFrameRenderer(
  options: any = {},
  getRenderViewport: () => { height?: number; width?: number } | null,
  isBindingAudit: () => boolean,
) {
  const requestedWidth = positiveNumber(options.width, 1280);
  const requestedHeight = positiveNumber(options.height, 720);
  const canvas = createWebGlCanvas(requestedWidth, requestedHeight);
  let currentHeight = 0;
  let currentWidth = 0;
  let renderer: THREE.WebGLRenderer | null = null;

  function getRenderer() {
    const size = resolveThreeRenderSize(
      requestedWidth,
      requestedHeight,
      getRenderViewport(),
      options.dpr,
    );
    if (!renderer) {
      canvas.width = size.width;
      canvas.height = size.height;
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        preserveDrawingBuffer: true,
        ...(options.rendererParameters ?? {}),
      });
      configureWebGlRenderer(renderer, size.width, size.height, options);
      currentWidth = size.width;
      currentHeight = size.height;
    } else if (size.width !== currentWidth || size.height !== currentHeight) {
      renderer.setSize(size.width, size.height, false);
      currentWidth = size.width;
      currentHeight = size.height;
    }
    return renderer;
  }

  return Object.freeze({
    canvas,
    get renderer() {
      return getRenderer();
    },
    async render(scene, camera, renderOptions: any = {}) {
      if (isBindingAudit()) {
        return createBindingAuditBitmap(
          resolveThreeRenderSize(
            requestedWidth,
            requestedHeight,
            getRenderViewport(),
            options.dpr,
          ),
        );
      }
      const renderer = getRenderer();
      if (renderOptions.clearColor !== undefined) {
        renderer.setClearColor(
          renderOptions.clearColor,
          renderOptions.clearAlpha ?? 1,
        );
      }
      renderer.render(scene, camera);
      return await createImageBitmap(canvas);
    },
    async snapshot() {
      if (isBindingAudit()) {
        return createBindingAuditBitmap(
          resolveThreeRenderSize(
            requestedWidth,
            requestedHeight,
            getRenderViewport(),
            options.dpr,
          ),
        );
      }
      getRenderer();
      return await createImageBitmap(canvas);
    },
    dispose() {
      renderer?.dispose();
      renderer = null;
      canvas.width = 0;
      canvas.height = 0;
    },
  });
}

function createR3fFrameRenderer(
  options: any = {},
  getRenderViewport: () => { height?: number; width?: number } | null,
  isBindingAudit: () => boolean,
) {
  ensureR3fCatalogue();
  const requestedWidth = positiveNumber(options.width, 1280);
  const requestedHeight = positiveNumber(options.height, 720);
  const canvas = createWebGlCanvas(requestedWidth, requestedHeight);
  let configured: Promise<any> | null = null;
  let currentHeight = 0;
  let currentWidth = 0;
  let root: ReturnType<typeof createRoot> | null = null;
  let store: any = null;

  function ensureRoot() {
    const size = resolveThreeRenderSize(
      requestedWidth,
      requestedHeight,
      getRenderViewport(),
      options.dpr,
    );
    if (!root) {
      canvas.width = size.width;
      canvas.height = size.height;
      root = createRoot(canvas);
      configured = root.configure({
        camera: options.camera ?? { fov: 45, position: [0, 0, 5] },
        dpr: options.dpr ?? 1,
        frameloop: "never",
        gl: {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          ...(options.gl ?? {}),
        },
        linear: options.linear ?? false,
        flat: options.flat ?? false,
        size: { height: size.height, left: 0, top: 0, width: size.width },
        ...(options.configure ?? {}),
      });
      currentWidth = size.width;
      currentHeight = size.height;
    }
    return { root, size };
  }

  return Object.freeze({
    canvas,
    async render(element, renderOptions: any = {}) {
      if (isBindingAudit()) {
        return createBindingAuditBitmap(
          resolveThreeRenderSize(
            requestedWidth,
            requestedHeight,
            getRenderViewport(),
            options.dpr,
          ),
        );
      }
      const active = ensureRoot();
      await configured;
      flushSync(() => {
        store = active.root.render(element);
      });
      const state = store.getState();
      if (
        active.size.width !== currentWidth ||
        active.size.height !== currentHeight
      ) {
        currentWidth = active.size.width;
        currentHeight = active.size.height;
      }
      state.setSize(currentWidth, currentHeight, 0, 0);
      state.advance?.(
        Number(renderOptions.timestamp) || performance.now(),
        true,
      );
      return await createImageBitmap(canvas);
    },
    async snapshot() {
      if (isBindingAudit()) {
        return createBindingAuditBitmap(
          resolveThreeRenderSize(
            requestedWidth,
            requestedHeight,
            getRenderViewport(),
            options.dpr,
          ),
        );
      }
      ensureRoot();
      await configured;
      return await createImageBitmap(canvas);
    },
    dispose() {
      root?.unmount();
      root = null;
      configured = null;
      canvas.width = 0;
      canvas.height = 0;
    },
  });
}

function ensureR3fCatalogue() {
  if (r3fCatalogueExtended) {
    return;
  }
  extend(THREE_CATALOGUE);
  r3fCatalogueExtended = true;
}

function configureWebGlRenderer(renderer, width, height, options: any) {
  renderer.setPixelRatio(positiveNumber(options.dpr, 1));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = options.toneMapping ?? THREE.ACESFilmicToneMapping;
}
