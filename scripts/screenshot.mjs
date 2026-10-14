import { chromium } from "playwright";
const [,, url, out, w = "1280", full = "1"] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage({ viewport: { width: +w, height: 900 } });
await p.goto(url, { waitUntil: "networkidle" });
await p.screenshot({ path: out, fullPage: full === "1" });
await b.close();
