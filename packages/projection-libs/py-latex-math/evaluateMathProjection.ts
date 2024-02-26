import { arg, contextVariable } from "@puredit/parser";
import { svelteProjection } from "@puredit/projections/svelte";
import type { RootProjection } from "@puredit/projections/types";
import MathProjection from "./MathProjection.svelte";
import { parser } from "./parser";

const dsl = contextVariable("mathdsl");
const latex = arg("latex", ["string"]);

const pattern = parser.expressionPattern("evaluateMath")`${dsl}.evaluate(${latex}, locals())`;

const widget = svelteProjection(MathProjection);

export const evaluateMathProjection: RootProjection = {
  name: "evaluate math",
  description:
    "Evaluates an expression in mathematical notation using the variables from the current local scope.",
  pattern,
  requiredContextVariables: [],
  segmentWidgets: [widget],
  subProjections: [],
};
