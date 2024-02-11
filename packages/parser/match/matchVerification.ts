import AstCursor, { Keyword } from "../ast/cursor";
import type {
  CandidateMatch,
  CodeRange,
  CodeRangeMap,
  CodeRangesMap,
  VerificationResult,
} from "./types";
import { Language, PatternMatching, createPatternMap, type Context } from "..";
import Pattern from "../pattern/pattern";
import ArgumentNode from "../pattern/nodes/argumentNode";
import BlockNode from "../pattern/nodes/blockNode";
import PatternCursor from "../pattern/cursor";
import RegularNode from "../pattern/nodes/regularNode";
import AggregationNode from "../pattern/nodes/aggregationNode";
import ChainNode from "../pattern/nodes/chainNode";
import { loadChainsConfigFor } from "../config/load";
import ChainDecorator from "../pattern/decorators/chainDecorator";

import { logProvider } from "../../../logconfig";
import AstNode from "../ast/node";
const logger = logProvider.getLogger("parser.match.MatchVerification");

export default class MatchVerification {
  private pattern: Pattern;
  private patternCursor: PatternCursor;
  private astCursor: AstCursor;
  private context: Context;

  private argsToAstNodeMap: Record<string, AstNode> = {};
  private blockRanges: CodeRange[] = [];
  private aggregationToRangesMap: CodeRangesMap = {};
  private chainToStartRangeMap: CodeRangeMap = {};
  private chainToLinkRangesMap: CodeRangesMap = {};

  constructor(private candidateMatch: CandidateMatch) {
    this.pattern = this.candidateMatch.pattern;
    this.patternCursor = new PatternCursor(this.pattern);
    this.astCursor = this.candidateMatch.cursor;
    this.context = this.candidateMatch.context;
  }

  /**
   * Checks if the pattern of this CandidateMatch actually matches the
   * AST at the position of the cursor by recursively creating new
   * CandateMatches for the child nodes in a depth-first manner.
   */
  public execute(lastSiblingKeyword?: Keyword): VerificationResult {
    logger.debug("Starting new verification of CandidateMatch");
    this.recurse(lastSiblingKeyword);
    return {
      pattern: this.pattern,
      node: this.astCursor.currentNode,
      argsToAstNodeMap: this.argsToAstNodeMap,
      blockRanges: this.blockRanges,
      aggregationToRangesMap: this.aggregationToRangesMap,
      chainToStartRangeMap: this.chainToStartRangeMap,
      chainToLinkRangesMap: this.chainToLinkRangesMap,
    };
  }

  private recurse(lastSiblingKeyword?: Keyword) {
    const currentPatternNode = this.patternCursor.currentNode;
    const currentAstNode = this.astCursor.currentNode;
    logger.debug(
      `Pattern node type: ${currentPatternNode.type}, ` +
        `AST node type: ${currentAstNode.cleanNodeType}`
    );

    this.checkNoErrorToken();
    this.skipLeadingCommentsInBodies();

    if (currentPatternNode instanceof ArgumentNode) {
      this.visitArgumentNode();
    } else if (currentPatternNode instanceof AggregationNode) {
      this.visitAggregationNode();
    } else if (currentPatternNode instanceof ChainNode) {
      this.visitChainNode();
    } else if (currentPatternNode instanceof BlockNode) {
      this.visitBlockNode(lastSiblingKeyword);
    } else if (currentPatternNode instanceof RegularNode) {
      this.visitRegularNode();
    } else {
      logger.debug(`Unsupported node type ${currentPatternNode.type} encountered`);
      throw new DoesNotMatch();
    }
  }

  private visitArgumentNode() {
    const argumentNode = this.patternCursor.currentNode as ArgumentNode;
    if (!argumentNode.matches(this.astCursor)) {
      logger.debug("AST does not match ArgumentNode");
      throw new DoesNotMatch();
    }
    this.argsToAstNodeMap[argumentNode.templateArgument.name] = this.astCursor.currentNode;
  }

  private visitAggregationNode() {
    const aggregationNode = this.patternCursor.currentNode as AggregationNode;
    if (!aggregationNode.matches(this.astCursor)) {
      logger.debug("AST node does not match AggregationNode");
      throw new DoesNotMatch();
    }
    const aggregationRanges = this.extractAggregationRangesFor(aggregationNode);
    this.aggregationToRangesMap[aggregationNode.templateAggregation.name] = aggregationRanges;
  }

  private visitChainNode() {
    const chainNode = this.patternCursor.currentNode as ChainNode;
    if (!chainNode.matches(this.astCursor)) {
      logger.debug("AST node does not match ChainNode");
      throw new DoesNotMatch();
    }
    if (chainNode.hasChildren()) {
      this.visitChainNodeChildren();
    } else {
      logger.debug("ChainNode does not have children");
      throw new DoesNotMatch();
    }
  }

  private visitChainNodeChildren() {
    const chainNode = this.patternCursor.currentNode as ChainNode;
    const pattern = this.pattern as ChainDecorator;
    const chainsConfig = loadChainsConfigFor(chainNode.language);
    const pathToNextChainLink = chainsConfig.pathToNextChainLink;
    const startPattern = pattern.getStartPatternFor(chainNode.templateChain.name);
    while (this.astCursor.follow(pathToNextChainLink)) {
      if (this.astCursor.currentNode.type === chainsConfig.chainNodeType) {
        continue;
      }
      const startPatternMatching = new PatternMatching(
        createPatternMap([startPattern]),
        this.astCursor,
        this.context
      );
      const startPatternMatchingResult = startPatternMatching.executeOnlySpanningEntireRange();
      if (startPatternMatchingResult.matches.length === 0) {
        throw new DoesNotMatch();
      }
    }
    throw new DoesNotMatch();
  }

  private visitBlockNode(lastSiblingKeyword?: Keyword) {
    const blockNode = this.patternCursor.currentNode as BlockNode;
    if (!blockNode.matches(this.astCursor)) {
      logger.debug("AST does not match BlockNode");
      throw new DoesNotMatch();
    }
    const blockRange = this.extractBlockRangeFor(blockNode, lastSiblingKeyword);
    this.blockRanges.push(blockRange);
  }

  private visitRegularNode() {
    const regularNode = this.patternCursor.currentNode as RegularNode;
    if (!regularNode.matches(this.astCursor, this.context)) {
      logger.debug("AST does not match RegularNode.");
      throw new DoesNotMatch();
    }
    if (regularNode.hasChildren()) {
      this.visitRegularNodeChildren();
    }
  }

  private visitRegularNodeChildren() {
    const regularNode = this.patternCursor.currentNode as RegularNode;
    this.patternCursor.goToFirstChild();
    this.astCursor.goToFirstChild();

    let [nextSiblingExists, lastKeyword] = this.astCursor.skipKeywordsAndGetLast();
    if (!nextSiblingExists) {
      logger.debug("Patter node has children but AST node only has keywords as children");
      throw new DoesNotMatch();
    }

    const requiredNumberOfChildren = regularNode.children!.length;
    for (let i = 0; i < requiredNumberOfChildren; ) {
      this.recurse(lastKeyword);

      i += 1;
      this.patternCursor.goToNextSibling();
      nextSiblingExists = this.astCursor.goToNextSibling();

      if (nextSiblingExists) {
        [nextSiblingExists, lastKeyword] = this.astCursor.skipKeywordsAndGetLast();
      }

      // Check AST node does not have too few or too many children
      if (
        (i < requiredNumberOfChildren && !nextSiblingExists) ||
        (i >= requiredNumberOfChildren && nextSiblingExists)
      ) {
        logger.debug("AST node does not have sufficient amount of children");
        throw new DoesNotMatch();
      }
    }

    this.astCursor.goToParent();
    this.patternCursor.goToParent();
  }

  private checkNoErrorToken() {
    if (this.astCursor.currentNode.isErrorToken()) {
      logger.debug("Error token in AST encountered");
      throw new DoesNotMatch();
    }
  }

  /**
   * The Python tree-sitter parser wrongly puts leading comments between
   * a with-clause and its body.
   * To still be able to match patterns that expect a body right after
   * the with-clause, we simply skip the comments.
   * The same applies to function definitions, where a comment on the
   * first line of the function body is put between the parameters
   * and the body.
   * This fix applies to both cases.
   * Also see https://github.com/tree-sitter/tree-sitter-python/issues/112.
   */
  private skipLeadingCommentsInBodies(): void {
    while (
      this.patternCursor.currentNode.fieldName === "body" &&
      this.astCursor.currentNode.cleanNodeType === "comment"
    ) {
      this.astCursor.goToNextSibling();
    }
  }

  private extractAggregationRangesFor(aggregationNode: AggregationNode): CodeRange[] {
    const currentAstNode = this.astCursor.currentNode;

    const aggregationPartRoots = currentAstNode.children.filter((astNode) => {
      return !(
        astNode.text === aggregationNode.startToken ||
        astNode.text === aggregationNode.delimiterToken ||
        astNode.text === aggregationNode.endToken
      );
    });

    return aggregationPartRoots.map((aggregationPartRoot) => ({
      node: aggregationPartRoot,
      context: aggregationNode.templateAggregation.context,
      from: aggregationPartRoot.startIndex,
      to: aggregationPartRoot.endIndex,
      language: aggregationNode.language,
    }));
  }

  private extractBlockRangeFor(blockNode: BlockNode, lastSiblingKeyword?: Keyword): CodeRange {
    let from = this.astCursor.startIndex;
    if (blockNode.language === Language.Python && lastSiblingKeyword?.type === ":") {
      from = lastSiblingKeyword.pos;
    }
    const rangeModifierStart = 1;
    const rangeModifierEnd = blockNode.language === Language.TypeScript ? 1 : 0;
    return {
      node: this.astCursor.currentNode,
      context: blockNode.templateBlock.context,
      from: from + rangeModifierStart,
      to: this.astCursor.endIndex - rangeModifierEnd,
      language: blockNode.language,
    };
  }
}

export class DoesNotMatch extends Error {
  constructor(message?: string) {
    super(message);
  }
}
