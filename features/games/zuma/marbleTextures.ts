import type { ZumaColor } from "./types";

type MarblePalette = { light: string; base: string; deep: string; rune: string };

const PALETTES: Record<ZumaColor, MarblePalette> = {
  red: { light: "#ffb08b", base: "#ed5148", deep: "#671a24", rune: "#ffd0a6" },
  blue: { light: "#a9e8ff", base: "#3c9ee9", deep: "#153c85", rune: "#d7f5ff" },
  yellow: { light: "#fff3a1", base: "#efc43e", deep: "#80551a", rune: "#fff8c8" },
  green: { light: "#b8f5bd", base: "#4dbd70", deep: "#165b3e", rune: "#dcffce" },
  purple: { light: "#e4c0ff", base: "#9d63dc", deep: "#49236f", rune: "#f4d9ff" },
};

function drawRune(context: CanvasRenderingContext2D, color: ZumaColor, palette: MarblePalette) {
  context.save();
  context.translate(48, 49);
  context.strokeStyle = palette.rune;
  context.globalAlpha = .42;
  context.lineWidth = 3;
  context.lineCap = "round";
  if (color === "red") {
    context.beginPath();
    context.moveTo(-15, 9); context.quadraticCurveTo(-5, -8, 0, -17); context.quadraticCurveTo(5, -7, 15, 9);
    context.moveTo(-9, 13); context.quadraticCurveTo(0, 2, 9, 13); context.stroke();
  } else if (color === "blue") {
    for (let index = -1; index <= 1; index += 1) {
      context.beginPath(); context.arc(index * 11, index * 3, 12, .15, Math.PI - .15); context.stroke();
    }
  } else if (color === "yellow") {
    context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      context.beginPath(); context.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12); context.lineTo(Math.cos(angle) * 19, Math.sin(angle) * 19); context.stroke();
    }
  } else if (color === "green") {
    context.beginPath(); context.moveTo(0, 17); context.quadraticCurveTo(-18, 2, -4, -18); context.quadraticCurveTo(18, -4, 0, 17); context.stroke();
    context.beginPath(); context.moveTo(-3, 13); context.lineTo(4, -13); context.moveTo(1, 1); context.lineTo(-10, -4); context.moveTo(2, -4); context.lineTo(12, -9); context.stroke();
  } else {
    context.beginPath(); context.arc(0, 0, 16, .25, Math.PI * 2.05); context.arc(0, 0, 9, .25, Math.PI * 2.05); context.arc(0, 0, 3, 0, Math.PI * 2); context.stroke();
  }
  context.restore();
}

function createTexture(color: ZumaColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  const palette = PALETTES[color];

  const rim = context.createRadialGradient(34, 28, 5, 48, 48, 45);
  rim.addColorStop(0, "#ffffff");
  rim.addColorStop(.1, palette.light);
  rim.addColorStop(.4, palette.base);
  rim.addColorStop(.79, palette.deep);
  rim.addColorStop(.94, "#17131b");
  rim.addColorStop(1, "#050509");
  context.fillStyle = rim;
  context.beginPath(); context.arc(48, 48, 44, 0, Math.PI * 2); context.fill();

  const inner = context.createRadialGradient(36, 32, 2, 48, 48, 35);
  inner.addColorStop(0, "#ffffffdd");
  inner.addColorStop(.15, palette.light);
  inner.addColorStop(.65, palette.base);
  inner.addColorStop(1, palette.deep);
  context.fillStyle = inner;
  context.beginPath(); context.arc(48, 48, 35, 0, Math.PI * 2); context.fill();

  context.save();
  context.beginPath(); context.arc(48, 48, 34, 0, Math.PI * 2); context.clip();
  for (let index = 0; index < 18; index += 1) {
    const angle = index * 2.399;
    const distance = 7 + (index * 13 % 25);
    const radius = 1 + (index % 3) * .45;
    context.globalAlpha = index % 2 ? .13 : .08;
    context.fillStyle = index % 2 ? "#fff" : "#090712";
    context.beginPath();
    context.arc(48 + Math.cos(angle) * distance, 48 + Math.sin(angle) * distance, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  drawRune(context, color, palette);

  context.strokeStyle = "#ffffff78";
  context.lineWidth = 2;
  context.beginPath(); context.arc(48, 48, 39, Math.PI * 1.08, Math.PI * 1.73); context.stroke();
  context.strokeStyle = "#08060d88";
  context.beginPath(); context.arc(48, 48, 39, .05, Math.PI * .78); context.stroke();

  const gloss = context.createRadialGradient(32, 25, 0, 32, 25, 17);
  gloss.addColorStop(0, "#ffffffed"); gloss.addColorStop(.28, "#ffffff85"); gloss.addColorStop(1, "#ffffff00");
  context.fillStyle = gloss;
  context.beginPath(); context.ellipse(33, 27, 17, 11, -.55, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#fff";
  context.beginPath(); context.arc(27, 22, 3.3, 0, Math.PI * 2); context.fill();

  return canvas;
}

export function createMarbleTextures() {
  return new Map<ZumaColor, HTMLCanvasElement>((Object.keys(PALETTES) as ZumaColor[]).map((color) => [color, createTexture(color)]));
}
