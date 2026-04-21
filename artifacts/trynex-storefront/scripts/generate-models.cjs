/**
 * generate-models.cjs
 * Generates GLB 3D models for hoodie, longsleeve, cap, and mug.
 * Run with:  node scripts/generate-models.cjs
 *
 * Design-texture UV contract:
 *   Every garment UV is normalised to [0,1] using the XY bounding box so that
 *   a 1024×1024 design texture (layout: 1000×1000 coord space) maps correctly:
 *     u = (x - xMin) / xSize   (left → right)
 *     v = (y - yMin) / ySize   (bottom → top; matches THREE.js flipY default)
 */
const path = require("path");
const fs   = require("fs");
const THREE = require(path.join(__dirname, "../node_modules/three/build/three.cjs"));

const OUT = path.join(__dirname, "../public/models");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* ═══════════════ GLB WRITER ════════════════════════════════════════════════ */

function pad4(buf) {
  const rem = buf.byteLength % 4;
  if (rem === 0) return buf;
  const out = new Uint8Array(buf.byteLength + (4 - rem));
  out.set(new Uint8Array(buf));
  return out.buffer;
}

/**
 * Pack one BufferGeometry into GLTF accessor + bufferView entries.
 * Returns { accessors, bufferViews, posAccessorIdx, normAccessorIdx, uvAccessorIdx, idxAccessorIdx }.
 */
function packGeometry(geo, accessors, bufferViews, binChunks) {
  const startAcc = accessors.length;
  const startBV  = bufferViews.length;
  let byteOffset = binChunks.reduce((s, c) => s + c.byteLength, 0);

  // POSITION
  const posAttr = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const posBuf = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    posBuf[i*3] = posAttr.getX(i); posBuf[i*3+1] = posAttr.getY(i); posBuf[i*3+2] = posAttr.getZ(i);
  }
  const posPadded = pad4(posBuf.buffer);
  bufferViews.push({ buffer:0, byteOffset, byteLength: posPadded.byteLength, target: 34962 });
  accessors.push({ bufferView: startBV,   componentType:5126, count:posAttr.count, type:"VEC3",
    min:[bb.min.x,bb.min.y,bb.min.z], max:[bb.max.x,bb.max.y,bb.max.z] });
  binChunks.push(posPadded); byteOffset += posPadded.byteLength;

  // NORMAL
  const normAttr = geo.attributes.normal;
  const normBuf  = new Float32Array(normAttr.count * 3);
  for (let i = 0; i < normAttr.count; i++) {
    normBuf[i*3] = normAttr.getX(i); normBuf[i*3+1] = normAttr.getY(i); normBuf[i*3+2] = normAttr.getZ(i);
  }
  const normPadded = pad4(normBuf.buffer);
  bufferViews.push({ buffer:0, byteOffset, byteLength: normPadded.byteLength, target: 34962 });
  accessors.push({ bufferView: startBV+1, componentType:5126, count:normAttr.count, type:"VEC3" });
  binChunks.push(normPadded); byteOffset += normPadded.byteLength;

  // TEXCOORD_0
  const uvAttr = geo.attributes.uv;
  let uvAccessorIdx = null;
  if (uvAttr) {
    const uvBuf = new Float32Array(uvAttr.count * 2);
    for (let i = 0; i < uvAttr.count; i++) { uvBuf[i*2] = uvAttr.getX(i); uvBuf[i*2+1] = uvAttr.getY(i); }
    const uvPadded = pad4(uvBuf.buffer);
    bufferViews.push({ buffer:0, byteOffset, byteLength: uvPadded.byteLength, target: 34962 });
    uvAccessorIdx = accessors.length;
    accessors.push({ bufferView: startBV+2, componentType:5126, count:uvAttr.count, type:"VEC2" });
    binChunks.push(uvPadded); byteOffset += uvPadded.byteLength;
  }

  // INDEX
  const idxAttr = geo.index;
  let idxAccessorIdx = null;
  if (idxAttr) {
    const isU32 = idxAttr.count > 65535;
    const idxBuf = isU32 ? new Uint32Array(idxAttr.array) : new Uint16Array(idxAttr.array);
    const idxPadded = pad4(idxBuf.buffer);
    bufferViews.push({ buffer:0, byteOffset, byteLength: idxPadded.byteLength, target: 34963 });
    idxAccessorIdx = accessors.length;
    accessors.push({ bufferView: bufferViews.length-1, componentType: isU32?5125:5123,
      count: idxAttr.count, type:"SCALAR" });
    binChunks.push(idxPadded);
  }

  return {
    posAccessorIdx: startAcc,
    normAccessorIdx: startAcc+1,
    uvAccessorIdx,
    idxAccessorIdx,
  };
}

/**
 * Write a multi-primitive GLB.
 * `parts` is an array of { geo, name } objects; each becomes a separate primitive in the mesh.
 */
function writeGlb(outPath, parts) {
  const accessors   = [];
  const bufferViews = [];
  const binChunks   = [];

  const primitives = parts.map(({ geo, name }) => {
    const { posAccessorIdx, normAccessorIdx, uvAccessorIdx, idxAccessorIdx } =
      packGeometry(geo, accessors, bufferViews, binChunks);
    const attrs = { POSITION: posAccessorIdx, NORMAL: normAccessorIdx };
    if (uvAccessorIdx !== null) attrs.TEXCOORD_0 = uvAccessorIdx;
    const prim = { attributes: attrs, extras: { partName: name } };
    if (idxAccessorIdx !== null) prim.indices = idxAccessorIdx;
    return prim;
  });

  // Combine all BIN chunks
  const totalBin = binChunks.reduce((s, c) => s + c.byteLength, 0);
  const binData  = new Uint8Array(totalBin);
  let off = 0;
  for (const c of binChunks) { binData.set(new Uint8Array(c), off); off += c.byteLength; }

  const json = {
    asset: { version:"2.0", generator:"TryNex model generator" },
    scene: 0,
    scenes: [{ nodes:[0] }],
    nodes: [{ mesh:0, name:"Garment" }],
    meshes: [{ name:"Garment", primitives }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: totalBin }],
  };

  let jsonStr = JSON.stringify(json);
  const jPad = jsonStr.length % 4;
  if (jPad) jsonStr += " ".repeat(4 - jPad);
  const jsonBytes = Buffer.from(jsonStr, "utf8");

  const bPad = binData.byteLength % 4;
  const binPadded = bPad ? (() => { const p = new Uint8Array(binData.byteLength+(4-bPad)); p.set(binData); return p; })() : binData;

  const totalLen = 12 + 8 + jsonBytes.length + 8 + binPadded.byteLength;
  const outBuf   = Buffer.alloc(totalLen);
  let p = 0;
  outBuf.writeUInt32LE(0x46546C67, p); p+=4;
  outBuf.writeUInt32LE(2, p); p+=4;
  outBuf.writeUInt32LE(totalLen, p); p+=4;
  outBuf.writeUInt32LE(jsonBytes.length, p); p+=4;
  outBuf.writeUInt32LE(0x4E4F534A, p); p+=4;
  jsonBytes.copy(outBuf, p); p += jsonBytes.length;
  outBuf.writeUInt32LE(binPadded.byteLength, p); p+=4;
  outBuf.writeUInt32LE(0x004E4942, p); p+=4;
  Buffer.from(binPadded).copy(outBuf, p);

  fs.writeFileSync(outPath, outBuf);
  console.log(`✓ ${path.basename(outPath)} — ${(outBuf.length/1024).toFixed(1)} KB  (${parts.length} mesh${parts.length>1?"es":""})`);
}

/* ═══════════════ UV NORMALISATION ═════════════════════════════════════════ */
/**
 * Remap every UV vertex so u = (x-xMin)/xSize, v = (y-yMin)/ySize.
 * This matches the design-texture coordinate space (0→1 across the garment).
 * flipV=true → v = 1 - (y-yMin)/ySize (THREE.js default flipY behaviour)
 */
function normaliseUVs(geo, flipV = false) {
  geo.computeBoundingBox();
  const bb   = geo.boundingBox;
  const xMin = bb.min.x, xSize = bb.max.x - bb.min.x || 1;
  const yMin = bb.min.y, ySize = bb.max.y - bb.min.y || 1;
  const pos  = geo.attributes.position;
  const uv   = geo.attributes.uv;
  if (!uv) {
    const uvArr = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvArr[i*2]   = (pos.getX(i) - xMin) / xSize;
      uvArr[i*2+1] = flipV ? 1 - (pos.getY(i) - yMin)/ySize : (pos.getY(i) - yMin)/ySize;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  } else {
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - xMin) / xSize;
      const v = flipV ? 1 - (pos.getY(i) - yMin)/ySize : (pos.getY(i) - yMin)/ySize;
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════ GARMENT SHAPE BUILDER ════════════════════════════════════ */
function buildGarmentShape(opts = {}) {
  const {
    width = 2.6, height = 3.0,
    sleeveExtend = 0.12, sleeveDropRatio = 0.20,
    bodyWidthRatio = 0.78, shoulderYRatio = 0.35,
    depth = 0.26,
  } = opts;

  const w = width, h = height, halfW = w/2;
  const shoulderY  = h * shoulderYRatio;
  const sleeveOutX = halfW + w * sleeveExtend;
  const sleeveBot  = h * sleeveDropRatio;
  const bodyEdgeX  = halfW * bodyWidthRatio;

  const s = new THREE.Shape();
  s.moveTo(w*0.10, h*0.50);
  s.bezierCurveTo(w*0.05, h*0.48, -w*0.05, h*0.50, -w*0.10, h*0.50);
  s.bezierCurveTo(-w*0.10, h*0.50, -w*0.18, h*0.45, -w*0.20, shoulderY);
  s.lineTo(-sleeveOutX, sleeveBot);
  s.lineTo(-sleeveOutX + w*0.05, h*0.10);
  s.lineTo(-bodyEdgeX, h*0.10);
  s.lineTo(-bodyEdgeX, -h*0.50);
  s.lineTo( bodyEdgeX, -h*0.50);
  s.lineTo( bodyEdgeX, h*0.10);
  s.lineTo( sleeveOutX - w*0.05, h*0.10);
  s.lineTo( sleeveOutX, sleeveBot);
  s.lineTo(w*0.20, shoulderY);
  s.bezierCurveTo(w*0.18, h*0.45, w*0.10, h*0.50, w*0.10, h*0.50);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    steps:1, depth, bevelEnabled:true, bevelThickness:0.04, bevelSize:0.04, bevelSegments:4,
  });
  geo.translate(0, 0, -depth/2);
  normaliseUVs(geo);
  geo.computeVertexNormals();
  return geo;
}

/* ═══════════════ HOODIE ════════════════════════════════════════════════════ */
function generateHoodie() {
  const body = buildGarmentShape({
    width:2.55, height:3.05, sleeveExtend:0.17, sleeveDropRatio:0.18,
    bodyWidthRatio:0.76, shoulderYRatio:0.33, depth:0.30,
  });
  // Hood cap: squashed sphere cap on the back of the neck
  const hood = new THREE.SphereGeometry(0.72, 40, 20, 0, Math.PI*2, 0, Math.PI*0.60);
  hood.scale(1.1, 0.90, 0.60);
  hood.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 1.62, -0.10));
  normaliseUVs(hood);
  hood.computeVertexNormals();

  writeGlb(path.join(OUT, "hoodie.glb"), [
    { geo: body, name: "body" },
    { geo: hood, name: "hood" },
  ]);
}

/* ═══════════════ LONG SLEEVE ════════════════════════════════════════════ */
function generateLongSleeve() {
  const body = buildGarmentShape({
    width:2.60, height:3.10, sleeveExtend:0.24, sleeveDropRatio:0.11,
    bodyWidthRatio:0.75, shoulderYRatio:0.36, depth:0.26,
  });
  writeGlb(path.join(OUT, "longsleeve.glb"), [{ geo: body, name: "body" }]);
}

/* ═══════════════ CAP ════════════════════════════════════════════════════ */
function generateCap() {
  // Crown
  const crown = new THREE.SphereGeometry(1.1, 56, 28, 0, Math.PI*2, 0, Math.PI*0.52);
  crown.scale(1.0, 0.88, 1.0);
  crown.translate(0, -0.20, 0);
  normaliseUVs(crown);
  crown.computeVertexNormals();

  // Brim — flat extruded half-disc. The arc is built opening toward +X
  // (in shape-space), then we rotate it so it lies horizontally AND points
  // toward +Z (camera-facing). Without the +π/2 Y-rotation the brim would
  // stick out the right side of the cap and the front panel of the crown
  // would face the side wall, not the camera.
  const brimShape = new THREE.Shape();
  brimShape.absarc(0, 0, 1.28, -Math.PI*0.55, Math.PI*0.55, false);
  brimShape.lineTo(0, 0);
  brimShape.closePath();
  const brim = new THREE.ExtrudeGeometry(brimShape, { steps:1, depth:0.06, bevelEnabled:false });
  // 1) lay flat (rotate around X so the disc sits in XZ plane)
  // 2) rotate around Y by +90° so the half-disc opening points to +Z
  // 3) translate down to sit at the front of the crown
  brim.applyMatrix4(
    new THREE.Matrix4().makeRotationY(Math.PI / 2)
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.18))
  );
  brim.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.65, 0.15));
  normaliseUVs(brim);
  brim.computeVertexNormals();

  writeGlb(path.join(OUT, "cap.glb"), [
    { geo: crown, name: "crown" },
    { geo: brim,  name: "brim"  },
  ]);
}

/* ═══════════════ MUG (multi-part) ══════════════════════════════════════ */
function generateMug() {
  const R = 0.72, H = 1.70;

  // Outer body — open cylinder (open top so inner liner is visible)
  const body = new THREE.CylinderGeometry(R, R, H, 96, 2, true);
  body.computeVertexNormals();

  // Inner liner — slightly smaller, back-side so it reads as hollow cavity
  const inner = new THREE.CylinderGeometry(R-0.04, R-0.04, H-0.06, 80, 1, true);
  inner.computeVertexNormals();

  // Solid bottom
  const bottom = new THREE.CircleGeometry(R-0.005, 80);
  bottom.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2));
  bottom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -H/2+0.005, 0));
  bottom.computeVertexNormals();

  // Rim ring at top
  const rim = new THREE.TorusGeometry(R-0.02, 0.022, 10, 80);
  rim.applyMatrix4(new THREE.Matrix4().makeTranslation(0, H/2, 0));
  rim.computeVertexNormals();

  // Handle — CatmullRom swept tube
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(R-0.02,  0.45, 0),
    new THREE.Vector3(R+0.55,  0.40, 0),
    new THREE.Vector3(R+0.55, -0.40, 0),
    new THREE.Vector3(R-0.02, -0.45, 0),
  ], false, "catmullrom", 0.5);
  const handle = new THREE.TubeGeometry(curve, 64, 0.08, 14, false);
  handle.computeVertexNormals();

  // Offset entire mug to match the scene position used in garment3d.tsx
  for (const g of [body, inner, bottom, rim, handle]) {
    g.translate(-0.12, -0.05, 0);
  }

  writeGlb(path.join(OUT, "mug.glb"), [
    { geo: body,   name: "body"   },
    { geo: inner,  name: "inner"  },
    { geo: bottom, name: "bottom" },
    { geo: rim,    name: "rim"    },
    { geo: handle, name: "handle" },
  ]);
}

/* ═══════════════ RUN ════════════════════════════════════════════════════ */
console.log("Generating 3D models...");
generateHoodie();
generateLongSleeve();
generateCap();
generateMug();
console.log("Done.");
