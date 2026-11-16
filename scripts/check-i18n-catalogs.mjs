import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), "../src/locales");
const issues = [];

function loadCatalogs(locale) {
  const catalogs = new Map();
  for (const name of readdirSync(join(root, locale)).sort()) {
    if (!name.endsWith(".json")) continue;
    const namespace = name.slice(0, -5);
    const messages = JSON.parse(readFileSync(join(root, locale, name), "utf8"));
    catalogs.set(namespace, flattenMessages(messages, `${locale}/${namespace}`));
  }
  return catalogs;
}

function flattenMessages(messages, location, prefix = "", result = new Map()) {
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) {
    issues.push(`${location}: invalid catalog object`);
    return result;
  }
  for (const [key, message] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (message && typeof message === "object" && !Array.isArray(message)) {
      flattenMessages(message, location, path, result);
    } else {
      result.set(path, message);
      if (typeof message !== "string") {
        issues.push(`${location}: invalid message: ${path}`);
      } else if (!message.trim()) {
        issues.push(`${location}: empty message: ${path}`);
      }
    }
  }
  return result;
}

function interpolationNames(message) {
  return [...new Set(
    [...message.matchAll(/{{-?\s*([^},]+)(?:,[^}]+)?}}/g)].map((match) => match[1].trim()),
  )].sort().join(",");
}

try {
  const english = loadCatalogs("en");
  const japanese = loadCatalogs("ja");
  if (english.size === 0) issues.push("en: no catalog namespaces found");
  for (const [namespace, source] of english) {
    const translation = japanese.get(namespace);
    if (!translation) {
      issues.push(`ja: missing namespace: ${namespace}`);
      continue;
    }
    for (const [key, message] of source) {
      if (!translation.has(key)) {
        issues.push(`ja/${namespace}: missing key: ${key}`);
      } else if (
        typeof message === "string" &&
        typeof translation.get(key) === "string" &&
        interpolationNames(message) !== interpolationNames(translation.get(key))
      ) {
        issues.push(`ja/${namespace}: interpolation mismatch: ${key}`);
      }
    }
    for (const key of translation.keys()) {
      if (!source.has(key)) issues.push(`ja/${namespace}: extra key: ${key}`);
    }
  }
  for (const namespace of japanese.keys()) {
    if (!english.has(namespace)) issues.push(`ja: extra namespace: ${namespace}`);
  }
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${english.size} English/Japanese catalog namespaces.`);
  }
} catch (error) {
  console.error(`Cannot validate catalogs: ${error.message}`);
  process.exitCode = 1;
}
