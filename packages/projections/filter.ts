import { ChangeSet, EditorSelection, EditorState, Line, Transaction } from "@codemirror/state";
import { ChangeSpec, SelectionRange, Text } from "@codemirror/state";
import { ProjectionWidget } from "./projection";
import { projectionState } from "./state/state";
import { Match } from "@puredit/parser";

export const transactionFilter = EditorState.transactionFilter.of((tr) => {
  const { decorations } = tr.startState.field(projectionState);
  const startDoc = tr.startState.doc;

  // When Alt + Up / Down is used to move a line, reject the transaction since this will end up in chaos
  if (tr.annotation(Transaction.userEvent) === "move.line") {
    let reject = false;
    let moveDown: boolean | undefined;
    let movedLine: Line;
    let targetLine: Line;
    let i = 0;
    tr.changes.iterChanges((from, to, _fromB, _toB, insert) => {
      if (moveDown === undefined) {
        moveDown = insert.text.length === 2;
      }
      if (moveDown && i === 0) {
        movedLine = startDoc.lineAt(_fromB);
        targetLine = startDoc.lineAt(movedLine.to + 1);
      }
      if (moveDown === false && i === 0) {
        movedLine = startDoc.lineAt(to + 1);
        targetLine = startDoc.lineAt(movedLine.from - 1);
      }
      i++;
    });
    decorations.between(movedLine!.from, movedLine!.to, (_, __, ___) => {
      reject = true;
      return false;
    });
    decorations.between(targetLine!.from, targetLine!.to, (_, __, ___) => {
      reject = true;
      return false;
    });
    if (reject) {
      const cursorPosition = tr.startState.selection.main.anchor;
      Object.assign(tr, {
        changes: ChangeSet.of([], startDoc.length, tr.startState.lineBreak),
        selection: EditorSelection.single(cursorPosition, cursorPosition),
      });
    }
  }

  // When Alt + Shift + Up / Down is used to copy a line, the entire projection must be copied
  if (tr.annotation(Transaction.userEvent) === "input.copyline") {
    let modifyCopy = false;
    const modifiedChanges: ChangeSpec[] = [];
    tr.changes.iterChanges((from, to, _fromB, _toB, insert) => {
      const change: ChangeSpec = { from, to: undefined, insert };
      let copiedLine: Line;
      let prefix = "";
      let postfix = "";
      if (insert.text[0] === "") {
        copiedLine = startDoc.lineAt(from - 1);
        change.from = copiedLine.from - 1;
        prefix = "\n";
      } else {
        copiedLine = startDoc.lineAt(to + 1);
        change.from = copiedLine.to + 1;
        postfix = "\n";
      }
      let copyFrom = Infinity;
      let copyTo = 0;
      let leadingWhiteSpace = "";
      decorations.between(copiedLine.from, copiedLine.to, (_, __, dec) => {
        modifyCopy = true;
        const match = dec.spec.widget.match;
        if (match.from <= copiedLine.from && match.to >= copiedLine.to) {
          copyFrom = match.from;
          copyTo = match.to;
          change.from = startDoc.lineAt(match.to).to + 1;
          return false;
        }
        if (match.from >= copiedLine.from && match.to <= copiedLine.to) {
          copyFrom = Math.min(copyFrom, match.from);
          copyTo = Math.max(copyTo, match.to);
          const whiteSpace = copiedLine.text.match(/^\s*/);
          leadingWhiteSpace = whiteSpace?.length ? whiteSpace[0] : "";
        }
      });
      change.insert = prefix + leadingWhiteSpace + startDoc.slice(copyFrom, copyTo) + postfix;
      modifiedChanges.push(change);
    });
    if (modifyCopy) {
      const firstChange = modifiedChanges[0] as { from: number; to: number };
      const cursorPosition = firstChange.from + 1;
      Object.assign(tr, {
        selection: EditorSelection.single(cursorPosition, cursorPosition),
        changes: ChangeSet.of(modifiedChanges, startDoc.length, tr.startState.lineBreak),
      });
    }
  }

  // When Ctrl + Shift + K is used to delte a line, all lines spanned hy the projections must be deleted
  if (tr.annotation(Transaction.userEvent) === "delete.line") {
    let modifyDelete = false;
    const modifiedChanges: ChangeSpec[] = [];
    let match: Match;
    tr.changes.iterChanges((from, to, _fromB, _toB, insert) => {
      const change: ChangeSpec = { from, to, insert };
      const selection = tr.startState.selection.main;
      decorations.between(selection.from, selection.to, (_, __, dec) => {
        match = dec.spec.widget.match;
        change.from = startDoc.lineAt(match.from).from;
        change.to = Math.min(startDoc.lineAt(match.node.endIndex).to + 1, startDoc.length);
        change.insert = "";
        modifyDelete = true;
        return false;
      });
      modifiedChanges.push(change);
    });
    if (modifyDelete) {
      Object.assign(tr, {
        selection: EditorSelection.single(match!.from, match!.from),
        changes: ChangeSet.of(modifiedChanges, startDoc.length, tr.startState.lineBreak),
      });
    }
  }

  // Handle changes to a projection's range.
  // Changes that replace the whole projection are accepted.
  // Changes that remove the start or end of a decoration remove the whole projection range.
  // All other changes in the projection range are rejected.
  const changes: ChangeSpec[] = [];
  let modifyChanges = false;
  tr.changes.iterChanges((from, to, _fromB, _toB, insert) => {
    const change = { from, to, insert };
    let accept = true;
    // Only check decorations for which the change affects
    // its insides. By using the +/- 1 offset, we avoid
    // filtering insertion directly before or after a decoration.
    decorations.between(from + 1, to - 1, (fromDec, toDec, dec) => {
      const widget: ProjectionWidget = dec.spec.widget;
      if ((from === fromDec && to === from + 1) || (to === toDec && from === to - 1)) {
        change.from = widget.match.from;
        change.to = widget.match.node.endIndex;
        Object.assign(tr, {
          selection: EditorSelection.single(widget.match.from),
        });
        modifyChanges = true;
        return false;
      }
      if (from > fromDec || to < toDec) {
        accept = false;
        modifyChanges = true;
        return false;
      }
    });

    // Correct transactions where text is inserted at the end of a line
    // right after a widget to prevent the cursor from jumping to the next line.
    const posNextToChange = from - 1;
    decorations.between(posNextToChange, posNextToChange, (_, decTo, ___) => {
      const charNextToChange = tr.startState.doc.toString().charAt(posNextToChange);
      if (
        decTo === posNextToChange &&
        charNextToChange === "\n" &&
        change.insert.toString() !== "" &&
        tr.annotation(Transaction.userEvent) !== "move.line" &&
        tr.annotation(Transaction.userEvent) !== "input.copyline" &&
        tr.annotation(Transaction.userEvent) !== "delete.line"
      ) {
        modifyChanges = true;
        change.from--;
        change.to--;
        Object.assign(tr, {
          selection: EditorSelection.single(change.to + 1),
        });
      }
    });
    if (accept) {
      changes.push(change);
    }
  }, true);
  if (modifyChanges) {
    Object.assign(tr, {
      changes: ChangeSet.of(changes, tr.changes.length, tr.startState.lineBreak),
    });
  }

  // Handle cursor movements into projections
  const { selection } = tr;
  if (!modifyChanges && selection?.ranges.length === 1 && selection.main.empty) {
    const pos = selection.main.anchor;
    const assoc = selection.main.assoc;
    // Find decorations that _contain_ the cursor (hence the +/- 1),
    // not only touch it
    decorations.between(pos + 1, pos - 1, (fromDec, toDec, dec) => {
      const widget = dec.spec.widget;
      if (!(widget instanceof ProjectionWidget)) {
        return;
      }
      // Cursor entering from left
      if (assoc === -1 && pos === fromDec + 1) {
        if (!widget.enterFromStart()) {
          Object.assign(tr, { selection: EditorSelection.single(toDec) });
        }
        return false;
      }
      // Cursor entering from right
      if (assoc === 1 && pos === toDec - 1) {
        if (!widget.enterFromEnd()) {
          Object.assign(tr, { selection: EditorSelection.single(fromDec) });
        }
        return false;
      }
    });
  }

  // Ensure projections are selected either entirely or not at all
  if (!modifyChanges && selection?.ranges.length) {
    const newRanges: SelectionRange[] = [];
    for (const range of selection.ranges) {
      if (range.empty) {
        newRanges.push(range);
      } else {
        let newFrom: number;
        let newTo: number;
        let newRange = range;
        decorations.between(range.from, range.to, (from, to, dec) => {
          const widget: ProjectionWidget = dec.spec.widget;
          newFrom = Math.min(widget.match.from, from);
          newTo = Math.max(widget.match.to, to);
          newRange = EditorSelection.range(newFrom, newTo);
        });
        newRanges.push(newRange);
      }
    }
    Object.assign(tr, { selection: EditorSelection.create(newRanges) });
  }

  return tr;
});
