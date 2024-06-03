import { arg, contextVariable } from "@puredit/parser";
import { svelteProjection } from "@puredit/projections";
import type { RootProjection } from "@puredit/projections/types";
import MathProjection from "./MathProjection.svelte";
import { pythonParser } from "./parser";

const dsl = contextVariable("mathdsl");
const latex = arg("latex", ["string"]);

export const pattern = pythonParser.expressionPattern("evaluateMath")`
${dsl}.evaluate(${latex}, locals())
`;

export const widget = svelteProjection(MathProjection);

export const evaluateMathProjection: RootProjection = {
  name: "evaluate math",
  description:
    "Evaluates an expression in mathematical notation using the variables from the current local scope.",
  pattern,
  requiredContextVariables: [],
  segmentWidgets: [widget],
};
