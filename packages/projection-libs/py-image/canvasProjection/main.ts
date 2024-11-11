import { arg, contextVariable } from "@puredit/parser";
import { svelteProjection } from "@puredit/projections";
import type { RootProjection } from "@puredit/projections/types";
import Widget from "./Widget.svelte";
import { parser } from "../parser";

const str = arg("str", ["string"]);

const pattern = parser.expressionPattern("Image:Canvas")`showCanvas(${str})`;

const widget = svelteProjection(Widget);

export const canvasProjection: RootProjection = {
  pattern,
  description: "Creates a red square inside of a white square",
  requiredContextVariables: [],
  segmentWidgets: [widget],
  subProjections: [],
};
