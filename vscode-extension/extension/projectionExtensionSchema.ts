export const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: {
    PackageExtension: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "packageExtension",
        },
        package: {
          type: "string",
        },
        rootProjections: {
          type: "array",
          items: {
            $ref: "#/definitions/RootProjectionDefinition",
          },
        },
      },
      required: ["type", "package", "rootProjections"],
    },
    RootProjectionExtension: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "rootProjectionExtension",
        },
        package: {
          type: "string",
        },
        rootProjection: {
          type: "string",
        },
        parentParameter: {
          type: "string",
        },
        subProjections: {
          type: "array",
          items: {
            $ref: "#/definitions/SubProjectionDefinition",
          },
        },
      },
      required: ["type", "package", "rootProjection", "parentParameter", "subProjections"],
    },
    SubProjectionExtension: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "subProjectionExtension",
        },
        package: {
          type: "string",
        },
        rootProjection: {
          type: "string",
        },
        subProjection: {
          type: "string",
        },
        parentParameter: {
          type: "string",
        },
        subProjections: {
          type: "array",
          items: {
            $ref: "#/definitions/SubProjectionDefinition",
          },
        },
      },
      required: [
        "type",
        "package",
        "rootProjection",
        "subProjection",
        "parentParameter",
        "subProjections",
      ],
    },
    RootProjectionDefinition: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "rootProjection",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        isExpression: {
          type: "boolean",
        },
        parameters: {
          type: "array",
          items: {
            $ref: "#/definitions/TemplateParameterDefinition",
          },
        },
        template: {
          type: "string",
        },
        segmentWidgets: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["type", "name", "description", "parameters", "template", "segmentWidgets"],
    },
    SubProjectionDefinition: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          $ref: "#/definitions/SubProjectionType",
          enum: ["chainLink", "aggregationPart"],
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        parameters: {
          type: "array",
          items: {
            $ref: "#/definitions/TemplateParameterDefinition",
          },
        },
        template: {
          type: "string",
        },
        segmentWidgets: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["type", "name", "description", "parameters", "template", "segmentWidgets"],
    },
    SubProjectionType: {
      type: "string",
      enum: ["chainLink", "aggregationPart"],
    },
    TemplateParameterDefinition: {
      anyOf: [
        {
          $ref: "#/definitions/TemplateArgumentDefinition",
        },
        {
          $ref: "#/definitions/TemplateContextVariableDefinition",
        },
        {
          $ref: "#/definitions/TemplateAggregationDefinition",
        },
      ],
    },
    TemplateArgumentDefinition: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "argument",
        },
        name: {
          type: "string",
        },
        nodeTypes: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["type", "name", "nodeTypes"],
    },
    TemplateContextVariableDefinition: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "contextVariable",
        },
        name: {
          type: "string",
        },
      },
      required: ["type", "name"],
    },
    TemplateAggregationDefinition: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
          const: "aggregation",
        },
        name: {
          type: "string",
        },
        nodeType: {
          type: "string",
        },
        partSubProjections: {
          type: "array",
          items: {
            $ref: "#/definitions/SubProjectionDefinition",
          },
        },
        startSubProjection: {
          $ref: "#/definitions/SubProjectionDefinition",
        },
      },
      required: ["type", "name", "nodeType", "partSubProjections"],
    },
    TemplateChainDefinition: {
      additionalProperties: false,
      type: "object",
      properties: {
        type: {
          type: "string",
        },
        name: {
          type: "string",
        },
        startSubProjection: {
          $ref: "#/definitions/SubProjectionDefinition",
        },
        linkSubProjections: {
          type: "array",
          items: {
            $ref: "#/definitions/SubProjectionDefinition",
          },
        },
        minimumLength: {
          type: "number",
        },
      },
      required: ["type", "name", "startSubProjection", "linkSubProjections", "minimumLength"],
    },
  },
  type: "array",
  items: {
    oneOf: [
      {
        $ref: "#/definitions/PackageExtension",
      },
      {
        $ref: "#/definitions/RootProjectionExtension",
      },
      {
        $ref: "#/definitions/SubProjectionExtension",
      },
    ],
  },
};
