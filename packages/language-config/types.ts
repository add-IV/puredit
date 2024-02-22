import type { TreePath } from "@puredit/parser";

export enum Language {
  TypeScript = "ts",
  Python = "py",
}

export type LanguageConfig = {
  aggregations: AggregationsConfig;
  chains: ChainsConfig;
  blocks: BlocksConfig;
};

export type AggregationsConfig = {
  aggregatableNodeTypes: Record<string, AggregatableNodeTypeConfig>;
};

export type AggregatableNodeTypeConfig = {
  startToken: string;
  delimiterToken: string;
  endToken: string;
  contextTemplate: string;
};

export const aggregationPlaceHolder = "__agg__";

export type ChainsConfig = {
  pathToFirstLink: TreePath;
  chainableNodeTypes: Record<string, ChainableNodeTypeConfig>;
};

export type ChainableNodeTypeConfig = {
  pathToLinkBegin: TreePath;
  pathToNextLink: TreePath;
};

export type BlocksConfig = {
  blockNodeType: string;
};
