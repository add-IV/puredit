import type { Text } from "@codemirror/text";
import type { Context, Match, PatternNode } from "@puredit/parser";
import type { ProjectionWidgetClass } from "./projection";

export interface ProjectionCompletion {
  label: string;
  info: string;
  draft(context: Context): string;
}

export interface Projection {
  name: string;
  description: string;
  pattern: PatternNode;
  draft(context: Context): string;
  requiredContextVariables: string[];
  widgets: Array<ProjectionWidgetClass>;
  contextProvider?(match: Match, text: Text, context: object): object;
}

export interface ProjectionPluginConfig {
  projections: Projection[];
  globalContextVariables: Context;
  globalContextValues: Record<string, any>;
}
