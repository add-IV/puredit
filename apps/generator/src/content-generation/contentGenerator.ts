import { ProjectionSegment, scanProjections } from "./projection/scan";
import { scanCode } from "./code/scan";
import { connectArguments, setArgumentNames } from "./variables";
import { serializePattern, serializeWidget } from "./serialize";
import { supportedLanguages } from "./common";
import { TemplateChain } from "./template/chain";
import { ProjectionContent } from "./common";
import SubProjectionGenerator from "../subProjection/subProjectionGenerator";
import { SubProjectionContentGenerator } from "./internal";
import { TemplateAggregation } from "./template/aggregation";
import { SubProjectionResolver, SubProjectionSolution } from "./subProjectionResolution";
import { PatternNode } from "./pattern";
import TemplateParameterArray from "./template/parameterArray";
import AstNode from "@puredit/parser/ast/node";
import { BlockVariableMap, Path } from "./context-var-detection/blockVariableMap";
import { Tree } from "@lezer/common";
import { zip } from "@puredit/utils-shared";
import { getWidgetTokens } from "./projection/parse";
import BaseGenerator from "../common/baseGenerator";
import { aggregationPlaceHolder, aggregationStartPlaceHolder, loadAggregatableNodeTypeConfigFor } from "@puredit/language-config";
import { parseCodeSamples } from "./code/parse";

export default abstract class ContentGenerator {
  // Input
  protected projectionPath: string;
  protected ignoreBlocks = true;
  protected codeSamples: string[];
  protected codeAsts: AstNode[];
  protected overheadPath: Path;
  protected projectionSamples: string[];
  protected projectionTrees: Tree[];

  // State
  protected undeclaredVariableMap: BlockVariableMap;
  protected globalTemplateParameters: TemplateParameterArray;
  private subProjectionSolution: SubProjectionSolution;
  private pattern: PatternNode;
  private templateParameters: TemplateParameterArray;
  private segmentsPerWidget: ProjectionSegment[][];

  // Output
  private parameterDeclarations: string;
  private templateString: string;
  private paramToSubProjectionsMap: Record<string, string[]> = {};
  private allSubProjections: string[] = [];
  private segmentWidgetContents: string[] = [];

  constructor(protected readonly generator: BaseGenerator) {}

  protected assertLanguageAvailable() {
    if (!supportedLanguages.includes(this.generator.language)) {
      throw new Error(`Templates for language ${this.generator.language} cannot be generated`);
    }
  }

  protected async generateContent(): Promise<ProjectionContent> {
    await this.generatePattern();
    await this.resolveSubProjections();
    await this.generateSubProjections();
    this.serializePattern();
    this.generateWidgets();
    this.serializeWidgets();

    return new ProjectionContent(
      this.parameterDeclarations,
      this.templateString,
      this.paramToSubProjectionsMap,
      this.segmentWidgetContents,
      this.allSubProjections,
      this.templateParameters.getRequiredParameterTypes()
    );
  }

  private async generatePattern() {
    const { pattern, templateParameters } = await scanCode(
      this.codeAsts,
      this.generator.language,
      this.undeclaredVariableMap,
      this.ignoreBlocks
    );
    this.pattern = pattern;
    this.templateParameters = templateParameters;
  }

  private async resolveSubProjections() {
    const subProjectionResolver = new SubProjectionResolver(
      this.codeSamples,
      this.codeAsts,
      this.projectionSamples,
      this.projectionTrees,
      this.templateParameters.getComplexParams()
    );
    this.subProjectionSolution = await subProjectionResolver.execute();
    this.templateParameters.push(...this.globalTemplateParameters);
    this.templateParameters.removeUnusedParameters(Array.from(this.subProjectionSolution.keys()));
  }

  private serializePattern() {
    const [parameterDeclarations, templateString] = serializePattern(
      this.codeSamples[0],
      this.codeAsts[0],
      this.pattern,
      this.templateParameters
    );
    this.parameterDeclarations = parameterDeclarations;
    this.templateString = templateString;
  }

  private async generateSubProjections() {
    const complexParams = this.templateParameters.getComplexParams();
    this.allSubProjections = [];

    for (let paramIndex = 0; paramIndex < complexParams.length; paramIndex++) {
      const param = complexParams[paramIndex];
      let allSubProjectionsBelow: any, newSubProjections: string[];
      if (param instanceof TemplateChain) {
        [
          allSubProjectionsBelow,
          newSubProjections
        ] = await this.generateSubProjectionsForChain(param);
      } else if (param instanceof TemplateAggregation) {
        [
          allSubProjectionsBelow,
          newSubProjections
        ] = await this.generateSubProjectionsForAggregation(param);
      } else {
        throw new Error("Unsupported template argument for subprojection generation");
      }
      this.paramToSubProjectionsMap[param.toVariableName()] = newSubProjections;
      this.allSubProjections = this.allSubProjections.concat(allSubProjectionsBelow);
    }
  }

  private generateWidgets() {
    const tokensPerWidget = Array.from(zip(this.projectionTrees, this.projectionSamples)).map(
      ([tree, sample]) => {
        const cursor = tree.cursor();
        return getWidgetTokens(cursor, sample);
      }
    );

    const widgetBoundries = [];
    let currentBoundry = -1;
    for (const widget of tokensPerWidget[0]) {
      currentBoundry += widget.length;
      widgetBoundries.push(currentBoundry);
    }

    const projectionTokens = tokensPerWidget.map(sample => sample.flat());
    const projectionSegments = scanProjections(projectionTokens);
    const argumentPaths = this.templateParameters
      .getTemplateArguments()
      .map((argument) => argument.path);
    const connections = connectArguments(
      this.codeAsts,
      projectionTokens,
      argumentPaths,
      projectionSegments
    );
    const templateArguments = this.templateParameters.getTemplateArguments();
    setArgumentNames(projectionSegments, connections, templateArguments);

    this.segmentsPerWidget = widgetBoundries.map((boundry, index) => {
      const startIndex = index ? widgetBoundries[index - 1] + 1 : 0;
      return projectionSegments.slice(startIndex, boundry + 1);
    });
  }

  private serializeWidgets() {
    this.segmentWidgetContents = this.segmentsPerWidget
      .filter(widgetSegments => widgetSegments.length)
      .map(widgetSegments => serializeWidget(widgetSegments));
  }

  private async generateSubProjectionsForChain(
    templateParam: TemplateChain
  ): Promise<[string[], string[]]> {
    const samplesForParam = this.subProjectionSolution.get(templateParam);
    const numSubProj = samplesForParam[0].getChildren("ProjectionContent").length;
    let allSubProjections = [];
    const newSubProjections = [];
    for (let subProjIndex = 0; subProjIndex < numSubProj; subProjIndex++) {
      const subProjectionNodes = samplesForParam.map(
        (group) => group.getChildren("ProjectionContent")[subProjIndex]
      );
      const subProjectionSamples = Array.from(
        zip(subProjectionNodes, this.projectionSamples)).map(([node, sample]) => sample.slice(node.from, node.to+1)
      );
      const subProjectionTrees = subProjectionNodes.map(node => node.toTree());
      let codeSamples: string[];
      let codeAsts: AstNode[];
      let overheadPath: Path;
      let relevantGlobalTemplateParams: TemplateParameterArray;
      if (subProjIndex === 0) {
        // Chain start
        codeSamples = this.codeSamples.map(
          (sample, index) => templateParam.start.extractText(this.codeAsts[index].walk(), sample)
        );
        overheadPath = [];
        codeAsts = await parseCodeSamples(codeSamples, this.generator.language, overheadPath);
        relevantGlobalTemplateParams = this.globalTemplateParameters.getParamsBelow(templateParam.start.nodePath);
        console.log(
          `\nGenerating subprojection for chain start ` +
            `with code samples\n${codeSamples.join("\n")}`
        );
      } else {
        // Chain links
        codeSamples = this.codeSamples.map((sample, index) =>
          templateParam.links[numSubProj - subProjIndex - 1].extractText(
            this.codeAsts[index].walk(),
            sample
          )
        );
        overheadPath = [];
        codeAsts = await parseCodeSamples(codeSamples, this.generator.language, overheadPath);
        relevantGlobalTemplateParams = this.globalTemplateParameters.getParamsBelow(templateParam.links[numSubProj - subProjIndex - 1].startNodePath);
        console.log(
          `\nGenerating subprojection for chain link ` +
            `with code samples\n${codeSamples.join("\n")}`
        );
      }
      const subProjectionGenerator = new SubProjectionGenerator(this.generator.fs);
      subProjectionGenerator.setProjectionPath(this.projectionPath)
        .setLanguage(this.generator.language);
      const contentGenerator = new SubProjectionContentGenerator(subProjectionGenerator);
      const subProjectionsBelow = await contentGenerator.execute(
        this.projectionPath,
        codeSamples,
        codeAsts,
        overheadPath,
        subProjectionSamples,
        subProjectionTrees,
        this.undeclaredVariableMap,
        relevantGlobalTemplateParams,
        this.ignoreBlocks
      );
      newSubProjections.push(subProjectionsBelow[subProjectionsBelow.length - 1]);
      allSubProjections = allSubProjections.concat(subProjectionsBelow);
    }
    templateParam.startSubProjectionName = newSubProjections[0];
    templateParam.linkSubProjectionNames = newSubProjections.slice(1);
    return [allSubProjections, newSubProjections];
  }

  private async generateSubProjectionsForAggregation(
    templateParam: TemplateAggregation
  ): Promise<[string[], string[]]> {
    const samplesForParam = this.subProjectionSolution.get(templateParam);
    const numSubProj = samplesForParam[0].getChildren("ProjectionContent").length;
    let allSubProjections = [];
    const newSubProjections = [];
    for (let subProjIndex = 0; subProjIndex < numSubProj; subProjIndex++) {
      const subProjectionNodes = samplesForParam.map((group) => group.getChildren("ProjectionContent")[subProjIndex]);
      const subProjectionSamples = Array.from(zip(subProjectionNodes, this.projectionSamples)).map(([node, sample]) => sample.slice(node.from, node.to+1));
      const subProjectionTrees = subProjectionNodes.map(node => node.toTree());
      let codeSamples: string[];
      let codeAsts: AstNode[];
      let overheadPath: Path;
      let relevantGlobalTemplateParams: TemplateParameterArray;
      if (subProjIndex === 0 && templateParam.start) {
        // Aggregation start
        const codeSampleParts = this.codeSamples.map(
          (sample, index) => templateParam.start.extractText(this.codeAsts[index].walk(), sample)
        );
        const nodeTypeConfig = loadAggregatableNodeTypeConfigFor(this.generator.language, templateParam.type);
        overheadPath = nodeTypeConfig.startPath.steps;
        codeSamples = codeSampleParts.map(part => nodeTypeConfig.contextTemplate.replace(aggregationStartPlaceHolder, part));
        codeAsts = await parseCodeSamples(codeSamples, this.generator.language, overheadPath);

        relevantGlobalTemplateParams = this.globalTemplateParameters.getParamsBelow(templateParam.start.path);
        console.log(
          `\nGenerating subprojection for special start pattern ` +
            `with code samples\n${codeSampleParts.join("\n")}`
        );
      } else {
        // Aggregation parts
        const partIndex = templateParam.start ? subProjIndex - 1 : subProjIndex;
        const codeSampleParts = this.codeSamples.map((sample, index) =>
          templateParam.parts[partIndex].extractText(
            this.codeAsts[index].walk(),
            sample
          )
        );
        const nodeTypeConfig = loadAggregatableNodeTypeConfigFor(this.generator.language, templateParam.type);
        overheadPath = nodeTypeConfig.partPath.steps;
        codeSamples = codeSampleParts.map(part => nodeTypeConfig.contextTemplate.replace(aggregationPlaceHolder, part));
        codeAsts = await parseCodeSamples(codeSamples, this.generator.language, overheadPath);

        relevantGlobalTemplateParams = this.globalTemplateParameters.getParamsBelow(templateParam.parts[partIndex].path);
        console.log(
          `\nGenerating subprojection for aggregation part ` +
            `with code samples\n${codeSampleParts.join("\n")}`
        );
      }
      const subProjectionGenerator = new SubProjectionGenerator(this.generator.fs);
      subProjectionGenerator.setProjectionPath(this.projectionPath)
        .setLanguage(this.generator.language);
      const contentGenerator = new SubProjectionContentGenerator(subProjectionGenerator);
      const subProjectionsBelow = await contentGenerator.execute(
        this.projectionPath,
        codeSamples,
        codeAsts,
        overheadPath,
        subProjectionSamples,
        subProjectionTrees,
        this.undeclaredVariableMap,
        relevantGlobalTemplateParams,
        this.ignoreBlocks
      );
      newSubProjections.push(subProjectionsBelow[subProjectionsBelow.length - 1]);
      allSubProjections = allSubProjections.concat(subProjectionsBelow);
    }
    templateParam.setSubProjectionNames(newSubProjections);
    return [allSubProjections, newSubProjections];
  }
}
