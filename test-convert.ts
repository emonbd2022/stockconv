import * as fs from 'fs';
import { convertImage } from './src/utils';

// Polyfill File
class File extends Blob {
  name: string;
  constructor(bits: any[], name: string, options?: any) {
    super(bits, options);
    this.name = name;
  }
}
(global as any).File = File;

async function main() {
  const buf = fs.readFileSync('test.png');
  const file = new File([buf], 'test.png', { type: 'image/png' });
  console.log("Calling convertImage...");
  
  // Create a timeout to see if it hangs
  setTimeout(() => {
    console.log("TIMEOUT! It hung!");
    process.exit(1);
  }, 3000);
  
  try {
    const blob = await convertImage(file as unknown as globalThis.File, "pixelzone");
    console.log("Successfully converted. Size:", blob.size);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
