import { BrowserWasmPathProvider } from "@puredit/utils-browser";
import { Parser } from "@puredit/parser";
import { Language } from "@puredit/language-config";

const wasmPathProvider = new BrowserWasmPathProvider(Language.Python);
export const parser = await Parser.load(Language.Python, wasmPathProvider);
