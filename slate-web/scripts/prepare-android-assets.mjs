import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPublicDir = path.resolve(__dirname, "../.output/public");
const assetsDir = path.join(outputPublicDir, "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("Assets directory not found. Please run 'npm run build' first.");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const cssFile = files.find((f) => f.startsWith("styles-") && f.endsWith(".css")) || "";
const indexJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js")) || "";
const rolldownJs = files.find((f) => f.startsWith("rolldown-runtime-") && f.endsWith(".js")) || "";
const storeJs = files.find((f) => f.startsWith("store-") && f.endsWith(".js")) || "";
const jsxJs = files.find((f) => f.startsWith("jsx-runtime-") && f.endsWith(".js")) || "";
const routesJs = files.find((f) => f.startsWith("routes-") && f.endsWith(".js")) || "";

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <title>Slate — Whiteboard</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon" />
  <link rel="preload" as="image" href="/sti-logo.png" />
  ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : ""}
  ${indexJs ? `<link rel="modulepreload" href="/assets/${indexJs}" />` : ""}
  ${rolldownJs ? `<link rel="modulepreload" href="/assets/${rolldownJs}" />` : ""}
  ${storeJs ? `<link rel="modulepreload" href="/assets/${storeJs}" />` : ""}
  ${jsxJs ? `<link rel="modulepreload" href="/assets/${jsxJs}" />` : ""}
  ${routesJs ? `<link rel="modulepreload" href="/assets/${routesJs}" />` : ""}
</head>
<body class="bg-background text-foreground antialiased overscroll-none select-none">
  <div id="root"></div>
  <script class="$tsr" id="$tsr-stream-barrier">
    (self.$R=self.$R||{})["tsr"]=[];
    self.$_TSR={h(){this.hydrated=!0,this.c()},e(){this.streamEnded=!0,this.c()},c(){this.hydrated&&this.streamEnded&&(delete self.$_TSR,delete self.$R.tsr)},p(e){this.initialized?e():this.buffer.push(e)},buffer:[]};
    $_TSR.router=($R=>$R[0]={manifest:$R[1]={routes:$R[2]={__root__:$R[3]={preloads:$R[4]=[${[indexJs, rolldownJs, storeJs, jsxJs].filter(Boolean).map(f => `"/assets/${f}"`).join(",")}],scripts:$R[5]=[$R[6]={attrs:$R[7]={type:"module",async:!0,src:"/assets/${indexJs}"}}]},"/":$R[8]={preloads:$R[9]=[${routesJs ? `"/assets/${routesJs}"` : ""}]}}},matches:$R[10]=[$R[11]={i:"__root__ ",u:Date.now(),s:"success",ssr:!0}],lastMatchId:" "})($R["tsr"]);
    $_TSR.e();
    document.currentScript.remove();
  </script>
  <script type="module" async src="/assets/${indexJs}"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(outputPublicDir, "index.html"), htmlContent, "utf-8");
console.log("Successfully generated .output/public/index.html with current build assets.");
