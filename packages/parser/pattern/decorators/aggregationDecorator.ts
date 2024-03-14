import Pattern from "../pattern";
import PatternDecorator from "./patternDecorator";
import { createPatternMap } from "../../common";
import { PatternsMap } from "../../match/types";

export default class AggregationDecorator extends PatternDecorator {
  constructor(
    pattern: Pattern,
    private aggregationPatternMap: PatternsMap,
    private aggregationTypeMap: Record<string, string>
  ) {
    super(pattern);
  }

  getAggregationPatternMapFor(aggregationName: string): PatternsMap {
    const subPatterns = this.aggregationPatternMap[aggregationName];
    if (!subPatterns) {
      throw new Error(`Aggregation with name ${aggregationName} not found`);
    }
    return createPatternMap(subPatterns);
  }

  getSubPatternsFor(aggregationName: string): Pattern[] {
    return this.aggregationPatternMap[aggregationName];
  }

  getNodeTypeFor(aggregationName: string): string {
    return this.aggregationTypeMap[aggregationName];
  }

  hasAggregations(): boolean {
    return !!this.aggregationPatternMap;
  }
}
