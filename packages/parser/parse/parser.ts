import TemplateArgument from "../define/templateArgument";
import TemplateParameter from "../define/templateParameter";
import RawTemplate from "../define/rawTemplate";
import type { TreeSitterParser } from "../treeSitterParser";
import { createTreeSitterParser } from "../treeSitterParser";
import { PatternBuilder } from "./patternBuilder";
import { Language } from "../config/types";

export default class Parser {
  static async load(target: Language): Promise<Parser> {
    const treeSitterParser = await createTreeSitterParser(target);
    return new Parser(treeSitterParser, target);
  }

  patternBuilder: PatternBuilder;

  private constructor(
    private treeSitterParser: TreeSitterParser,
    public readonly target: Language
  ) {
    this.patternBuilder = new PatternBuilder(treeSitterParser);
  }

  parse(
    input: string | TreeSitterParser.Input,
    previousTree?: TreeSitterParser.Tree,
    options?: TreeSitterParser.Options
  ): TreeSitterParser.Tree {
    return this.treeSitterParser.parse(input, previousTree, options);
  }

  /**
   * Parses an aggregation subpattern
   * @param name Name of the aggregation subpattern
   * @returns RawTemplate
   */
  subPattern(name: string) {
    return (template: TemplateStringsArray, ...params: (string | TemplateArgument)[]) => {
      return new RawTemplate(template, params, name);
    };
  }

  /**
   * Parses a statement pattern
   * @param name Name of the statement pattern
   * @returns Pattern
   */
  statementPattern(name: string) {
    return (template: TemplateStringsArray, ...params: (string | TemplateParameter)[]) => {
      const rawTemplate = new RawTemplate(template, params, name);
      return this.patternBuilder
        .setName(name)
        .setRawTemplate(rawTemplate)
        .setTargetLanguage(this.target)
        .setIsExpression(false)
        .build();
    };
  }

  /**
   * Parses an expression pattern
   * @param name Name of the expression pattern
   * @returns Pattern
   */
  expressionPattern(name: string) {
    return (template: TemplateStringsArray, ...params: (string | TemplateParameter)[]) => {
      const rawTemplate = new RawTemplate(template, params, name);
      return this.patternBuilder
        .setName(name)
        .setRawTemplate(rawTemplate)
        .setTargetLanguage(this.target)
        .setIsExpression(true)
        .build();
    };
  }
}
