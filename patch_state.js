const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const stateBlock = `  const [autoExportOneByOne, setAutoExportOneByOne] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoExportOneByOne');
    return saved === 'true';
  });
  useEffect(() => {
    localStorage.setItem('autoExportOneByOne', autoExportOneByOne.toString());
  }, [autoExportOneByOne]);

  const autoExportOneByOneRef = useRef(autoExportOneByOne);
  useEffect(() => {
    autoExportOneByOneRef.current = autoExportOneByOne;
  }, [autoExportOneByOne]);

  const handleAutoExportOneByOneToggle = (checked: boolean) => {
    setAutoExportOneByOne(checked);
  };

`;

code = code.replace("const [autoExport, setAutoExport] = useState<boolean>(() => {", stateBlock + "  const [autoExport, setAutoExport] = useState<boolean>(() => {");

fs.writeFileSync('src/App.tsx', code);
