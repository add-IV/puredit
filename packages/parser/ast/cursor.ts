import type { TreeCursor } from "web-tree-sitter";
import AstNode from "./node";
import Cursor from "../cursor/cursor";

export default class AstCursor extends Cursor {
  private runningTransaction = false;
  private operationLog: TransactionOperation[] = [];

  constructor(private treeCursor: TreeCursor) {
    super();
  }

  protected beginTransaction() {
    this.runningTransaction = true;
    this.operationLog = [];
  }

  protected commitTransaction() {
    this.operationLog = [];
    this.runningTransaction = false;
  }

  protected rollbackTransaction() {
    while (this.operationLog.length > 0) {
      const operation = this.operationLog.pop();
      if (operation === TransactionOperation.GOTO_FIRST_CHILD) {
        this.goToParent();
      } else if (operation === TransactionOperation.GOTO_PARENT) {
        this.goToFirstChild();
      }
    }
    this.runningTransaction = false;
  }

  goToParent(): boolean {
    return this.treeCursor.gotoParent();
  }

  goToFirstChild(): boolean {
    return this.treeCursor.gotoFirstChild();
  }

  goToFirstNonKeywordChildAndGetLastKeyword(): boolean | Keyword | undefined {
    this.goToFirstChild();
    const [hasSibling, lastKeyword] = this.skipKeywordsAndGetLast();
    if (!hasSibling) {
      return false;
    } else {
      return lastKeyword;
    }
  }

  goToFirstChildForIndex(index: number): boolean {
    return this.treeCursor.gotoFirstChildForIndex(index);
  }

  goToNextSibling(): boolean {
    /* The underlying cursor by web-tree-sitter does currently not support gotoPreviousSibling.
     * Therefore transactions starting with gotoNextSibling cannot be rolled back correctly */
    if (this.runningTransaction && this.operationLog.length === 0) {
      throw new Error("Transaction on AST Cursor cannot start with goToNextSibling");
    }
    return this.treeCursor.gotoNextSibling();
  }

  goToSiblingWithIndex(index: number): boolean {
    for (let i = 0; i < index; i++) {
      if (!this.goToNextSibling()) {
        return false;
      }
    }
    return true;
  }

  goToExpression(): boolean {
    do {
      if (this.treeCursor.nodeType === "expression_statement") {
        this.treeCursor.gotoFirstChild();
        return true;
      }
    } while (this.goToNextNode());
    return false;
  }

  goToNextNode(): boolean {
    return (
      this.treeCursor.gotoFirstChild() ||
      this.treeCursor.gotoNextSibling() ||
      (this.treeCursor.gotoParent() && this.treeCursor.gotoNextSibling())
    );
  }

  skipKeywordsAndGetLast(): [boolean, Keyword | undefined] {
    let lastKeyword: Keyword | undefined;
    while (!this.treeCursor.currentNode().isNamed()) {
      lastKeyword = {
        type: this.treeCursor.nodeType,
        pos: this.treeCursor.startIndex,
      };
      if (!this.treeCursor.gotoNextSibling()) {
        return [false, lastKeyword];
      }
    }
    return [true, lastKeyword];
  }

  get currentNode() {
    return new AstNode(this.treeCursor.currentNode());
  }

  get currentFieldName() {
    return this.treeCursor.currentFieldName() || undefined;
  }

  get startIndex() {
    return this.treeCursor.startIndex;
  }

  get endIndex() {
    return this.treeCursor.endIndex;
  }
}

export interface Keyword {
  type: string;
  pos: number;
}

enum TransactionOperation {
  GOTO_PARENT,
  GOTO_FIRST_CHILD,
}
