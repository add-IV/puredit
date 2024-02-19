import PatternNode from "./patternNode";
import TemplateAggregation from "../../define/templateAggregation";
import AstCursor from "../../ast/cursor";
import { Language } from "../../config/types";
import { loadAggregatableNodeTypeConfigFor, loadAggregationsConfigFor } from "../../config/load";

export default class AggregationNode extends PatternNode {
  static readonly TYPE = "AggregationNode";

  public readonly startToken: string;
  public readonly delimiterToken: string;
  public readonly endToken: string;

  constructor(
    language: Language,
    text: string,
    fieldName: string | undefined,
    public astNodeType: string,
    public readonly templateAggregation: TemplateAggregation
  ) {
    super(language, AggregationNode.TYPE, text, fieldName);

    const nodeTypeConfig = loadAggregatableNodeTypeConfigFor(language, astNodeType);
    if (!nodeTypeConfig) {
      throw new Error(
        `AST node type ${astNodeType} of language ${language} is not supported for aggregation`
      );
    }

    this.startToken = nodeTypeConfig.startToken;
    this.delimiterToken = nodeTypeConfig.delimiterToken;
    this.endToken = nodeTypeConfig.endToken;
  }

  getMatchedTypes(): string[] {
    return [this.astNodeType];
  }

  matches(astCursor: AstCursor): boolean {
    const astNode = astCursor.currentNode;
    return this.astNodeType === astNode.type && this.fieldName === astCursor.currentFieldName;
  }
}
