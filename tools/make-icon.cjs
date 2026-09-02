// Regenerate electron-assets/icon.png as a clean 512x512 from the source logo.
// Run headless via Electron (already a devDependency): `npm run icon`.
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const src = path.join(__dirname, '..', 'public', 'resonance-logo.png');
  const out = path.join(__dirname, '..', 'electron-assets', 'icon.png');
  const img = nativeImage.createFromPath(src);
  if (img.isEmpty()) {
    console.error('Could not read', src);
    app.exit(1);
    return;
  }
  const resized = img.resize({ width: 512, height: 512, quality: 'best' });
  fs.writeFileSync(out, resized.toPNG());
  const { width, height } = resized.getSize();
  console.log(`wrote ${out} — ${width}x${height}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  app.exit(0);
});
