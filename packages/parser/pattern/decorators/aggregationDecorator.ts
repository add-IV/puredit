import Pattern from "../pattern";
import PatternDecorator from "./patternDecorator";
import { PatternsMap } from "../types";
import { createPatternMap } from "../../common";
import { PatternMap } from "../../match/types";

export default class AggregationDecorator extends PatternDecorator {
  constructor(pattern: Pattern, private aggregationPatternMap: PatternsMap) {
    super(pattern);
  }

  getAggregationPatternMapFor(aggregationName: string): PatternsMap {
    const subPatterns = this.aggregationPatternMap[aggregationName];
    if (!subPatterns) {
      throw new Error(`Aggregation with name ${aggregationName} not found`);
    }
    return createPatternMap(subPatterns);
  }

  hasAggregations(): boolean {
    return !!this.aggregationPatternMap;
  }
}
