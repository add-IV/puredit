import { TreeSitterParser } from "../treeSitterParser";
import PatternNode from "../pattern/nodes/patternNode";
import BasePattern from "../pattern/basePattern";
import Pattern from "../pattern/pattern";
import PatternCursor from "../pattern/cursor";
import { ChainsConfig } from "@puredit/language-config";
import { loadChainableNodeTypeConfigFor, loadChainsConfigFor } from "@puredit/language-config";
import { NodeTransformVisitor, PatternGeneration } from "./internal";
import TemplateChain from "../define/templateChain";
import ChainContinuationNode from "../pattern/nodes/chainContinuationNode";

export default class ChainLinkPatternsGeneration extends PatternGeneration {
  private chainsConfig: ChainsConfig | undefined;
  private templateChain: TemplateChain | undefined;
  private startPatternRootNode: PatternNode | undefined;

  constructor(parser: TreeSitterParser) {
    super(parser);
  }

  setTemplateChain(templateChain: TemplateChain): ChainLinkPatternsGeneration {
    this.templateChain = templateChain;
    return this;
  }

  setStartPatternRootNode(startPatternRootNode: PatternNode): ChainLinkPatternsGeneration {
    this.startPatternRootNode = startPatternRootNode;
    return this;
  }

  execute(): Pattern {
    this.chainsConfig = loadChainsConfigFor(this.rawTemplate!.language);
    this.nodeTransformVisitor = new NodeTransformVisitor(this.rawTemplate!);

    const codeString = this.buildCodeString();
    const rootNode = this.transformToPatternTree(codeString);
    let pattern = this.extractChainLinkPattern(rootNode) as Pattern;

    if (this.rawTemplate!.hasAggregations()) {
      pattern = this.buildAggregationSubPatterns(pattern);
    }
    if (this.rawTemplate!.hasChains()) {
      pattern = this.buildChainSubPatterns(pattern);
    }

    return pattern;
  }

  private buildCodeString(): string {
    const linkCodeString = this.rawTemplate!.toCodeString();
    return `a.${linkCodeString}`;
  }

  private extractChainLinkPattern(linkCallRoot: PatternNode): BasePattern {
    const linkPatternCursor = new PatternCursor(linkCallRoot);

    linkPatternCursor.follow(this.chainsConfig!.pathToFirstLink);
    const chainableNodeTypeConfig = loadChainableNodeTypeConfigFor(
      this.rawTemplate!.language,
      linkPatternCursor.currentNode.type
    );
    linkPatternCursor.reverseFollow(this.chainsConfig!.pathToFirstLink);

    const pathToNextChainLink = chainableNodeTypeConfig.pathToNextLink;
    const lastStep = pathToNextChainLink.getLastStep();

    linkPatternCursor.follow(pathToNextChainLink.getSliceBeforeLastStep());
    const chainContinuationNode = new ChainContinuationNode(
      this.rawTemplate!.language,
      this.startPatternRootNode!,
      this.templateChain!
    );
    linkPatternCursor.currentNode.insertChild(chainContinuationNode, lastStep);
    linkPatternCursor.reverseFollow(pathToNextChainLink.getSliceBeforeLastStep());

    linkPatternCursor.follow(this.chainsConfig!.pathToFirstLink);
    const linkRootNode = linkPatternCursor.currentNode.cutOff();

    return new BasePattern(linkRootNode, this.rawTemplate!);
  }
}
