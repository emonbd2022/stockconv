const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

code = code.replace(/import \{ initializeAuth, browserLocalPersistence, indexedDBLocalPersistence \} from 'firebase\/auth';/,
`import { getAuth } from 'firebase/auth';`);

code = code.replace(/export const auth = initializeAuth\(app, \{\s*persistence: \[indexedDBLocalPersistence, browserLocalPersistence\]\s*\}\);/,
`export const auth = getAuth(app);`);

fs.writeFileSync('src/firebase.ts', code);
