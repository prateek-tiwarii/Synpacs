/**
 * WebGL2 GLSL Shaders for Volume Ray Casting
 *
 * Vertex shader: full-screen quad (6 vertices, no buffers)
 * Fragment shader: ray-AABB intersection, front-to-back compositing,
 *   manual trilinear interpolation (R16I textures don't support GL.LINEAR)
 */

export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

void main() {
  // Full-screen quad from 6 vertices (2 triangles), no VBO needed
  // Triangle 0: (-1,-1), (1,-1), (-1,1)
  // Triangle 1: (-1,1), (1,-1), (1,1)
  float x, y;
  if (gl_VertexID == 0) { x = -1.0; y = -1.0; }
  else if (gl_VertexID == 1) { x = 1.0; y = -1.0; }
  else if (gl_VertexID == 2) { x = -1.0; y = 1.0; }
  else if (gl_VertexID == 3) { x = -1.0; y = 1.0; }
  else if (gl_VertexID == 4) { x = 1.0; y = -1.0; }
  else { x = 1.0; y = 1.0; }
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp isampler3D;
precision highp sampler2D;

uniform isampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform mat4 uInvViewMatrix;
uniform mat4 uInvProjMatrix;
uniform vec3 uVolumeDim;
uniform vec3 uVolumeSpacing;
uniform float uStepSize;
uniform float uOpacityScale;
uniform vec2 uViewport;

out vec4 fragColor;

// Map HU [-1024, 3071] to [0, 1] for TF lookup
float huToNormalized(float hu) {
  return clamp((hu + 1024.0) / 4095.0, 0.0, 1.0);
}

// Trilinear interpolation for integer texture (R16I)
float sampleVolume(vec3 pos) {
  vec3 voxelPos = pos * uVolumeDim - 0.5;
  ivec3 p0 = ivec3(floor(voxelPos));
  vec3 f = voxelPos - vec3(p0);
  ivec3 p1 = min(p0 + 1, ivec3(uVolumeDim) - 1);
  p0 = max(p0, ivec3(0));

  float c000 = float(texelFetch(uVolume, ivec3(p0.x, p0.y, p0.z), 0).r);
  float c100 = float(texelFetch(uVolume, ivec3(p1.x, p0.y, p0.z), 0).r);
  float c010 = float(texelFetch(uVolume, ivec3(p0.x, p1.y, p0.z), 0).r);
  float c110 = float(texelFetch(uVolume, ivec3(p1.x, p1.y, p0.z), 0).r);
  float c001 = float(texelFetch(uVolume, ivec3(p0.x, p0.y, p1.z), 0).r);
  float c101 = float(texelFetch(uVolume, ivec3(p1.x, p0.y, p1.z), 0).r);
  float c011 = float(texelFetch(uVolume, ivec3(p0.x, p1.y, p1.z), 0).r);
  float c111 = float(texelFetch(uVolume, ivec3(p1.x, p1.y, p1.z), 0).r);

  float c00 = mix(c000, c100, f.x);
  float c10 = mix(c010, c110, f.x);
  float c01 = mix(c001, c101, f.x);
  float c11 = mix(c011, c111, f.x);
  float c0 = mix(c00, c10, f.y);
  float c1 = mix(c01, c11, f.y);
  return mix(c0, c1, f.z);
}

// Ray-AABB intersection (slab method) against [0,1]^3
bool intersectBox(vec3 origin, vec3 dir, out float tNear, out float tFar) {
  vec3 invDir = 1.0 / dir;
  vec3 t0 = (vec3(0.0) - origin) * invDir;
  vec3 t1 = (vec3(1.0) - origin) * invDir;
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  tNear = max(max(tMin.x, tMin.y), tMin.z);
  tFar = min(min(tMax.x, tMax.y), tMax.z);
  return tNear <= tFar && tFar > 0.0;
}

void main() {
  // Fragment to NDC [-1, 1]
  vec2 ndc = (gl_FragCoord.xy / uViewport) * 2.0 - 1.0;

  // Camera-space ray direction via inverse projection
  vec4 camNear = uInvProjMatrix * vec4(ndc, -1.0, 1.0);
  vec3 camRayDir = normalize(camNear.xyz / camNear.w);

  // World-space ray origin and direction
  vec3 rayOrigin = (uInvViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rayDir = normalize((uInvViewMatrix * vec4(camRayDir, 0.0)).xyz);

  // Volume bounding box in world space: centered at origin
  // Size = uVolumeDim * uVolumeSpacing
  vec3 volumeSize = uVolumeDim * uVolumeSpacing;
  vec3 halfSize = volumeSize * 0.5;

  // Transform ray to normalized volume space [0,1]^3
  vec3 scaledOrigin = (rayOrigin + halfSize) / volumeSize;
  vec3 scaledDir = rayDir / volumeSize;

  float tNear, tFar;
  if (!intersectBox(scaledOrigin, scaledDir, tNear, tFar)) {
    fragColor = vec4(0.0);
    return;
  }
  tNear = max(tNear, 0.0);

  // Front-to-back compositing
  float stepLen = uStepSize;
  vec4 accumulated = vec4(0.0);

  for (float t = tNear; t < tFar; t += stepLen) {
    vec3 samplePos = scaledOrigin + t * scaledDir;

    // Skip out-of-bounds samples (edge case from floating point)
    if (any(lessThan(samplePos, vec3(0.001))) || any(greaterThan(samplePos, vec3(0.999)))) {
      continue;
    }

    float hu = sampleVolume(samplePos);
    float tfCoord = huToNormalized(hu);
    vec4 sampleColor = texture(uTransferFunction, vec2(tfCoord, 0.5));

    // Opacity correction for variable step size
    float alpha = 1.0 - pow(max(1.0 - sampleColor.a * uOpacityScale, 0.0), stepLen * 500.0);
    alpha = clamp(alpha, 0.0, 1.0);

    // Composite
    accumulated.rgb += (1.0 - accumulated.a) * alpha * sampleColor.rgb;
    accumulated.a += (1.0 - accumulated.a) * alpha;

    // Early ray termination
    if (accumulated.a > 0.99) break;
  }

  fragColor = accumulated;
}
`;
