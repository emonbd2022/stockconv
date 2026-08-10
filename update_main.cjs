const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = code.replace(/registerSW\(\{ immediate: true \}\);/,
`const updateSW = registerSW({ 
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
  immediate: true 
});`);

fs.writeFileSync('src/main.tsx', code);
