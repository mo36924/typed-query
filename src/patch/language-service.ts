import type { CompletionItemKind } from "graphql-language-service";
import type ts from "typescript";
import type { DiagnosticSeverity } from "vscode-languageserver-types";
import type * as module from "./module";

declare const {
  forEachChild,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isTaggedTemplateExpression,
  isTemplateMiddle,
  isTemplateTail,
  ScriptElementKind,
  DiagnosticCategory,
}: typeof ts;

declare const __mod: typeof module;
declare const _createLanguageService: typeof ts.createLanguageService;

const createLanguageServiceFactory = () => {
  const {
    buildFile,
    graphql: { GraphQLError },
    graphqlLanguageService: {
      CompletionItemKind,
      DIAGNOSTIC_SEVERITY,
      Position,
      getAutocompleteSuggestions,
      getDiagnostics,
      getHoverInformation,
      getTokenAtPosition,
    },
  } = __mod;

  const schema = buildFile();

  const isQueryTag = (node: ts.Node): node is ts.TaggedTemplateExpression =>
    isTaggedTemplateExpression(node) && isIdentifier(node.tag) && node.tag.getText() === "tq";

  const getScriptElementKind = (completionItemKind: CompletionItemKind | undefined): ts.ScriptElementKind => {
    switch (completionItemKind) {
      case CompletionItemKind.Function:
      case CompletionItemKind.Constructor:
        return ScriptElementKind.functionElement;
      case CompletionItemKind.Field:
      case CompletionItemKind.Variable:
        return ScriptElementKind.memberVariableElement;
      default:
        return ScriptElementKind.unknown;
    }
  };

  const getDiagnosticCategory = (diagnosticSeverity: DiagnosticSeverity | undefined): ts.DiagnosticCategory => {
    switch (diagnosticSeverity) {
      case DIAGNOSTIC_SEVERITY.Warning:
        return DiagnosticCategory.Warning;
      case DIAGNOSTIC_SEVERITY.Information:
        return DiagnosticCategory.Message;
      case DIAGNOSTIC_SEVERITY.Hint:
        return DiagnosticCategory.Suggestion;
      default:
        return DiagnosticCategory.Error;
    }
  };

  const getHoverQueryTag = (sourceFile: ts.SourceFile, position: number) => {
    const tag = forEachChild(sourceFile, function visitor(node): true | undefined | ts.TaggedTemplateExpression {
      if (position < node.pos) {
        return true;
      }

      if (position >= node.end) {
        return;
      }

      if (isQueryTag(node)) {
        const template = node.template;

        if (isNoSubstitutionTemplateLiteral(template)) {
          if (position >= template.getStart() + 1 && position < template.getEnd() - 1) {
            return node;
          }
        } else {
          const head = template.head;

          if (position >= head.getStart() + 1 && position < head.getEnd() - 2) {
            return node;
          }

          for (const { literal } of template.templateSpans) {
            if (
              position >= literal.getStart() + 1 &&
              position < literal.getEnd() - (isTemplateMiddle(literal) ? 2 : 1)
            ) {
              return node;
            }
          }
        }
      }

      return forEachChild(node, visitor);
    });

    if (tag === true) {
      return;
    }

    return tag;
  };

  const normalizeQuery = (node: ts.TaggedTemplateExpression) => {
    const template = node.template;
    let query = "";

    if (isNoSubstitutionTemplateLiteral(template)) {
      // 2 \`\`
      const templateWidth = template.getWidth() - 2;
      query = template.text.padStart(templateWidth);
    } else {
      const head = template.head;
      const templateSpans = template.templateSpans;

      // 3 \`...\${
      const templateWidth = head.getWidth() - 3;
      query = head.text.padStart(templateWidth);

      templateSpans.forEach((span, i) => {
        const spanWidth = span.getFullWidth();
        const literal = span.literal;
        const literalWidth = literal.getWidth();
        const expressionWidth = spanWidth - literalWidth;
        const variableName = `$_${i}`;
        const variable = variableName.padStart(expressionWidth + 2).padEnd(expressionWidth + 3);
        const templateWidth = literalWidth - (isTemplateTail(literal) ? 2 : 3);
        const template = literal.text.padStart(templateWidth);
        query += variable + template;
      });
    }

    const field = query.match(/\w+/)?.[0] ?? "";
    const isMutation = !!schema.getMutationType()?.getFields()[field];
    const operation = isMutation ? "mutation" : "query";
    query = operation + query.replace(/\n|\r/g, " ");
    const offset = -operation.length + template.getStart() + 1;

    return { query, offset };
  };

  const createLanguageService: typeof ts.createLanguageService = (...args) => {
    const languageService = _createLanguageService(...args);
    const getSourceFile = (fileName: string) => languageService.getProgram()?.getSourceFile(fileName);

    return {
      ...languageService,
      getQuickInfoAtPosition(fileName, position) {
        const sourceFile = getSourceFile(fileName);

        if (!sourceFile) {
          return;
        }

        const tag = getHoverQueryTag(sourceFile, position);

        if (!tag) {
          return languageService.getQuickInfoAtPosition(fileName, position);
        }

        const { query, offset } = normalizeQuery(tag);
        const cursor = new Position(0, position - offset);
        const token = getTokenAtPosition(query, cursor);
        const marked = getHoverInformation(schema, query, cursor, token);

        if (marked === "" || typeof marked !== "string") {
          return;
        }

        return {
          kind: ScriptElementKind.string,
          textSpan: {
            start: offset + token.start,
            length: token.end - token.start,
          },
          kindModifiers: "",
          displayParts: [{ text: marked, kind: "" }],
        };
      },
      getCompletionsAtPosition(fileName, position, options) {
        const sourceFile = getSourceFile(fileName);

        if (!sourceFile) {
          return;
        }

        const tag = getHoverQueryTag(sourceFile, position);

        if (!tag) {
          return languageService.getCompletionsAtPosition(fileName, position, options);
        }

        const { query, offset } = normalizeQuery(tag);
        const cursor = new Position(0, position - offset);
        const items = getAutocompleteSuggestions(schema, query, cursor);

        if (/^\s*{\s*}\s*$/.test(query)) {
          const operation = "mutation";
          const cursor = new Position(0, operation.length + position - offset);
          const labels = new Set(items.map((item) => item.label));
          const mutationItems = getAutocompleteSuggestions(schema, operation + query, cursor).filter(
            (item) => !labels.has(item.label)
          );
          items.push(...mutationItems);
        }

        if (!items.length) {
          return;
        }

        return {
          isGlobalCompletion: false,
          isMemberCompletion: false,
          isNewIdentifierLocation: false,
          entries: items.map((item) => ({
            name: item.label,
            kindModifiers: "",
            kind: getScriptElementKind(item.kind),
            sortText: "",
          })),
        };
      },
      getSemanticDiagnostics(fileName) {
        const diagnostics = languageService.getSemanticDiagnostics(fileName);
        const sourceFile = getSourceFile(fileName);

        if (!sourceFile) {
          return diagnostics;
        }

        forEachChild(sourceFile, function visitor(node) {
          if (isQueryTag(node)) {
            try {
              const { query, offset } = normalizeQuery(node);
              const _diagnostics = getDiagnostics(query, schema);

              for (const {
                range: { start, end },
                severity,
                message,
              } of _diagnostics) {
                diagnostics.push({
                  category: getDiagnosticCategory(severity),
                  code: 9999,
                  messageText: message,
                  file: sourceFile,
                  start: start.character + offset,
                  length: end.character - start.character,
                });
              }
            } catch (error) {
              if (error instanceof GraphQLError) {
                diagnostics.push({
                  category: DiagnosticCategory.Error,
                  code: 9999,
                  messageText: error.message,
                  file: sourceFile,
                  start: node.template.getStart() + 1,
                  length: node.template.getWidth() - 2,
                });
              }
            }
          }

          forEachChild(node, visitor);
        });

        return diagnostics;
      },
    };
  };

  return createLanguageService;
};

const createLanguageServiceFactoryCode = createLanguageServiceFactory.toString();
const createLanguageServiceCode = `const createLanguageService = (${createLanguageServiceFactoryCode})();`;

export const replaceCreateLanguageService = (code: string) =>
  code.replace("function createLanguageService(", () => `${createLanguageServiceCode}function _createLanguageService(`);
