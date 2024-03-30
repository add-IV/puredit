import { parser } from "../parser";
import { svelteProjection } from "@puredit/projections/svelte";
import type { ContextInformation, RootProjection } from "@puredit/projections/types";
import BeginWidget from "./BeginWidget.svelte";
import EndWidget from "./EndWidget.svelte";
import { Match, agg, arg } from "@puredit/parser";

import { fromBeginningSubProjection } from "./fromBeginningSubProjection/config";
import { untilEndSubProjection } from "./untilEndSubProjection/config";
import { betweenIndicesSubProjection } from "./betweenIndicesSubProjection/config";
import { singleItemSubProjection } from "./singleItemSubProjection/config";

const targetTensor = arg("targetTensor", ["identifier"]);
const baseTensor = arg("baseTensor", ["identifier"]);
const startPattern = parser.subPattern("baseTensor")`${baseTensor}`;
const slices = agg(
  "slices",
  "subscript",
  [
    fromBeginningSubProjection.pattern,
    untilEndSubProjection.pattern,
    betweenIndicesSubProjection.pattern,
    singleItemSubProjection.pattern,
  ],
  startPattern
);
const pattern = parser.statementPattern("sliceProjectionPattern")`${targetTensor} = ${slices}`;

const beginWidget = svelteProjection(BeginWidget);
const endWidget = svelteProjection(EndWidget);

export const sliceProjection: RootProjection = {
  name: "Slice",
  description: "Extract a slice from a tensor.",
  pattern,
  requiredContextVariables: [],
  segmentWidgets: [beginWidget, endWidget],
  subProjections: [
    fromBeginningSubProjection,
    untilEndSubProjection,
    betweenIndicesSubProjection,
    singleItemSubProjection,
  ],
  contextProvider(match: Match, _, contextInformation: ContextInformation): ContextInformation {
    return {
      commentContext: contextInformation.commentContext,
      sliceMatches: match.aggregationToPartMatchesMap.slices,
    };
  },
};