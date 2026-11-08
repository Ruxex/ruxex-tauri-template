import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

function collectComponentFiles(root, current = root) {
  const files = [];

  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectComponentFiles(root, path));
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith(".tsx") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".stories.tsx")
    ) {
      files.push(relative(root, path).split("\\").join("/"));
    }
  }

  return files.sort();
}

export function findMissingStories(root) {
  const componentFiles = collectComponentFiles(root);

  return componentFiles.filter((componentFile) => {
    const storyFile = componentFile.replace(/\.tsx$/, ".stories.tsx");
    return !existsSync(join(root, storyFile));
  });
}

function main() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const componentsRoot = join(repositoryRoot, "src", "components");
  const missing = findMissingStories(componentsRoot);

  if (missing.length > 0) {
    console.error("Missing colocated Ladle stories:");
    for (const component of missing) {
      console.error(`- src/components/${component}`);
    }
    process.exitCode = 1;
    return;
  }

  const count = collectComponentFiles(componentsRoot).length;
  console.log(`All ${count} component files have colocated Ladle stories.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
