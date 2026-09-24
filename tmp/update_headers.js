const fs = require("fs");
const path = require("path");

const adminDir = path.join(process.cwd(), "src/pages/admin");
const files = fs.readdirSync(adminDir);

let modifiedCount = 0;

for (const file of files) {
  if (!file.endsWith(".tsx")) continue;
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  content = content.replace(/<h1 className="([^"]*)"/g, (match, p1) => {
    if (p1.includes("ui-page-title")) return match;
    let cleaned = p1
      .replace(/text-(xl|2xl|3xl|4xl|5xl)/g, "")
      .replace(/font-(bold|extrabold|black|semibold)/g, "")
      .replace(/tracking-tight/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return `<h1 className="ui-page-title ${cleaned}"`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    modifiedCount++;
    console.log("Updated admin file:", file);
  }
}

console.log("Total admin files updated:", modifiedCount);
