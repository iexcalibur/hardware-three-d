import * as THREE from 'three';

// Anti-aliased floor grid that fades out radially around the view target.
export function gridMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      color: { value: new THREE.Color('#d9c7ae') },
      cell: { value: 9 },
      center: { value: new THREE.Vector2() },
      inner: { value: 38 },
      outer: { value: 84 },
      strength: { value: 0.9 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPos = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float cell;
      uniform vec2 center;
      uniform float inner;
      uniform float outer;
      uniform float strength;
      varying vec2 vPos;
      void main() {
        vec2 g = abs(fract(vPos / cell - 0.5) - 0.5) / fwidth(vPos / cell);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        vec2 q = (vPos - center) / vec2(1.25, 1.0);
        float fade = 1.0 - smoothstep(inner, outer, length(q));
        gl_FragColor = vec4(color, line * fade * strength);
        #include <colorspace_fragment>
      }
    `,
  });
}
