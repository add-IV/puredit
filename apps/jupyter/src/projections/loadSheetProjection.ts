import { arg, block, contextVariable } from "@puredit/parser";
import { svelteProjection } from "@puredit/projections";
import type { RootProjection } from "@puredit/projections/types";
import LoadSheetProjection from "./LoadSheetProjection.svelte";
import { pythonParser } from "./parser";

const dsl = contextVariable("dsl");
const fileName = arg("fileName", ["string"]);
const sheetName = arg("sheetName", ["string"]);

export const pattern = pythonParser.statementPattern("loadSheet")`
with ${dsl}.load_sheet(${fileName}, ${sheetName}) as sheet:
    ${block({ sheet: "sheet" })}
`;

export const widget = svelteProjection(LoadSheetProjection);

export const loadSheetProjection: RootProjection = {
  name: "load sheet",
  description: "Loads a sheet from an Excel file",
  pattern,
  requiredContextVariables: ["dsl"],
  segmentWidgets: [widget],
};
