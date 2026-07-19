---
name: three-core
description: Core Three.js rules covering scene setup, render loops, vector mathematics, matrices, asset loading, memory lifecycle, and vanilla JavaScript canvas setups.
version: "1.0.0"
---

# Three.js Core Architecture & Optimization

## When to Use This Skill
Apply when implementing vanilla Three.js instances, setting up WebGLRenderer loops manually, performing manual matrix or raw mathematical transformations (`Vector3`, `Quaternion`, `Matrix4`), importing external models (`GLTFLoader`), or debugging baseline WebGL memory allocation.

## 1. Baseline Architecture
- **Single Global Context**: Ensure only one `WebGLRenderer` context is generated per immersive view layer unless explicitly managing multi-view split-screens.
- **Resize Strategy**: Always bind window resizing to immediate renderer updates and camera matrix updates. Debounce structural DOM resize handlers, but update projection matrices instantly on visual canvas dimension shifts.
  ```javascript
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  ```
- **Device Pixel Ratio (DPR)**: Cap `renderer.setPixelRatio` at `Math.min(window.devicePixelRatio, 2)`. Setting DPR beyond `2` on modern high-density mobile screens causes massive fill-rate performance bottlenecks without perceptible visual improvements.

## 2. Memory Lifecycle & Disposal (CRITICAL)

Three.js does not automatically garbage-collect GPU memory when objects are detached from the scene graph. You must manually dispose of them to avoid critical page leaks:

- **Disposal Flow**: When removing an element, traverse the hierarchy and systematically call `.dispose()` on all associated geometries and materials.
- **Texture Release**: Explicitly call `.dispose()` on any loaded maps, textures, or frame buffers (`WebGLRenderTarget`).
  ```javascript
  scene.remove(mesh);
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(m => m.dispose());
  } else {
    mesh.material.dispose();
  }
  ```

## 3. Math & Animation Loop Optimization

- **Framerate Independence**: Always multiply raw positional or rotational additions in the `requestAnimationFrame` render loop by an elapsed delta time token (`clock.getDelta()`).
- **Instanced Transformations**: When dealing with mass object repetition (>50 items), do not allocate individual `THREE.Mesh` nodes. Use a single `THREE.InstancedMesh` and mutate instances via index-based `setMatrixAt` configurations to preserve uniform draw calls.
- **Object Allocation Overhead**: Never instantiate new math objects (`new THREE.Vector3()`, `new THREE.Color()`) inside the animation loop. Allocate them once globally or in an outer scope, and use mutations like `.set()`, `.copy()`, or `.addVectors()` inside the execution block.

## 4. Asset Loading Best Practices

- **GLTF Preferred Format**: Use `GLTFLoader` for all 3D model imports. GLTF/GLB is the recommended transmission format for web — compact, standardized, and GPU-optimized.
- **Draco Compression**: Compress all external model assets using Draco compression before integration. Configure `DRACOLoader` and attach it to `GLTFLoader`:
  ```javascript
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
  import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  ```
- **Texture Optimization**: Use `KTX2Loader` for GPU-compressed textures when targeting WebGL2. Resize source textures to power-of-two dimensions when possible to enable mipmapping.
- **Loading Manager**: Use `THREE.LoadingManager` to track loading progress and display user-facing loading states:
  ```javascript
  const manager = new THREE.LoadingManager(
    () => { /* onLoad — hide loader */ },
    (url, loaded, total) => { /* onProgress — update progress bar */ },
    (url) => { /* onError — handle failures gracefully */ }
  );
  ```

## 5. Lighting & Shadow Guidelines

- **Shadow Map Size**: Set `renderer.shadowMap.enabled = true` only when required. Use `THREE.PCFSoftShadowMap` for quality. Keep shadow map dimensions at `1024` or `2048` — never exceed `4096`.
- **Light Count**: Minimize real-time lights. Prefer baked lighting or environment maps (`HDRCubeTextureLoader`, `RGBELoader`) for ambient illumination. Each additional real-time light increases draw calls linearly.
- **Helper Removal**: Remove all `THREE.AxesHelper`, `THREE.GridHelper`, and `THREE.CameraHelper` instances before production builds.

## Do Not

- ❌ Do not create multiple overlapping WebGL viewports unless building intentional multi-camera tracking systems.
- ❌ Do not forget to dispose of geometry and textures on unmount — this triggers immediate browser tab crashes over long user sessions.
- ❌ Do not use complex meshes with unnecessary polygon weight; compress all external assets using Draco compression before integration.
- ❌ Do not instantiate `new THREE.Vector3()`, `new THREE.Color()`, or `new THREE.Matrix4()` inside animation loops.
- ❌ Do not set `renderer.setPixelRatio` above `2`.
- ❌ Do not leave shadow maps enabled when no shadows are visually needed.
