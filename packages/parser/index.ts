import Parser from "./parse/parser";

export { Parser };
export { arg, agg, block, contextVariable } from "./define/definitionFunctions";
export { PatternMatching } from "./match/patternMatching";
export { Target } from "./treeSitterParser";
export { createPatternMap } from "./common";
export type {
  SyntaxNode,
  PatternNode,
  PatternMap,
  ArgMap,
  Match,
  Context,
} from "./types";
export { AggregationCardinality } from "./define/templateAggregation";
