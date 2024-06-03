import { Language } from "@puredit/language-config";
import ParameterTable from "./parameterTable";
import TemplateParameter from "./parameters/templateParameter";

export default class CodeString {
  static fromTemplate(
    templateStrings: TemplateStringsArray,
    params: TemplateParameter[],
    language: Language
  ) {
    const substitutions = params.map((param) => param.toCodeString(language));
    const raw = String.raw(templateStrings, ...substitutions);
    const parameterTable = ParameterTable.fromTemplate(templateStrings, params, language);
    return new CodeString(raw, parameterTable);
  }

  private _raw: string;

  constructor(raw: string, private readonly parameterTable: ParameterTable = new ParameterTable()) {
    this._raw = raw;
  }

  replace(placeholder: string, replacement: CodeString): CodeString {
    const parts = this._raw.split(placeholder);
    if (parts.length === 1) {
      throw new Error(`Placeholder ${placeholder} not found`);
    } else if (parts.length > 2) {
      throw new Error(`Placeholder ${placeholder} found multiple times`);
    }
    const startOffset = parts[0].length;
    const replacementParameterTable = replacement.parameterTable;
    replacementParameterTable.shift(startOffset);

    const shiftBound = startOffset + placeholder.length;
    const shiftOffset = replacement.raw.length - placeholder.length;
    this.parameterTable.shiftStartingAfter(shiftBound, shiftOffset);

    this.parameterTable.merge(replacementParameterTable);
    this._raw = parts[0] + replacement.raw + parts[1];
    return this;
  }

  insertInto(target: string, placeholder: string): CodeString {
    const parts = target.split(placeholder);
    if (parts.length === 1) {
      throw new Error(`Placeholder ${placeholder} not found in string ${target}`);
    } else if (parts.length > 2) {
      throw new Error(`Placeholder ${placeholder} found multiple times in string ${target}`);
    }
    const startOffset = parts[0].length;
    this.parameterTable.shift(startOffset);
    this._raw = parts[0] + this._raw + parts[1];
    return this;
  }

  resolveParameter(from: number, to: number): TemplateParameter | undefined {
    return this.parameterTable.get(from, to);
  }

  get raw() {
    return this._raw;
  }
}
