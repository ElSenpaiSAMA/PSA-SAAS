// Uso: node scripts/logo-variants.mjs
// Genera las variantes del logo oficial de Diplonautic (public/logo/logo.png):
//   diplonautic-claro.png  → original (círculo y texto blancos), para fondos oscuros
//   diplonautic-oscuro.png → invertido (círculo y texto azul marino, copo blanco), para fondos claros
//   icono-claro.png / icono-oscuro.png → solo el círculo con el copo
import sharp from "sharp";

const SRC = "public/logo/logo.png";
const NAVY = [11, 31, 58];
const ICON_W = 232; // el círculo ocupa las primeras ~230 columnas

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// Invierte la relación de colores: lo blanco pasa a azul marino y lo oscuro (copo) a blanco
const inverted = Buffer.from(data);
for (let i = 0; i < data.length; i += 4) {
  const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
  const t = Math.min(1, Math.max(0, (lum - 40) / (255 - 40))); // 1 = blanco, 0 = copo
  for (let c = 0; c < 3; c++) inverted[i + c] = Math.round(255 + (NAVY[c] - 255) * t);
}

const raw = { raw: { width: info.width, height: info.height, channels: 4 } };
const H = 96; // alto de salida: nítido hasta ~48 px en pantallas 2x

await sharp(data, raw).resize({ height: H }).png({ compressionLevel: 9 }).toFile("public/logo/diplonautic-claro.png");
await sharp(inverted, raw).resize({ height: H }).png({ compressionLevel: 9 }).toFile("public/logo/diplonautic-oscuro.png");
for (const [buf, name] of [
  [data, "icono-claro.png"],
  [inverted, "icono-oscuro.png"],
]) {
  await sharp(buf, raw).extract({ left: 0, top: 0, width: ICON_W, height: info.height }).resize({ height: 128 }).png({ compressionLevel: 9 }).toFile(`public/logo/${name}`);
}
// Ícono de la app (favicon): el círculo azul marino con el copo blanco
await sharp(inverted, raw).extract({ left: 0, top: 0, width: ICON_W, height: info.height }).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile("src/app/icon.png");

const meta = await sharp("public/logo/diplonautic-claro.png").metadata();
console.log("logo", meta.width + "x" + meta.height);
