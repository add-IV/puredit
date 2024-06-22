import { parseCodeSamples } from "./code/parse";
import { Tree } from "@lezer/common";
import SubProjectionGenerator from "../subProjection/subProjectionGenerator";
import { ContentGenerator } from "./internal";
import { BlockVariableMap } from "./context-var-detection/blockVariableMap";
import TemplateParameterArray from "./template/parameterArray";

export default class SubProjectionContentGenerator extends ContentGenerator {
  constructor(generator: SubProjectionGenerator) {
    super(generator);
  }

  async execute(
    projectionPath: string,
    codeSamples: string[],
    projectionSamples: string[],
    projectionTrees: Tree[],
    undeclaredVariableMap: BlockVariableMap,
    globalTemplateParameters: TemplateParameterArray,
    ignoreBlocks: boolean
  ): Promise<string[]> {
    this.projectionPath = projectionPath;
    this.ignoreBlocks = ignoreBlocks;
    this.codeSamples = codeSamples;
    this.projectionSamples = projectionSamples;
    this.projectionTrees = projectionTrees;
    this.undeclaredVariableMap = undeclaredVariableMap;
    this.globalTemplateParameters = globalTemplateParameters;

    const projectionName = await this.generator.showPrompts();
    this.assertLanguageAvailable();
    this.codeAsts = await parseCodeSamples(this.codeSamples, this.generator.language);

    const projectionContent = await this.generateContent();
    await this.generator.writeFiles(projectionContent);
    projectionContent.allSubProjections.push(projectionName);
    return projectionContent.allSubProjections;
  }
}
