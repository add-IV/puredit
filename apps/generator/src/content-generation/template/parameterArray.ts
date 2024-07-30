import TemplateArgument from "./argument";
import TemplateParameter from "./parameter";
import ComplexTemplateParameter from "./complexParameter";
import { isPrefixOf } from "../common";
import TemplateBlock from "./block";
import { Path } from "../context-var-detection/blockVariableMap";

const paramterTypeMap = {
  TemplateArgument: "arg",
  TemplateBlock: "block",
  TemplateContextVariable: "contextVariable",
  TemplateAggregation: "agg",
  TemplateChain: "chain",
};

export default class TemplateParameterArray extends Array<TemplateParameter> {
  sortByAppearance() {
    this.sort((parameterA: TemplateParameter, parameterB: TemplateParameter) => {
      const a = parameterA.path;
      const b = parameterB.path;
      const minLength = Math.min(a.length, b.length);
      for (let i = 0; i <= minLength; i++) {
        if (a[i] === undefined && b[i] !== undefined) {
          return -1;
        } else if (a[i] !== undefined && b[i] === undefined) {
          return 1;
        } else if (a[i] === undefined && b[i] === undefined) {
          return 0;
        }

        if (a[i] < b[i]) {
          return -1;
        } else if (a[i] > b[i]) {
          return 1;
        }
      }
    });
  }

  removeUnusedParameters(usedParamsWithSubProjections: ComplexTemplateParameter[]) {
    this.filterInPlace(
      (templateParam) =>
        !(templateParam instanceof ComplexTemplateParameter) ||
        usedParamsWithSubProjections.includes(templateParam)
    );
    const blocks = this.filter((param) => param instanceof TemplateBlock);
    const boundryParams = usedParamsWithSubProjections as TemplateParameter[];
    boundryParams.push(...blocks);
    boundryParams.forEach((templateParam) => {
      this.filterInPlace(
        (parameter) =>
          !(
            isPrefixOf(templateParam.path, parameter.path) &&
            parameter.path.length > templateParam.path.length
          )
      );
    });
    return this;
  }

  removeComplexParams() {
    this.filterInPlace((param) => !(param instanceof ComplexTemplateParameter));
    return this;
  }

  filterInPlace(condition: (a: TemplateParameter) => boolean) {
    let i = 0,
      j = 0;
    while (i < this.length) {
      const param = this[i];
      if (condition(param)) this[j++] = param;
      i++;
    }
    this.length = j;
    return this;
  }

  getComplexParams(): Array<ComplexTemplateParameter> {
    return this.filter((parameter) => parameter instanceof ComplexTemplateParameter);
  }

  getTemplateArguments(): TemplateArgument[] {
    return this.filter((parameter) => parameter instanceof TemplateArgument);
  }

  getParamsBelow(pathToRemove: Path): TemplateParameterArray {
    return new TemplateParameterArray(
      ...this.filter(
        (parameter) =>
          isPrefixOf(pathToRemove, parameter.path) && parameter.path.length >= pathToRemove.length
      ).map((parameter) => {
        const currentPath = parameter.path;
        const newPath = currentPath.slice(pathToRemove.length);
        return parameter.copyWithPath(newPath);
      })
    );
  }

  getRequiredParameterTypes(): string[] {
    const parameterTypes: Set<string> = new Set();
    this.forEach((parameterType) => {
      parameterTypes.add(paramterTypeMap[parameterType.constructor.name]);
    });
    return Array.from<string>(parameterTypes);
  }
}
