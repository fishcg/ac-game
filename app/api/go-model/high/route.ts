const HIGH_MODEL_URL = "https://acgay.oss-cn-hangzhou.aliyuncs.com/ac-game/models/go/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz";
const FORWARDED_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

async function proxyModel(request: Request, includeBody: boolean) {
  const range = request.headers.get("range");
  const upstream = await fetch(HIGH_MODEL_URL, {
    cache: "no-store",
    method: includeBody ? "GET" : "HEAD",
    headers: range ? { Range: range } : undefined,
  });
  if (!upstream.ok && upstream.status !== 206) {
    return Response.json({ error: "高棋力模型暂时不可用" }, { status: 502 });
  }

  const headers = new Headers();
  FORWARDED_HEADERS.forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  });
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(includeBody ? upstream.body : null, { status: upstream.status, headers });
}

export async function GET(request: Request) {
  return proxyModel(request, true);
}

export async function HEAD(request: Request) {
  return proxyModel(request, false);
}
