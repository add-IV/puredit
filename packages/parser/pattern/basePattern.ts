import PatternNode from "./nodes/patternNode";
import Pattern from "./pattern";
import TreePath from "../cursor/treePath";

export default class BasePattern implements Pattern {
  private numberOfLeafNodes: number;
  private _name: string;

  constructor(public readonly rootNode: PatternNode, name: string) {
    this._name = name;
    this.numberOfLeafNodes = this.countLeafNodes();
  }

  countLeafNodes(): number {
    return this.recurseCountNumberOfLeafNodes(this.rootNode, 0);
  }

  recurseCountNumberOfLeafNodes(currentNode: PatternNode, currentNumber: number): number {
    if (currentNode.isLeafNode()) {
      return 1;
    }
    for (const childNode of currentNode.children) {
      currentNumber += this.recurseCountNumberOfLeafNodes(childNode, currentNumber);
    }
    return currentNumber;
  }

  getTypesMatchedByRootNode(): string[] {
    return this.rootNode.getMatchedTypes();
  }

  getPathToNodeWithText(text: string): TreePath {
    const result = this.findPathByDfs(text, this.rootNode);
    if (!result) {
      throw new Error(`Node with text ${text} does not exist in this pattern`);
    }
    return new TreePath(result);
  }

  private findPathByDfs(
    targetText: string,
    currentNode: PatternNode,
    currentPath: number[] = []
  ): number[] | null {
    // This is for the root node since it does not have a child index
    if (currentNode.hasParent()) {
      const childIndex = currentNode.getChildIndex();
      currentPath.push(childIndex);
    }

    if (currentNode.text === targetText) {
      return currentPath;
    }

    for (const child of currentNode.children) {
      const result = this.findPathByDfs(targetText, child, [...currentPath]);

      if (result !== null) {
        return result;
      }
    }

    currentPath.pop();
    return null;
  }

  getDraft(): string {
    // TODO: Implement draft generation considering Aggregation variants
    return "__pattern";
  }

  get name(): string {
    return this._name;
  }

  get priority(): number {
    return this.numberOfLeafNodes;
  }
}
