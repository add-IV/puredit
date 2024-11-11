import { arg } from "@puredit/parser";
import { RootProjection, simpleProjection } from "@puredit/projections";
import { parser } from "../parser";

const str = arg("str", ["string"]);

const pattern = parser.statementPattern("Image:Text")`
showText(${str})
`;

const widget = simpleProjection(["show text", str]);

export const textProjection: RootProjection = {
  pattern,
  description: "show some text",
  requiredContextVariables: [],
  segmentWidgets: [widget],
  subProjections: [],
};
