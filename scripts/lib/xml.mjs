// Minimal tolerant XML extraction for vedur.is's fixed forecast shape ONLY:
//   <forecasts><station id=".."><name>..<atime>..<forecast><ftime>..<F>..<D>..<T>..<W>..
// Not a general XML parser (~regex over a known-regular document).

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

export function decodeEntities(s) {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

/** All <tag ...>inner</tag> blocks as { attrs, inner }. */
export function blocks(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) out.push({ attrs: parseAttrs(m[1]), inner: m[2] });
  return out;
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(s)) !== null) attrs[m[1]] = decodeEntities(m[2]);
  return attrs;
}

/** Text of the first <tag>…</tag> inside `xml`, or null. CDATA unwrapped. */
export function text(xml, tag) {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!m) return null;
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return raw === "" ? null : decodeEntities(raw);
}
