const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = code.replace(/const updateSW = registerSW\(\{[\s\S]*?immediate: true \}\);/,
`const updateSW = registerSW({
  onRegistered(r) {
    if (r) {
      setInterval(() => {
        r.update();
      }, 20000); // Check for updates every 20s
    }
  },
  onNeedRefresh() {
    // Force the new SW to activate and reload the page
    if ('caches' in window) {
       caches.keys().then((names) => {
         names.forEach(name => {
           caches.delete(name);
         });
       });
    }
    window.location.reload();
  },
  immediate: true
});`);

fs.writeFileSync('src/main.tsx', code);
