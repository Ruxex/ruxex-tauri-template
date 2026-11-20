import { existsSync, readFileSync, readdirSync } from "node:fs";
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

function humanizeSegment(segment) {
  const acronyms = new Map([
    ["api", "API"],
    ["mcp", "MCP"],
    ["oauth", "OAuth"],
    ["ui", "UI"],
  ]);

  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => acronyms.get(word.toLowerCase()) ?? capitalize(word))
    .join(" ");
}

function capitalize(word) {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function expectedStoryTitle(componentFile) {
  const [granularity, category, filename] = componentFile.split("/");

  return [granularity, category, filename.replace(/\.tsx$/, "")]
    .map(humanizeSegment)
    .join(" / ");
}

export function findUngroupedStories(root) {
  return collectComponentFiles(root).flatMap((componentFile) => {
    const storyFile = componentFile.replace(/\.tsx$/, ".stories.tsx");
    if (!existsSync(join(root, storyFile))) return [];

    const source = readFileSync(join(root, storyFile), "utf8");
    const title = source.match(
      /export\s+default\s*\{\s*title\s*:\s*["']([^"']+)["']\s*\}/,
    )?.[1];

    return title === expectedStoryTitle(componentFile)
      ? []
      : [{ componentFile, expectedTitle: expectedStoryTitle(componentFile), title }];
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

  const ungrouped = findUngroupedStories(componentsRoot);
  if (ungrouped.length > 0) {
    console.error("Ladle stories missing their granularity hierarchy:");
    for (const { componentFile, expectedTitle } of ungrouped) {
      console.error(`- src/components/${componentFile} (expected: ${expectedTitle})`);
    }
    process.exitCode = 1;
    return;
  }

  const count = collectComponentFiles(componentsRoot).length;
  console.log(
    `All ${count} component files have colocated Ladle stories with grouped titles.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
