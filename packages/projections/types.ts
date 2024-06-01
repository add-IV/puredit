import type { Text } from "@codemirror/state";
import type { Match, Parser } from "@puredit/parser";
import type { ProjectionWidgetClass } from "./projection";
import type { Pattern } from "@puredit/parser";
import type Template from "@puredit/parser/template/template";
import { ProjectionInserter } from "@puredit/declarative-projections";

export interface Projection {
  name: string;
  description: string;
  requiredContextVariables: string[];
  segmentWidgets: Array<ProjectionWidgetClass>;
  contextProvider?: FnContextProvider;
}

export type FnContextProvider = (
  match: Match,
  text: Text,
  contextInformation: ContextInformation
) => ContextInformation;

export interface RootProjection extends Projection {
  pattern: Pattern;
  subProjections: SubProjection[];
  lineAlignment?: LineAlignment;
}

export enum LineAlignment {
  Top = "top",
  Center = "center",
}

export interface SubProjection extends Projection {
  pattern: Template;
}

export interface ProjectionPluginConfig {
  parser: Parser;
  projections: Record<string, RootProjection[]>;
  projectionInserter?: ProjectionInserter;
  globalContextVariables: ContextVariableMap;
  globalContextInformation: ContextInformation;
}

export type ContextVariableMap = Record<string, any | undefined>;
export type ContextInformation = Record<string, any>;
