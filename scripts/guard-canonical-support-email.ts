import fs from "fs";
import path from "path";

function getFiles(dir: string, ext: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, ext));
    } else if (ext.includes(path.extname(file))) {
      results.push(filePath);
    }
  });
  return results;
}

const foldersToScan = ["app", "components", "lib"];
const extensions = [".ts", ".tsx", ".js", ".jsx"];
let offendingCount = 0;

foldersToScan.forEach(folder => {
  const dirPath = path.join(process.cwd(), folder);
  if (!fs.existsSync(dirPath)) return;
  const files = getFiles(dirPath, extensions);
  
  files.forEach(file => {
    if (file.includes("guard-canonical-support-email") || file.includes("verify-navigation-routes")) return;
    
    const content = fs.readFileSync(file, "utf8");
    const emailRegex = /[a-zA-Z0-9._%+-]+@cbamvalid\.com/gi;
    let match;
    while ((match = emailRegex.exec(content)) !== null) {
      const email = match[0].toLowerCase();
      if (email !== "info@cbamvalid.com") {
        console.error(`Offending email "${email}" found in ${file}`);
        offendingCount++;
      }
    }
  });
});

console.log(`OTHER_PUBLIC_CBAMVALID_EMAIL_COUNT=${offendingCount}`);
if (offendingCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
