import { svelteProjection } from "@puredit/projections";
import type { SubProjection } from "@puredit/projections/types";
import { parser } from "../../parser";
import Widget from "./Widget.svelte";
import { arg } from "@puredit/parser";

const index = arg("index", ["integer"]);
const template = parser.subPattern("PyTorch:Tensor:Slice:SingleItem")`${index}`;

const widget = svelteProjection(Widget);

export const singleItemSubProjection: SubProjection = {
  template,
  description: "Select a single item.",
  requiredContextVariables: [],
  segmentWidgets: [widget],
};
