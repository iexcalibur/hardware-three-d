import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// The illustrated look: render view-space normals + depth of layer 0, render
// colour of everything, then ink lines where the silhouette, depth or normal
// changes abruptly. Layer 1 objects (glows, grid, floor) get no outline.

const SOLID_LAYER = 0;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float thickness;
  uniform float depthRange;
  uniform float depthThreshold;
  uniform float normalThreshold;
  uniform vec3 lineColor;
  varying vec2 vUv;

  // Orthographic camera: depth buffer is linear, so this is millimetres.
  float depthAt(vec2 uv) { return texture2D(tDepth, uv).r * depthRange; }

  float edgePair(vec2 uv, vec2 off, float d0, vec4 n0) {
    vec4 na = texture2D(tNormal, uv + off);
    vec4 nb = texture2D(tNormal, uv - off);
    float da = depthAt(uv + off);
    float db = depthAt(uv - off);

    // silhouette against empty space (normal target is cleared to alpha 0)
    float e = max(abs(na.a - n0.a), abs(nb.a - n0.a));

    if (n0.a > 0.5) {
      // second derivative of depth: flat sloped planes give 0, steps give big values
      float lap = abs(da + db - 2.0 * d0);
      float stepA = (na.a > 0.5) ? abs(da - d0) : 0.0;
      float stepB = (nb.a > 0.5) ? abs(db - d0) : 0.0;
      float dEdge = smoothstep(depthThreshold, depthThreshold * 2.0, min(lap, max(stepA, stepB) * 2.0));
      e = max(e, dEdge);

      // creases: neighbouring normals that point somewhere else
      vec3 c = n0.xyz * 2.0 - 1.0;
      float ca = na.a > 0.5 ? 1.0 - dot(c, na.xyz * 2.0 - 1.0) : 0.0;
      float cb = nb.a > 0.5 ? 1.0 - dot(c, nb.xyz * 2.0 - 1.0) : 0.0;
      e = max(e, 0.9 * smoothstep(normalThreshold, normalThreshold * 2.2, max(ca, cb)));
    }
    return e;
  }

  void main() {
    vec4 col = texture2D(tColor, vUv);
    vec4 n0 = texture2D(tNormal, vUv);
    float d0 = depthAt(vUv);

    vec2 o = texel * thickness;
    float e = 0.0;
    e = max(e, edgePair(vUv, vec2(o.x, 0.0), d0, n0));
    e = max(e, edgePair(vUv, vec2(0.0, o.y), d0, n0));
    e = max(e, edgePair(vUv, vec2(o.x, o.y) * 0.7071, d0, n0));
    e = max(e, edgePair(vUv, vec2(o.x, -o.y) * 0.7071, d0, n0));
    // a wider, fainter ring softens the line edge
    vec2 o2 = o * 1.5;
    float e2 = max(edgePair(vUv, vec2(o2.x, 0.0), d0, n0), edgePair(vUv, vec2(0.0, o2.y), d0, n0));
    e = max(e, e2 * 0.35);

    // colour target holds premultiplied linear colour
    vec3 rgb = col.a > 0.0 ? col.rgb / col.a : vec3(0.0);
    float a = col.a;
    float outA = a + e * (1.0 - a);
    vec3 mixed = (rgb * a * (1.0 - e) + lineColor * e) / max(outA, 1e-4);
    gl_FragColor = vec4(mixed, outA);
    #include <colorspace_fragment>
    // the canvas is premultiplied
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

export class Outline {
  constructor(renderer, { lineColor = '#151a2c', thickness = 1 } = {}) {
    this.renderer = renderer;
    this.thickness = thickness;
    this.lineScale = 1;
    this.pixelRatio = 1;

    this.colorTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture });
    this.normalMaterial = new THREE.MeshNormalMaterial();

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tColor: { value: this.colorTarget.texture },
        tNormal: { value: this.normalTarget.texture },
        tDepth: { value: depthTexture },
        texel: { value: new THREE.Vector2() },
        thickness: { value: thickness },
        depthRange: { value: 1 },
        depthThreshold: { value: 0.35 },
        normalThreshold: { value: 0.22 },
        lineColor: { value: new THREE.Color(lineColor) },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.NoBlending,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(w, h, pixelRatio) {
    const pw = Math.max(1, Math.round(w * pixelRatio));
    const ph = Math.max(1, Math.round(h * pixelRatio));
    this.colorTarget.setSize(pw, ph);
    this.normalTarget.setSize(pw, ph);
    this.material.uniforms.texel.value.set(1 / pw, 1 / ph);
    this.pixelRatio = pixelRatio;
    this.setLineScale(this.lineScale);
  }

  setLineScale(scale) {
    this.lineScale = scale;
    this.material.uniforms.thickness.value = this.thickness * this.pixelRatio * scale;
  }

  render(scene, camera) {
    const r = this.renderer;
    const mask = camera.layers.mask;
    this.material.uniforms.depthRange.value = camera.far - camera.near;

    camera.layers.set(SOLID_LAYER);
    scene.overrideMaterial = this.normalMaterial;
    r.setRenderTarget(this.normalTarget);
    r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;

    camera.layers.enableAll();
    r.setRenderTarget(this.colorTarget);
    r.clear();
    r.render(scene, camera);
    camera.layers.mask = mask;

    r.setRenderTarget(null);
    r.clear();
    this.quad.render(r);
  }
}
