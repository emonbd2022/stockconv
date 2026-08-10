const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(/import \{ \s*onAuthStateChanged, \s*signInWithPopup, \s*GoogleAuthProvider, \s*signOut,\s*User as FirebaseUser\s*\} from 'firebase\/auth';/,
`import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  browserPopupRedirectResolver
} from 'firebase/auth';`);

code = code.replace(/await signInWithPopup\(auth, provider\);/,
`await signInWithPopup(auth, provider, browserPopupRedirectResolver);`);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
