import AstCursor from "../../ast/cursor";
import Template from "../template";
import { Context } from "../../match/types";
import TemplateParameter from "./templateParameter";
import PatternNode from "../../pattern/nodes/patternNode";
import { Language } from "@puredit/language-config";
import TemporaryAggregationNode from "../../pattern/nodes/temporaryAggregationNode";

export default class TemplateAggregation extends TemplateParameter {
  static readonly CODE_STRING_PREFIX = "__template_agg_";

  constructor(
    public readonly name: string,
    public readonly subPatterns: Template[],
    public readonly context: Context = {}
  ) {
    super();
  }

  toCodeString(): string {
    if (this._id === undefined) {
      this._id = TemplateParameter.issueId();
    }
    return TemplateAggregation.CODE_STRING_PREFIX + this._id.toString();
  }

  getCodeStringsForParts(): string[] {
    return this.subPatterns.map((pattern) => pattern.toCodeString());
  }

  toPatternNode(cursor: AstCursor, language: Language): PatternNode {
    return new TemporaryAggregationNode(
      language,
      cursor.currentNode.text,
      cursor.currentFieldName,
      cursor.currentNode.type,
      this
    );
  }

  toDraftString(): string {
    return this.subPatterns[0].toDraftString();
  }
}
