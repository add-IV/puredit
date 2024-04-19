import AstCursor, { Keyword } from "../ast/cursor";
import type {
  AstNodeMap,
  CandidateMatch,
  CodeRange,
  CodeRangeMap,
  CodeRangesMap,
  VerificationResult,
} from "./types";
import { PatternMatching } from "..";
import { ContextVariableMap } from "@puredit/projections";
import Pattern from "../pattern/pattern";
import ArgumentNode from "../pattern/nodes/argumentNode";
import BlockNode from "../pattern/nodes/blockNode";
import PatternCursor from "../pattern/cursor";
import RegularNode from "../pattern/nodes/regularNode";
import AggregationNode from "../pattern/nodes/aggregationNode";
import ChainNode from "../pattern/nodes/chainNode";
import ChainDecorator from "../pattern/decorators/chainDecorator";
import ChainContinuationNode from "../pattern/nodes/chainContinuationNode";
import {
  Language,
  loadChainableNodeTypeConfigFor,
  ChainableNodeTypeConfig,
} from "@puredit/language-config";

import { logProvider } from "../../../logconfig";
const logger = logProvider.getLogger("parser.match.MatchVerification");

export default class MatchVerification {
  // Input
  private pattern: Pattern;
  private patternCursor: PatternCursor;
  private astCursor: AstCursor;
  private contextVariables: ContextVariableMap;

  // State
  private lastSiblingKeyword: Keyword | null = null;

  // Output
  private argsToAstNodeMap: AstNodeMap = {};
  private blockRanges: CodeRange[] = [];
  private aggregationToRangeMap: CodeRangeMap = {};
  private aggregationToStartRangeMap: CodeRangeMap = {};
  private aggregationToPartRangesMap: CodeRangesMap = {};
  private chainToStartRangeMap: CodeRangeMap = {};
  private chainToLinkRangesMap: CodeRangesMap = {};

  constructor(private candidateMatch: CandidateMatch) {
    this.pattern = this.candidateMatch.pattern;
    this.patternCursor = new PatternCursor(this.pattern);
    this.astCursor = this.candidateMatch.cursor;
    this.contextVariables = this.candidateMatch.contextVariables;
  }

  /**
   * Checks if the pattern of this CandidateMatch actually matches the
   * AST at the position of the cursor by recursively creating new
   * CandateMatches for the child nodes in a depth-first manner.
   */
  public execute(): VerificationResult {
    logger.debug(`Starting new verification of CandidateMatch with Pattern ${this.pattern.name}`);
    this.recurse();
    return {
      pattern: this.pattern,
      node: this.astCursor.currentNode,
      argsToAstNodeMap: this.argsToAstNodeMap,
      blockRanges: this.blockRanges,
      aggregationToRangeMap: this.aggregationToRangeMap,
      aggregationToStartRangeMap: this.aggregationToStartRangeMap,
      aggregationToPartRangesMap: this.aggregationToPartRangesMap,
      chainToStartRangeMap: this.chainToStartRangeMap,
      chainToLinkRangesMap: this.chainToLinkRangesMap,
    };
  }

  private recurse() {
    const currentAstNode = this.astCursor.currentNode;
    const currentPatternNode = this.patternCursor.currentNode;

    let ignoredNode = false;
    if (
      currentAstNode.type === "parenthesized_expression" &&
      currentAstNode.children[1]?.type === "call"
    ) {
      const fieldName = this.astCursor.currentFieldName;
      this.astCursor.goToFirstChild();
      this.astCursor.goToNextSibling();
      this.astCursor.currentFieldName = fieldName;
      ignoredNode = true;
    }

    this.checkNoErrorToken();
    this.skipLeadingCommentsInBodies();

    if (currentAstNode.isKeyword()) {
      this.visitKeywordNode();
    } else if (currentPatternNode instanceof ArgumentNode) {
      this.visitArgumentNode();
    } else if (currentPatternNode instanceof AggregationNode) {
      this.visitAggregationNode();
    } else if (currentPatternNode instanceof ChainNode) {
      this.visitChainNode();
    } else if (currentPatternNode instanceof ChainContinuationNode) {
      this.visitChainContinuationNode();
    } else if (currentPatternNode instanceof BlockNode) {
      this.visitBlockNode();
    } else if (currentPatternNode instanceof RegularNode) {
      this.visitRegularNode();
    } else {
      logger.debug(`Unsupported node type ${currentPatternNode.type} encountered`);
      throw new DoesNotMatch();
    }

    if (ignoredNode) {
      this.astCursor.goToParent();
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

  private visitArgumentNode() {
    const argumentNode = this.patternCursor.currentNode as ArgumentNode;
    logger.debug(
      `Visiting ArgumentNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!argumentNode.matches(this.astCursor)) {
      logger.debug("AST does not match ArgumentNode");
      throw new DoesNotMatch();
    }
    this.argsToAstNodeMap[argumentNode.templateArgument.name] = this.astCursor.currentNode;
  }

  private visitKeywordNode() {
    const regularNode = this.patternCursor.currentNode as RegularNode;
    logger.debug(
      `Visiting RegularNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (regularNode.text !== this.astCursor.currentNode.text) {
      logger.debug("Keyword AST node does not match RegularNode");
      throw new DoesNotMatch();
    }
  }

  private visitAggregationNode() {
    const aggregationNode = this.patternCursor.currentNode as AggregationNode;
    logger.debug(
      `Visiting AggregationNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!aggregationNode.matches(this.astCursor)) {
      logger.debug("AST node does not match AggregationNode");
      throw new DoesNotMatch();
    }

    const aggregationRange = this.extractAggregationRangeFor(aggregationNode);
    this.aggregationToRangeMap[aggregationNode.templateAggregation.name] = aggregationRange;

    if (aggregationNode.hasSpecialStartPattern()) {
      const aggregationStartRange = this.extractAggregationStartRangeFor(aggregationNode);
      this.aggregationToStartRangeMap[aggregationNode.templateAggregation.name] =
        aggregationStartRange;
    }

    const aggregationRanges = this.extractAggregationPartRangesFor(aggregationNode);
    this.aggregationToPartRangesMap[aggregationNode.templateAggregation.name] = aggregationRanges;
  }

  private extractAggregationRangeFor(aggregationNode: AggregationNode): CodeRange {
    const currentAstNode = this.astCursor.currentNode;
    return {
      node: currentAstNode,
      contextVariables: aggregationNode.templateAggregation.contextVariables,
      from: currentAstNode.startIndex,
      to: currentAstNode.endIndex,
      language: this.pattern.language,
    };
  }

  private extractAggregationStartRangeFor(aggregationNode: AggregationNode): CodeRange {
    const currentAstNode = this.astCursor.currentNode;
    const aggregationStartRoot = currentAstNode.children[0];
    return {
      node: aggregationStartRoot,
      contextVariables: aggregationNode.templateAggregation.contextVariables,
      from: aggregationStartRoot.startIndex,
      to: aggregationStartRoot.endIndex,
      language: this.pattern.language,
    };
  }

  private extractAggregationPartRangesFor(aggregationNode: AggregationNode): CodeRange[] {
    const currentAstNode = this.astCursor.currentNode;

    let childNodes;
    if (aggregationNode.hasSpecialStartPattern()) {
      childNodes = currentAstNode.children.slice(1, currentAstNode.children.length);
    } else {
      childNodes = currentAstNode.children;
    }

    const aggregationPartRoots = childNodes.filter((astNode) => {
      return !(
        astNode.text === aggregationNode.startToken ||
        astNode.text === aggregationNode.delimiterToken ||
        astNode.text === aggregationNode.endToken
      );
    });

    return aggregationPartRoots.map((aggregationPartRoot) => ({
      node: aggregationPartRoot,
      contextVariables: aggregationNode.templateAggregation.contextVariables,
      from: aggregationPartRoot.startIndex,
      to: aggregationPartRoot.endIndex,
      language: this.pattern.language,
    }));
  }

  private visitChainNode() {
    const chainNode = this.patternCursor.currentNode as ChainNode;
    logger.debug(
      `Visiting ChainNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!chainNode.matches(this.astCursor)) {
      logger.debug("AST node does not match ChainNode");
      throw new DoesNotMatch();
    }
    if (this.astCursor.currentNode.hasChildren()) {
      this.visitChainNodeChildren();
    } else {
      logger.debug("ChainNode does not have children");
      throw new DoesNotMatch();
    }
  }

  private visitChainNodeChildren() {
    const chainNode = this.patternCursor.currentNode as ChainNode;
    this.initializeChainToLinkRangesMapFor(chainNode);

    const followedPaths = [];
    let chainDepth = -1;
    let chainableNodeTypeConfig;
    do {
      chainDepth++;
      const currentAstNode = this.astCursor.currentNode;
      chainableNodeTypeConfig = loadChainableNodeTypeConfigFor(
        this.pattern.language,
        currentAstNode.type
      );
      if (chainableNodeTypeConfig) {
        logger.debug(`Found ${chainDepth + 1}. chain link`);
        this.extractChainLinkRangeFor(chainNode, chainableNodeTypeConfig);
      } else if (this.chainStartReachedFor(chainNode)) {
        logger.debug(`Reached chain start at depth ${chainDepth}`);
        this.extractChainStartRangeFor(chainNode);
        break;
      } else {
        logger.debug(
          `ChainNode does not match since AST node of type ${currentAstNode.type} ` +
            `with text ${currentAstNode.text} matches neither chain link not chain start`
        );
        throw new DoesNotMatch();
      }
    } while (
      this.astCursor.follow(chainableNodeTypeConfig.pathToNextLink) &&
      followedPaths.push(chainableNodeTypeConfig.pathToNextLink)
    );

    if (chainDepth < 2) {
      // We only match if at least two functions are called in a row
      logger.debug(
        `ChainNode does not match since only ${
          chainDepth + 1
        } consecutive function calls were found`
      );
      throw new DoesNotMatch();
    }

    for (const path of followedPaths) {
      this.astCursor.reverseFollow(path);
    }
  }

  private initializeChainToLinkRangesMapFor(chainNode: ChainNode) {
    const chainName = chainNode.templateChain.name;
    this.chainToLinkRangesMap[chainName] = [];
  }

  private extractChainLinkRangeFor(
    chainNode: ChainNode,
    chainableNodeTypeConfig: ChainableNodeTypeConfig
  ) {
    const chainName = chainNode.templateChain.name;

    const succeded = this.astCursor.follow(chainableNodeTypeConfig.pathToLinkBegin);
    if (!succeded) {
      logger.debug(
        `AST node of type ${this.astCursor.currentNode.type} with text ${this.astCursor.currentNode.text} ` +
          `is not a valid chain node`
      );
      throw new DoesNotMatch();
    }
    const from = this.astCursor.currentNode.startIndex;
    this.astCursor.reverseFollow(chainableNodeTypeConfig.pathToLinkBegin);

    const currentAstNode = this.astCursor.currentNode;
    this.chainToLinkRangesMap[chainName].push({
      node: currentAstNode,
      contextVariables: chainNode.templateChain.contextVariables,
      from,
      to: currentAstNode.endIndex,
      language: this.pattern.language,
    });
  }

  private extractChainStartRangeFor(chainNode: ChainNode) {
    const currentAstNode = this.astCursor.currentNode;
    const chainName = chainNode.templateChain.name;

    this.chainToStartRangeMap[chainName] = {
      node: currentAstNode,
      contextVariables: chainNode.templateChain.contextVariables,
      from: currentAstNode.startIndex,
      to: currentAstNode.endIndex,
      language: this.pattern.language,
    };
  }

  private chainStartReachedFor(chainNode: ChainNode): boolean {
    const chainName = chainNode.templateChain.name;
    const pattern = this.pattern as ChainDecorator;
    const chainStartPatternMap = pattern.getStartPatternMapFor(chainName);

    logger.debug("Checking if chain start has been reached");
    const chainStartPatternMatching = new PatternMatching(
      chainStartPatternMap,
      this.astCursor,
      this.contextVariables
    );
    const result = chainStartPatternMatching.executeOnlySpanningEntireRange();
    return result.matches.length > 0;
  }

  private visitChainContinuationNode() {
    const chainContinuationNode = this.patternCursor.currentNode as ChainContinuationNode;
    logger.debug(
      `Visiting ChainContinuationNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!chainContinuationNode.matches(this.astCursor)) {
      logger.debug("AST node does not match ChainContinuationNode");
      throw new DoesNotMatch();
    }
  }

  private visitBlockNode() {
    const blockNode = this.patternCursor.currentNode as BlockNode;
    logger.debug(
      `Visiting BlockNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!blockNode.matches(this.astCursor)) {
      logger.debug("AST does not match BlockNode");
      throw new DoesNotMatch();
    }
    const blockRange = this.extractBlockRangeFor(blockNode);
    this.blockRanges.push(blockRange);
  }

  private extractBlockRangeFor(blockNode: BlockNode): CodeRange {
    let from = this.astCursor.startIndex;
    if (this.pattern.language === Language.Python && this.lastSiblingKeyword?.type === ":") {
      from = this.lastSiblingKeyword.pos;
    }
    const rangeModifierStart = 1;
    const rangeModifierEnd = this.pattern.language === Language.TypeScript ? 1 : 0;
    return {
      from: from + rangeModifierStart,
      to: this.astCursor.endIndex - rangeModifierEnd,
      language: this.pattern.language,
      node: this.astCursor.currentNode,
      contextVariables: blockNode.templateBlock.contextVariables,
    };
  }

  private visitRegularNode() {
    const regularNode = this.patternCursor.currentNode as RegularNode;
    logger.debug(
      `Visiting RegularNode of type ${regularNode.type} comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!regularNode.matches(this.astCursor, this.contextVariables)) {
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

    const requiredNumberOfChildren = regularNode.children!.length;
    for (let i = 0; i < requiredNumberOfChildren; i++) {
      this.recurse();

      if (this.astCursor.currentNode.isKeyword()) {
        this.lastSiblingKeyword = {
          type: this.astCursor.currentNode.type,
          pos: this.astCursor.currentNode.startIndex,
        };
      }

      if (i < requiredNumberOfChildren - 1) {
        this.patternCursor.goToNextSibling();
        const nextAstSiblingExists = this.astCursor.goToNextSibling();
        if (!nextAstSiblingExists) {
          logger.debug("AST Node has too few children");
          throw new DoesNotMatch();
        }
      }
    }

    if (this.astCursor.goToNextSibling()) {
      logger.debug("AST Node has too many children");
      throw new DoesNotMatch();
    }

    this.lastSiblingKeyword = null;
    this.astCursor.goToParent();
    this.patternCursor.goToParent();
  }

  private checkNoErrorToken() {
    if (this.astCursor.currentNode.isErrorToken()) {
      logger.debug("Error token in AST encountered");
      throw new DoesNotMatch();
    }
  }
}

export class DoesNotMatch extends Error {
  constructor(message?: string) {
    super(message);
  }
}
