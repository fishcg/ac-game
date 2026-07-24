import type { MapCave, MapStructure, WormMapLayout } from "./map";

function maskRect(mask: Uint8Array, width: number, height: number, x: number, y: number, rectWidth: number, rectHeight: number) {
  const minX = Math.max(0, Math.floor(x));
  const maxX = Math.min(width - 1, Math.ceil(x + rectWidth));
  const minY = Math.max(0, Math.floor(y));
  const maxY = Math.min(height - 1, Math.ceil(y + rectHeight));
  for (let pixelY = minY; pixelY <= maxY; pixelY += 1) for (let pixelX = minX; pixelX <= maxX; pixelX += 1) mask[pixelY * width + pixelX] = 1;
}

function maskTriangle(mask: Uint8Array, width: number, height: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const first = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area;
      const second = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) / area;
      const third = ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) / area;
      if (first >= 0 && second >= 0 && third >= 0 || first <= 0 && second <= 0 && third <= 0) mask[y * width + x] = 1;
    }
  }
}

function cutCave(ctx: CanvasRenderingContext2D, mask: Uint8Array, width: number, height: number, cave: MapCave) {
  const cos = Math.cos(-cave.angle);
  const sin = Math.sin(-cave.angle);
  const minX = Math.max(0, Math.floor(cave.x - cave.radiusX - 3));
  const maxX = Math.min(width - 1, Math.ceil(cave.x + cave.radiusX + 3));
  const minY = Math.max(0, Math.floor(cave.y - cave.radiusY - 3));
  const maxY = Math.min(height - 1, Math.ceil(cave.y + cave.radiusY + 3));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cave.x;
      const dy = y - cave.y;
      const rotatedX = dx * cos - dy * sin;
      const rotatedY = dx * sin + dy * cos;
      if (rotatedX * rotatedX / (cave.radiusX * cave.radiusX) + rotatedY * rotatedY / (cave.radiusY * cave.radiusY) <= 1) mask[y * width + x] = 0;
    }
  }
  ctx.save();
  ctx.translate(cave.x, cave.y);
  ctx.rotate(cave.angle);
  const gradient = ctx.createRadialGradient(-cave.radiusX * 0.2, -cave.radiusY * 0.25, 2, 0, 0, cave.radiusX);
  gradient.addColorStop(0, "#17191b");
  gradient.addColorStop(0.7, "#282426");
  gradient.addColorStop(1, "#4f372d");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#6d4935";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, cave.radiusX, cave.radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCottage(ctx: CanvasRenderingContext2D, mask: Uint8Array, mapWidth: number, mapHeight: number, item: MapStructure) {
  const left = item.x - item.width / 2;
  const roofHeight = item.height * 0.42;
  const bodyTop = item.groundY - item.height + roofHeight;
  const bodyHeight = item.groundY - bodyTop;
  maskRect(mask, mapWidth, mapHeight, left + 3, bodyTop, item.width - 6, bodyHeight);
  maskTriangle(mask, mapWidth, mapHeight, left - 6, bodyTop + 4, item.x, item.groundY - item.height, left + item.width + 6, bodyTop + 4);
  ctx.fillStyle = item.variant % 2 ? "#b87a55" : "#d19a63";
  ctx.strokeStyle = "#4b3b37";
  ctx.lineWidth = 3;
  ctx.fillRect(left + 3, bodyTop, item.width - 6, bodyHeight);
  ctx.strokeRect(left + 3, bodyTop, item.width - 6, bodyHeight);
  ctx.fillStyle = item.variant % 2 ? "#6f473d" : "#704841";
  ctx.beginPath();
  ctx.moveTo(left - 6, bodyTop + 4);
  ctx.lineTo(item.x, item.groundY - item.height);
  ctx.lineTo(left + item.width + 6, bodyTop + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(75,59,55,.5)";
  ctx.lineWidth = 1.5;
  for (let y = bodyTop + 8; y < item.groundY; y += 9) { ctx.beginPath(); ctx.moveTo(left + 5, y); ctx.lineTo(left + item.width - 5, y); ctx.stroke(); }
  ctx.fillStyle = "#3e3333";
  ctx.fillRect(item.x - 7, item.groundY - 20, 14, 20);
  ctx.fillStyle = "#8bd2d1";
  ctx.strokeStyle = "#493a38";
  ctx.lineWidth = 2;
  ctx.fillRect(left + 8, bodyTop + 9, 11, 11);
  ctx.strokeRect(left + 8, bodyTop + 9, 11, 11);
  ctx.fillStyle = "#67504a";
  ctx.fillRect(left + item.width - 15, item.groundY - item.height + 2, 7, 17);
}

function drawTower(ctx: CanvasRenderingContext2D, mask: Uint8Array, mapWidth: number, mapHeight: number, item: MapStructure) {
  const left = item.x - item.width / 2;
  const top = item.groundY - item.height;
  maskRect(mask, mapWidth, mapHeight, left, top + 8, item.width, item.height - 8);
  for (let index = 0; index < 4; index += 1) maskRect(mask, mapWidth, mapHeight, left + index * item.width / 4, top, item.width / 7, 11);
  const stone = ctx.createLinearGradient(left, top, left + item.width, item.groundY);
  stone.addColorStop(0, "#a49a83");
  stone.addColorStop(1, "#68665f");
  ctx.fillStyle = stone;
  ctx.strokeStyle = "#444646";
  ctx.lineWidth = 3;
  ctx.fillRect(left, top + 8, item.width, item.height - 8);
  ctx.strokeRect(left, top + 8, item.width, item.height - 8);
  for (let index = 0; index < 4; index += 1) ctx.fillRect(left + index * item.width / 4, top, item.width / 7, 12);
  ctx.strokeStyle = "rgba(57,59,58,.55)";
  ctx.lineWidth = 1;
  for (let y = top + 19; y < item.groundY; y += 10) {
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + item.width, y); ctx.stroke();
    for (let x = left + ((Math.round(y) / 10) % 2 ? 8 : 16); x < left + item.width; x += 17) { ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.fillStyle = "#20292b";
  ctx.beginPath();
  ctx.roundRect(item.x - 6, item.groundY - 26, 12, 26, 6);
  ctx.fill();
}

function drawWindmill(ctx: CanvasRenderingContext2D, mask: Uint8Array, mapWidth: number, mapHeight: number, item: MapStructure) {
  const left = item.x - item.width / 2;
  const top = item.groundY - item.height;
  maskRect(mask, mapWidth, mapHeight, left + 5, top + 16, item.width - 10, item.height - 16);
  maskTriangle(mask, mapWidth, mapHeight, left, top + 18, item.x, top, left + item.width, top + 18);
  ctx.fillStyle = "#d6c39a";
  ctx.strokeStyle = "#55483e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left + 5, item.groundY);
  ctx.lineTo(left + 9, top + 16);
  ctx.lineTo(left + item.width - 9, top + 16);
  ctx.lineTo(left + item.width - 5, item.groundY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6e4f42";
  ctx.beginPath(); ctx.moveTo(left, top + 18); ctx.lineTo(item.x, top); ctx.lineTo(left + item.width, top + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#51433b";
  ctx.fillRect(item.x - 5, item.groundY - 18, 10, 18);
  const hubY = top + 25;
  ctx.save();
  ctx.translate(item.x, hubY);
  ctx.rotate(item.variant * 0.27);
  ctx.strokeStyle = "#50433b";
  ctx.lineWidth = 4;
  for (let index = 0; index < 4; index += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -31); ctx.stroke();
    ctx.fillStyle = "#b79a6c";
    ctx.beginPath(); ctx.moveTo(-3, -13); ctx.lineTo(-8, -30); ctx.lineTo(4, -34); ctx.lineTo(4, -14); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "#e5b95f";
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRuin(ctx: CanvasRenderingContext2D, mask: Uint8Array, mapWidth: number, mapHeight: number, item: MapStructure) {
  const left = item.x - item.width / 2;
  const top = item.groundY - item.height;
  const pillarWidth = item.width * 0.27;
  maskRect(mask, mapWidth, mapHeight, left, top + 5, pillarWidth, item.height - 5);
  maskRect(mask, mapWidth, mapHeight, left + item.width - pillarWidth, top + 15, pillarWidth, item.height - 15);
  maskRect(mask, mapWidth, mapHeight, left + pillarWidth, top + 11, item.width - pillarWidth * 2, 12);
  ctx.fillStyle = "#858078";
  ctx.strokeStyle = "#484847";
  ctx.lineWidth = 3;
  ctx.fillRect(left, top + 5, pillarWidth, item.height - 5);
  ctx.strokeRect(left, top + 5, pillarWidth, item.height - 5);
  ctx.fillRect(left + item.width - pillarWidth, top + 15, pillarWidth, item.height - 15);
  ctx.strokeRect(left + item.width - pillarWidth, top + 15, pillarWidth, item.height - 15);
  ctx.fillRect(left + pillarWidth, top + 11, item.width - pillarWidth * 2, 12);
  ctx.strokeRect(left + pillarWidth, top + 11, item.width - pillarWidth * 2, 12);
  ctx.strokeStyle = "#5f5d58";
  ctx.lineWidth = 1.5;
  for (let y = top + 17; y < item.groundY; y += 10) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + item.width, y + 2); ctx.stroke(); }
  ctx.fillStyle = "#3f4242";
  ctx.beginPath(); ctx.arc(item.x, item.groundY, item.width * 0.17, Math.PI, 0); ctx.lineTo(item.x + item.width * 0.17, item.groundY); ctx.closePath(); ctx.fill();
}

function drawBunker(ctx: CanvasRenderingContext2D, mask: Uint8Array, mapWidth: number, mapHeight: number, item: MapStructure) {
  const left = item.x - item.width / 2;
  const top = item.groundY - item.height;
  maskRect(mask, mapWidth, mapHeight, left + 5, top + 8, item.width - 10, item.height - 8);
  maskTriangle(mask, mapWidth, mapHeight, left, top + 14, left + 13, top, left + item.width - 10, top);
  maskTriangle(mask, mapWidth, mapHeight, left + item.width, top + 14, left + item.width - 13, top, left + 10, top);
  ctx.fillStyle = "#626c63";
  ctx.strokeStyle = "#363e3a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left, item.groundY);
  ctx.lineTo(left + 12, top);
  ctx.lineTo(left + item.width - 12, top);
  ctx.lineTo(left + item.width, item.groundY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#202a29";
  ctx.fillRect(left + 13, top + 9, item.width - 26, 6);
  ctx.strokeStyle = "#899084";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left + 8, item.groundY - 7); ctx.lineTo(left + item.width - 8, item.groundY - 10); ctx.stroke();
}

export function paintMapFeatures(ctx: CanvasRenderingContext2D, mask: Uint8Array, width: number, height: number, layout: WormMapLayout) {
  for (const cave of layout.caves) cutCave(ctx, mask, width, height, cave);
  for (const item of layout.structures) {
    ctx.save();
    if (item.kind === "cottage") drawCottage(ctx, mask, width, height, item);
    else if (item.kind === "tower") drawTower(ctx, mask, width, height, item);
    else if (item.kind === "windmill") drawWindmill(ctx, mask, width, height, item);
    else if (item.kind === "ruin") drawRuin(ctx, mask, width, height, item);
    else drawBunker(ctx, mask, width, height, item);
    ctx.restore();
  }
}
