// اختبار لمرة واحدة: بيطبع شكل رد /v1/floors (طلبين فقط). التوكن من Secret ومش بيتطبع.
const T = process.env.SEE_TOKEN;
if (!T) { console.log("SEE_TOKEN missing"); process.exit(1); }
for (const q of ["by=collection&limit=2", "by=model&collection=PlushPepe&limit=2"]) {
  const r = await fetch("https://kartoshka.free/v1/floors?" + q, { headers: { Authorization: "Bearer " + T } });
  console.log("==", q, "status", r.status, "free-left", r.headers.get("x-free-remaining"), "cost", r.headers.get("x-request-cost"));
  const txt = await r.text();
  console.log(txt.slice(0, 1800));
}
