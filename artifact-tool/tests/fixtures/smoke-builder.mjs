import { Workbook } from "@ruxex/artifact-tool";

const outputIndex = process.argv.indexOf("--output") + 1;
const output = process.argv[outputIndex];
if (!output) throw new Error("--output is required");

const workbook = await Workbook.create();
const sheet = workbook.worksheets.add("Smoke");
sheet.getRange("A1:B2").values = [["Name", "Count"], ["Ada", 3]];
workbook.recalculate();
await workbook.inspect({ kind: "sheet", sheetName: "Smoke" });
await workbook.exportXlsx(output);
