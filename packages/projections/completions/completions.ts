import { getIndentation } from "@codemirror/language";
import type { CompletionContext } from "@codemirror/autocomplete";
import type { CompletionResult } from "@codemirror/autocomplete";
import { projectionState } from "../state/state";
import CompletionsBuilder from "./completionResultBuilder";
import { ContextVariableMap } from "..";

/**
 * Transforms the registered projections into suggestions for the code completion
 * @param completionContext
 * @returns
 */
export function completions(completionContext: CompletionContext): CompletionResult | null {
  const word = completionContext.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !completionContext.explicit)) {
    return null;
  }

  const indentation = getIndentation(completionContext.state, word.from) || 0;

  const state = completionContext.state.field(projectionState);
  const { config, contextVariableRanges } = state;
  const contextVariables: ContextVariableMap = { ...config.globalContextVariables };
  for (const contextRange of contextVariableRanges) {
    if (contextRange.from <= word.from && contextRange.to >= word.to) {
      Object.assign(contextVariables, contextRange.contextVariables);
    }
  }

  const selection = completionContext.state.selection?.main;
  let searchString = "";
  if (selection.from !== selection.to) {
    searchString = completionContext.state.doc.slice(selection.from, selection.to).toString();
  }

  const completionsBuilder = new CompletionsBuilder();
  const options = completionsBuilder
    .setIndendation(indentation)
    .setContext(contextVariables)
    .setRootProjections(config.projections)
    .setSeachString(searchString)
    .build();

  return {
    from: word.from,
    options,
  };
}
