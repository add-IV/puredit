import { parser } from "../../parser";
import { svelteProjection } from "@puredit/projections/svelte";
import type { SubProjection } from "@puredit/projections/types";
import BeginWidget from "./BeginWidget.svelte";
import ValuesWidget from "./ValuesWidget.svelte";
import ColumnsWidget from "./ColumnsWidget.svelte";
import EndWidget from "./EndWidget.svelte";
import { agg, arg } from "@puredit/parser";
import { columnSubProjection } from "../columnSubProjection/config";

const index = agg("indexColumns", "list", [columnSubProjection.pattern]);
const values = agg("valueColumns", "list", [columnSubProjection.pattern]);
const columns = agg("columnColumns", "list", [columnSubProjection.pattern]);
const aggFunction = arg("aggFunction", ["string"]);
const pattern = parser.subPattern(
  "pivotProjectionPattern"
)`pivot(index=${index}, columns=${columns}, values=${values}, aggregate_function=${aggFunction})`;

const beginWidget = svelteProjection(BeginWidget);
const valuesWidget = svelteProjection(ValuesWidget);
const columnsWidget = svelteProjection(ColumnsWidget);
const endWidget = svelteProjection(EndWidget);

export const pivotSubProjection: SubProjection = {
  name: "Polars:Dataframe:Pivot",
  description: "Create a pivot table from a dataframe.",
  pattern,
  requiredContextVariables: [],
  segmentWidgets: [beginWidget, columnsWidget, valuesWidget, endWidget],
};
