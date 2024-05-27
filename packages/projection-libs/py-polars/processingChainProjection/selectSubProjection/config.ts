import { svelteProjection } from "@puredit/projections/svelte";
import type { SubProjection } from "@puredit/projections/types";
import BeginWidget from "./BeginWidget.svelte";
import EndWidget from "./EndWidget.svelte";

import { parser } from "../../parser";
import { agg } from "@puredit/parser";
import { columnSubProjection } from "../columnSubProjection/config";
import { columnChainSubProjection } from "../columnChainSubProjection/config";

const columns = agg("columns", "argument_list", [
  columnSubProjection.pattern,
  columnChainSubProjection.pattern,
]);
const selectFunction = parser.subPattern("selectFunction")`select${columns}`;

const beginWidget = svelteProjection(BeginWidget);
const endWidget = svelteProjection(EndWidget);

export const selectSubProjection: SubProjection = {
  name: "Select Column",
  description: "Select a column from a dataframe",
  pattern: selectFunction,
  requiredContextVariables: [],
  segmentWidgets: [beginWidget, endWidget],
};
