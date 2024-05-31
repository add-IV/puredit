import { flexPlugin } from "./flex";
import { createProjectionState, projectionState, updateProjectionsEffect } from "./state/state";
import { transactionFilter } from "./filter";
import { completions } from "./completions/completions";
import type {
  ProjectionPluginConfig,
  Projection,
  SubProjection,
  RootProjection,
  ContextVariableMap,
  ContextInformation,
} from "./types";
import { style } from "./style";

export type {
  ProjectionPluginConfig,
  Projection,
  SubProjection,
  RootProjection,
  ContextVariableMap,
  ContextInformation,
};

export const projectionPlugin = (config: ProjectionPluginConfig) => [
  style,
  projectionState.init((state) => createProjectionState(state, config)),
  transactionFilter,
  flexPlugin,
];

export { completions, updateProjectionsEffect };
