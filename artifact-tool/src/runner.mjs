import { pathToFileURL } from "node:url";

const builder = process.argv[2];
if (!builder) {
  console.error(JSON.stringify({ ok: false, error: { code: "invalid_arguments", message: "builder path is required" } }));
  process.exitCode = 1;
} else {
  try {
    await import(pathToFileURL(builder).href);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: { code: error.code ?? "builder_error", message: error.message ?? String(error) },
    }));
    process.exitCode = 1;
  }
}
