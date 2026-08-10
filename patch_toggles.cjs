const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/const handleAutoExportToggle = \(checked: boolean\) => \{[\s\S]*?\};/,
`const handleAutoExportToggle = (checked: boolean) => {
    setAutoExport(checked);
    if (checked) setAutoExportOneByOne(false);
    if (checked && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };`);

code = code.replace(/const handleAutoExportOneByOneToggle = \(checked: boolean\) => \{[\s\S]*?\};/,
`const handleAutoExportOneByOneToggle = (checked: boolean) => {
    setAutoExportOneByOne(checked);
    if (checked) setAutoExport(false);
  };`);

fs.writeFileSync('src/App.tsx', code);
