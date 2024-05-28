import { parser } from "../parser";
import { svelteProjection } from "@puredit/projections/svelte";
import {
  LineAlignment,
  type ContextInformation,
  type RootProjection,
} from "@puredit/projections/types";
import BeginWidget from "./BeginWidget.svelte";
import EndWidget from "./EndWidget.svelte";
import { Match, agg, arg } from "@puredit/parser";
import { integerPart } from "../common/integerPart/config";

const tensor = arg("tensor", ["identifier"]);
const dimensions = agg("dimensions", "argument_list", [integerPart.pattern]);

const pattern = parser.statementPattern("permuteProjectionPattern")`${tensor}.permute${dimensions}`;

const beginWidget = svelteProjection(BeginWidget);
const endWidget = svelteProjection(EndWidget);

export const permuteProjection: RootProjection = {
  name: "PyTorch:Tensor:Permute",
  description: "Permute the dimensions of a tensor.",
  pattern,
  requiredContextVariables: [],
  segmentWidgets: [beginWidget, endWidget],
  subProjections: [integerPart],
  lineAlignment: LineAlignment.Top,
  contextProvider(match: Match, _, contextInformation: ContextInformation): ContextInformation {
    const commentContext = contextInformation.commentContext;
    if (!commentContext) {
      return { reorderedDimensions: null };
    }
    const permutation = match.aggregationToPartMatchesMap.dimensions.map((match) =>
      parseInt(match.node.text)
    );
    if (permutation.length !== commentContext.length) {
      return { reorderedDimensions: null };
    }
    const reorderedDimensions: string[] = new Array(permutation.length);
    for (let i = 0; i < permutation.length; i++) {
      const nextDimension = contextInformation.commentContext[permutation[i]];
      if (Number.isNaN(nextDimension)) {
        return { reorderedDimensions: null };
      }
      reorderedDimensions[i] = nextDimension;
    }
    return {
      reorderedDimensions,
    };
  },
};
