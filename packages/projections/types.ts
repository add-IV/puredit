import type { Text } from "@codemirror/state";
import type { Match, Parser } from "@puredit/parser";
import type { ProjectionWidgetClass } from "./widget/widget";
import type { Pattern } from "@puredit/parser";
import type Template from "@puredit/parser/template/template";
import ProjectionRegistry from "./projectionRegistry";
import { ProjectionCompiler } from "@puredit/declarative-projections";

export interface ProjectionPluginConfig {
  parser: Parser;
  projectionRegistry: ProjectionRegistry;
  globalContextVariables: ContextVariableMap;
  globalContextInformation: ContextInformation;
  projectionCompiler?: ProjectionCompiler;
}

export interface RootProjection {
  pattern: Pattern;
  description: string;
  requiredContextVariables: string[];
  segmentWidgets: Array<ProjectionWidgetClass>;
  contextProvider?: FnContextProvider;
  subProjections: SubProjection[];
}

export interface SubProjection {
  template: Template;
  description: string;
  requiredContextVariables: string[];
  segmentWidgets: Array<ProjectionWidgetClass>;
  contextProvider?: FnContextProvider;
}

export interface SubProjectionWithPattern extends SubProjection {
  pattern: Pattern;
}

export type FnContextProvider = (
  match: Match,
  text: Text,
  contextInformation: ContextInformation
) => ContextInformation;

export type ContextVariableMap = Record<string, any | undefined>;
export type ContextInformation = Record<string, any>;
