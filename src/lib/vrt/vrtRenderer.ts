/**
 * VRT Renderer — WebGL2 volume raycasting engine.
 *
 * Manages the WebGL2 context, compiles shaders, uploads the 3D volume texture,
 * and renders frames on demand (not continuously).
 */

import type { VolumeData } from "../mpr/volumeBuilder";
import { VERTEX_SHADER, FRAGMENT_SHADER } from "./vrtShaders";

export interface VRTRendererState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  volumeTexture: WebGLTexture;
  tfTexture: WebGLTexture;
  vao: WebGLVertexArrayObject;
  uniforms: Record<string, WebGLUniformLocation>;
  volumeDim: [number, number, number];
  volumeSpacing: [number, number, number];
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking failed: ${log}`);
  }
  // Shaders can be detached after linking
  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function uploadVolumeTexture(
  gl: WebGL2RenderingContext,
  volume: VolumeData,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create volume texture");

  gl.bindTexture(gl.TEXTURE_3D, tex);

  // R16I requires NEAREST filtering
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  const [cols, rows, slices] = volume.dimensions;

  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.R16I,
    cols,
    rows,
    slices,
    0,
    gl.RED_INTEGER,
    gl.SHORT,
    volume.data,
  );

  return tex;
}

function createTransferFunctionTexture(
  gl: WebGL2RenderingContext,
  data: Uint8Array,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create TF texture");

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // 4096 x 1 RGBA texture
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    4096,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data,
  );

  return tex;
}

function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): Record<string, WebGLUniformLocation> {
  const names = [
    "uVolume",
    "uTransferFunction",
    "uInvViewMatrix",
    "uInvProjMatrix",
    "uVolumeDim",
    "uVolumeSpacing",
    "uStepSize",
    "uOpacityScale",
    "uViewport",
  ];

  const locs: Record<string, WebGLUniformLocation> = {};
  for (const name of names) {
    const loc = gl.getUniformLocation(program, name);
    if (loc !== null) {
      locs[name] = loc;
    }
  }
  return locs;
}

// ─── Public API ───

export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

export function initRenderer(
  canvas: HTMLCanvasElement,
  volume: VolumeData,
  tfData: Uint8Array,
): VRTRendererState {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL2 not available");

  // Check max 3D texture size
  const maxSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  const [cols, rows, slices] = volume.dimensions;
  if (cols > maxSize || rows > maxSize || slices > maxSize) {
    throw new Error(
      `Volume dimensions (${cols}x${rows}x${slices}) exceed GPU limit (${maxSize})`,
    );
  }

  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const uniforms = getUniformLocations(gl, program);
  const volumeTexture = uploadVolumeTexture(gl, volume);
  const tfTexture = createTransferFunctionTexture(gl, tfData);

  // Create an empty VAO (required for WebGL2 drawArrays)
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");

  // Enable blending for alpha compositing
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    gl,
    program,
    volumeTexture,
    tfTexture,
    vao,
    uniforms,
    volumeDim: [cols, rows, slices],
    volumeSpacing: [...volume.spacing],
  };
}

export function updateTransferFunction(
  state: VRTRendererState,
  data: Uint8Array,
): void {
  const { gl, tfTexture } = state;
  gl.bindTexture(gl.TEXTURE_2D, tfTexture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    4096,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data,
  );
}

export function render(
  state: VRTRendererState,
  invViewMatrix: Float32Array,
  invProjMatrix: Float32Array,
  stepSize: number,
  opacityScale: number,
): void {
  const { gl, program, vao, uniforms, volumeTexture, tfTexture, volumeDim, volumeSpacing } = state;

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  // Bind volume texture to unit 0
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
  if (uniforms.uVolume) gl.uniform1i(uniforms.uVolume, 0);

  // Bind transfer function to unit 1
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tfTexture);
  if (uniforms.uTransferFunction) gl.uniform1i(uniforms.uTransferFunction, 1);

  // Set uniforms
  if (uniforms.uInvViewMatrix) gl.uniformMatrix4fv(uniforms.uInvViewMatrix, false, invViewMatrix);
  if (uniforms.uInvProjMatrix) gl.uniformMatrix4fv(uniforms.uInvProjMatrix, false, invProjMatrix);
  if (uniforms.uVolumeDim) gl.uniform3f(uniforms.uVolumeDim, volumeDim[0], volumeDim[1], volumeDim[2]);
  if (uniforms.uVolumeSpacing) gl.uniform3f(uniforms.uVolumeSpacing, volumeSpacing[0], volumeSpacing[1], volumeSpacing[2]);
  if (uniforms.uStepSize) gl.uniform1f(uniforms.uStepSize, stepSize);
  if (uniforms.uOpacityScale) gl.uniform1f(uniforms.uOpacityScale, opacityScale);
  if (uniforms.uViewport) gl.uniform2f(uniforms.uViewport, gl.canvas.width, gl.canvas.height);

  // Draw full-screen quad (6 vertices)
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindVertexArray(null);
}

export function resize(
  state: VRTRendererState,
  width: number,
  height: number,
  devicePixelRatio: number = 1,
): void {
  const canvas = state.gl.canvas as HTMLCanvasElement;
  canvas.width = Math.round(width * devicePixelRatio);
  canvas.height = Math.round(height * devicePixelRatio);
}

export function dispose(state: VRTRendererState): void {
  const { gl, program, volumeTexture, tfTexture, vao } = state;
  gl.deleteTexture(volumeTexture);
  gl.deleteTexture(tfTexture);
  gl.deleteVertexArray(vao);
  gl.deleteProgram(program);
  // Lose context to free GPU memory
  const ext = gl.getExtension("WEBGL_lose_context");
  if (ext) ext.loseContext();
}
