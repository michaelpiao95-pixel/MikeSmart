const sharp = require("sharp");
const path = require("path");

const src = path.join(__dirname, "../public/favicon.png");
const pub = path.join(__dirname, "../public");

async function run() {
  // Trim the white background so the logo fills the entire canvas,
  // then resize — this makes it as large/visible as possible at small sizes.
  const trimmed = await sharp(src)
    .trim({ background: "#ffffff", threshold: 20 })
    .toBuffer();

  await sharp(trimmed)
    .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(pub, "favicon.ico"));
  console.log("✓ public/favicon.ico (32x32, trimmed)");

  await sharp(trimmed)
    .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(pub, "apple-touch-icon.png"));
  console.log("✓ public/apple-touch-icon.png (180x180, trimmed)");
}

run().catch(console.error);
