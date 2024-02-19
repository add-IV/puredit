import AstCursor, { Keyword } from "../ast/cursor";
import type {
  CandidateMatch,
  CodeRange,
  CodeRangeMap,
  CodeRangesMap,
  VerificationResult,
} from "./types";
import { Language, PatternMatching, type Context } from "..";
import Pattern from "../pattern/pattern";
import ArgumentNode from "../pattern/nodes/argumentNode";
import BlockNode from "../pattern/nodes/blockNode";
import PatternCursor from "../pattern/cursor";
import RegularNode from "../pattern/nodes/regularNode";
import AggregationNode from "../pattern/nodes/aggregationNode";
import ChainNode from "../pattern/nodes/chainNode";
import { loadChainsConfigFor } from "../config/load";
import ChainDecorator from "../pattern/decorators/chainDecorator";
import AstNode from "../ast/node";
import ChainContinuationNode from "../pattern/nodes/chainContinuationNode";

import { logProvider } from "../../../logconfig";
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
    logger.debug(`Starting new verification of CandidateMatch with Pattern ${this.pattern.name}`);
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

    this.checkNoErrorToken();
    this.skipLeadingCommentsInBodies();

    if (currentPatternNode instanceof ArgumentNode) {
      this.visitArgumentNode();
    } else if (currentPatternNode instanceof AggregationNode) {
      this.visitAggregationNode();
    } else if (currentPatternNode instanceof ChainNode) {
      this.visitChainNode();
    } else if (currentPatternNode instanceof ChainContinuationNode) {
      this.visitChainContinuationNode();
    } else if (currentPatternNode instanceof BlockNode) {
      this.visitBlockNode(lastSiblingKeyword);
    } else if (currentPatternNode instanceof RegularNode) {
      this.visitRegularNode();
    } else {
      logger.debug(`Unsupported node type ${currentPatternNode.type} encountered`);
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

  private visitAggregationNode() {
    const aggregationNode = this.patternCursor.currentNode as AggregationNode;
    logger.debug(
      `Visiting AggregationNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!aggregationNode.matches(this.astCursor)) {
      logger.debug("AST node does not match AggregationNode");
      throw new DoesNotMatch();
    }
    const aggregationRanges = this.extractAggregationRangesFor(aggregationNode);
    this.aggregationToRangesMap[aggregationNode.templateAggregation.name] = aggregationRanges;
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

    const chainsConfig = loadChainsConfigFor(chainNode.language);
    const pathToNextChainLink = chainsConfig.pathToNextChainLink;

    let chainDepth = -1;
    do {
      chainDepth++;
      if (this.astCursor.currentNode.type === chainsConfig.chainNodeType) {
        logger.debug(`Found ${chainDepth + 1}. chain link`);
        this.extractChainLinkRangeFor(chainNode);
      } else if (this.chainStartReachedFor(chainNode)) {
        logger.debug(`Reached chain start at depth ${chainDepth}`);
        this.extractChainStartRangeFor(chainNode);
        break;
      } else {
        logger.debug(
          `ChainNode does not match since AST node of type ${this.astCursor.currentNode.type} ` +
            `with text ${this.astCursor.currentNode.text} matches neither chain link not chain start`
        );
        throw new DoesNotMatch();
      }
    } while (this.astCursor.follow(pathToNextChainLink));

    if (chainDepth < 2) {
      // We only match if at least two functions are called in a row
      logger.debug(
        `ChainNode does not match since only ${
          chainDepth + 1
        } consecutive function calls were found`
      );
      throw new DoesNotMatch();
    }

    for (let i = 0; i < chainDepth; i++) {
      this.astCursor.reverseFollow(pathToNextChainLink);
    }
  }

  private initializeChainToLinkRangesMapFor(chainNode: ChainNode) {
    const chainName = chainNode.templateChain.name;
    this.chainToLinkRangesMap[chainName] = [];
  }

  private extractChainLinkRangeFor(chainNode: ChainNode) {
    const chainName = chainNode.templateChain.name;
    const chainsConfig = loadChainsConfigFor(this.patternCursor.currentNode.language);

    this.astCursor.follow(chainsConfig.pathToCallBegin);
    const from = this.astCursor.currentNode.startIndex;
    this.astCursor.reverseFollow(chainsConfig.pathToCallBegin);

    const currentAstNode = this.astCursor.currentNode;
    this.chainToLinkRangesMap[chainName].push({
      node: currentAstNode,
      context: {},
      from,
      to: currentAstNode.endIndex,
      language: chainNode.language,
    });
  }

  private extractChainStartRangeFor(chainNode: ChainNode) {
    const currentAstNode = this.astCursor.currentNode;
    const chainName = chainNode.templateChain.name;

    this.chainToStartRangeMap[chainName] = {
      node: currentAstNode,
      context: {},
      from: currentAstNode.startIndex,
      to: currentAstNode.endIndex,
      language: chainNode.language,
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
      this.context
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

  private visitBlockNode(lastSiblingKeyword?: Keyword) {
    const blockNode = this.patternCursor.currentNode as BlockNode;
    logger.debug(
      `Visiting BlockNode comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

    if (!blockNode.matches(this.astCursor)) {
      logger.debug("AST does not match BlockNode");
      throw new DoesNotMatch();
    }
    const blockRange = this.extractBlockRangeFor(blockNode, lastSiblingKeyword);
    this.blockRanges.push(blockRange);
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

  private visitRegularNode() {
    const regularNode = this.patternCursor.currentNode as RegularNode;
    logger.debug(
      `Visiting RegularNode of type ${regularNode.type} comparing to AST node of type ${this.astCursor.currentNode.type}`
    );

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

      this.patternCursor.goToNextSibling();
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
}

export class DoesNotMatch extends Error {
  constructor(message?: string) {
    super(message);
  }
}
