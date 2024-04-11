import { Path } from "../context-var-detection/blockVariableMap";
import TemplateParameter from "./parameter";
import { Range } from "../common";
import AstCursor from "@puredit/parser/ast/cursor";

export class TemplateChain extends TemplateParameter {
  static lastId = -1;
  static issueId() {
    TemplateChain.lastId++;
    return TemplateChain.lastId;
  }

  public startSubProjectionName = "";
  public linkSubProjectionNames: string[] = [];

  constructor(path: Path, public readonly start: ChainStart, public readonly links: ChainLink[]) {
    super(TemplateChain.issueId(), path);
  }

  toDeclarationString(): string {
    const variableName = this.toVariableName();
    const subProjectionsString = this.linkSubProjectionNames
      .map((name) => `  ${name}.pattern,`)
      .join("\n");
    return `const ${variableName} = chain("${variableName}", ${this.startSubProjectionName}.pattern, [
${subProjectionsString}
]);\n`;
  }

  toVariableName(): string {
    return `chain${this.id}`;
  }

  getEndIndex(astCursor: AstCursor) {
    astCursor.follow(this.links[this.links.length - 1].endNodepath);
    return astCursor.currentNode.endIndex;
  }
}

export class ChainLink {
  constructor(public readonly startNodePath: number[], public readonly endNodepath: number[]) {}

  extractText(astCursor: AstCursor, codeSample: string) {
    astCursor.follow(this.startNodePath);
    const startIndex = astCursor.currentNode.startIndex + 1;
    astCursor.reverseFollow(this.startNodePath);
    astCursor.follow(this.endNodepath);
    const endIndex = astCursor.currentNode.endIndex;
    astCursor.reverseFollow(this.endNodepath);
    return codeSample.slice(startIndex, endIndex);
  }
}

export class ChainStart {
  constructor(public readonly nodePath: number[]) {}

  extractText(astCursor: AstCursor, codeSample: string) {
    astCursor.follow(this.nodePath);
    const startIndex = astCursor.currentNode.startIndex;
    const endIndex = astCursor.currentNode.endIndex;
    astCursor.reverseFollow(this.nodePath);
    return codeSample.slice(startIndex, endIndex);
  }
}
