import { getIndentation } from "@codemirror/language";
import {
  Completion,
  CompletionContext,
  CompletionResult,
  pickedCompletion,
} from "@codemirror/autocomplete";
import type { Context } from "@puredit/parser";
import { projectionState } from "./state";

export function completions(
  completionContext: CompletionContext
): CompletionResult | null {
  let word = completionContext.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !completionContext.explicit)) {
    return null;
  }

  const indentation = getIndentation(completionContext.state, word.from) || 0;

  const { config, contextRanges } =
    completionContext.state.field(projectionState);
  let context: Context = { ...config.globalContextVariables };
  for (const contextRange of contextRanges) {
    if (contextRange.from <= word.from && contextRange.to >= word.to) {
      Object.assign(context, contextRange.context);
    }
  }

  let options: Completion[] = [];
  for (const projection of config.projections) {
    let showOption = true;
    for (const variable of projection.requiredContextVariables) {
      if (!context.hasOwnProperty(variable)) {
        showOption = false;
        break;
      }
    }
    if (showOption) {
      options.push({
        label: projection.name,
        type: "projection",
        detail: "projection",
        boost: 1,
        info: projection.description,
        apply: (view, completion, from, to) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: projection
                .draft(context)
                .split("\n")
                .join("\n" + " ".repeat(indentation)),
            },
            annotations: pickedCompletion.of(completion),
          });
        },
      });
    }
  }

  return {
    from: word.from,
    options,
  };
}
