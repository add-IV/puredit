import BasePattern from "./basePattern";
import PatternNode from "./nodes/patternNode";
import Pattern from "./pattern";
import PatternDecorator from "./patternDecorator";
import PatternPath from "./patternPath";

export default class PatternCursor {
  private _currentNode: PatternNode;

  private runningTransaction = false;
  private operationLog: CursorOperation[] = [];

  constructor(source: Pattern | PatternNode | PatternDecorator) {
    if (source instanceof BasePattern || source instanceof PatternDecorator) {
      this._currentNode = source.rootNode;
    } else if (source instanceof PatternNode) {
      this._currentNode = source;
    } else {
      throw new Error("Source for PatternCursor must be eiter PatternNode or Pattern");
    }
  }

  private beginTransaction() {
    this.runningTransaction = true;
    this.operationLog = [];
  }

  private commitTransaction() {
    this.operationLog = [];
    this.runningTransaction = false;
  }

  private rollbackTransaction() {
    while (this.operationLog.length > 0) {
      const operation = this.operationLog.pop();
      if (operation === CursorOperation.GOTO_FIRST_CHILD) {
        this.goToParent();
      } else if (operation === CursorOperation.GOTO_NEXT_SIBLING) {
        this.goToPreviousSibling();
      } else if (operation === CursorOperation.GOTO_PARENT) {
        this.goToFirstChild();
      } else if (operation === CursorOperation.GOTO_PREVIOUS_SIBLING) {
        this.goToNextSibling();
      }
    }
    this.runningTransaction = false;
  }

  follow(path: PatternPath): boolean {
    this.beginTransaction();
    for (const step of path.steps) {
      if (this.goToFirstChild()) {
        if (!this.goToSiblingWithIndex(step)) {
          this.rollbackTransaction();
          return false;
        }
      } else {
        this.rollbackTransaction();
        return false;
      }
    }
    this.commitTransaction();
    return true;
  }

  private goToSiblingWithIndex(index: number): boolean {
    for (let i = 0; i < index; i++) {
      if (!this.goToNextSibling()) {
        return false;
      }
    }
    return true;
  }

  goToFirstChild(): boolean {
    if (!this._currentNode.hasChildren()) {
      return false;
    }
    this._currentNode = this._currentNode.children[0];
    if (this.runningTransaction) {
      this.operationLog.push(CursorOperation.GOTO_FIRST_CHILD);
    }
    return true;
  }

  goToParent(): boolean {
    if (!this._currentNode.parent) {
      return false;
    }
    this._currentNode = this._currentNode.parent;
    if (this.runningTransaction) {
      this.operationLog.push(CursorOperation.GOTO_PARENT);
    }
    return true;
  }

  goToNextSibling(): boolean {
    if (!this._currentNode.hasNextSibling()) {
      return false;
    }

    const currentChildNodeIndex = this.getCurrentChildNodeIndex();
    this._currentNode = this._currentNode.parent!.children[currentChildNodeIndex + 1];

    if (this.runningTransaction) {
      this.operationLog.push(CursorOperation.GOTO_NEXT_SIBLING);
    }
    return true;
  }

  private getCurrentChildNodeIndex(): number {
    return this._currentNode.parent!.children.findIndex(
      (childNode) => childNode === this._currentNode
    );
  }

  goToPreviousSibling(): boolean {
    if (!this._currentNode.hasPreviousSibling()) {
      return false;
    }

    const currentChildNodeIndex = this.getCurrentChildNodeIndex();
    this._currentNode = this._currentNode.parent!.children[currentChildNodeIndex - 1];

    if (this.runningTransaction) {
      this.operationLog.push(CursorOperation.GOTO_PREVIOUS_SIBLING);
    }
    return true;
  }

  get currentNode() {
    return this._currentNode;
  }
}

enum CursorOperation {
  GOTO_PARENT,
  GOTO_FIRST_CHILD,
  GOTO_NEXT_SIBLING,
  GOTO_PREVIOUS_SIBLING,
}
