import { expect, test } from "vitest";
import { getEffectiveCallArgumentsCode } from "./effective-call-arguments";

test("getEffectiveCallArgumentsCode", () => {
  expect(getEffectiveCallArgumentsCode).toMatchInlineSnapshot(`
    "
      function getGlobalDateType() {
        return getGlobalDateType.__ ||= getGlobalType("Date", 0, true) || emptyObjectType;
      }
      function createPropertySymbolWithType(name, type, readonly) {
        const symbol = createSymbol(SymbolFlags.Property, name, readonly ? CheckFlags.Readonly : void 0);
        symbol.links.type = type;
        return symbol;
      }
      function createPropertiesType(symbolTable) {
        const type = createAnonymousType(void 0, symbolTable, emptyArray, emptyArray, emptyArray);
        return type;
      }
      function getTypescriptType(typeName) {
        switch (typeName) {
          case "ID":
          case "String":
          case "UUID":
            return stringType;
          case "Int":
          case "Float":
            return numberType;
          case "Boolean":
            return booleanType;
          case "Date":
            return getGlobalDateType();
          default:
            return unknownType;
        }
      }
      function getEffectiveCallArguments(node) {
        if (node.kind !== SyntaxKind.TaggedTemplateExpression) {
          return _getEffectiveCallArguments(node);
        }
        const { tag, template } = node;
        const {
          isTypedQueryTag,
          buildFile,
          graphql: {
            parse,
            validate,
            TypeInfo,
            visit,
            visitWithTypeInfo,
            getNullableType,
            getNamedType,
            isListType,
            isNullableType
          }
        } = __mod;
        if (!isIdentifier(tag)) {
          return _getEffectiveCallArguments(node);
        }
        const tagName = tag.text;
        if (!isTypedQueryTag(tagName)) {
          return _getEffectiveCallArguments(node);
        }
        let query = "";
        if (isNoSubstitutionTemplateLiteral(template)) {
          query += template.text;
        } else {
          query += template.head.text;
          template.templateSpans.forEach((span, i2) => {
            query += \`$_\${i2}\${span.literal.text}\`;
          });
        }
        const schema = buildFile();
        let documentNode = parse(query);
        const errors = validate(schema, documentNode);
        if (errors.length) {
          return _getEffectiveCallArguments(node);
        }
        const typeInfo = new TypeInfo(schema);
        const values = [];
        const variables = [];
        const symbols = [];
        const symbolsMap = /* @__PURE__ */ new Map();
        let i = 0;
        visit(
          documentNode,
          visitWithTypeInfo(typeInfo, {
            Variable() {
              const variableName = \`_\${i++}\`;
              const inputType = typeInfo.getInputType();
              const nullableType = getNullableType(inputType);
              const namedType = getNamedType(nullableType);
              let type = getTypescriptType(namedType.name);
              if (isListType(nullableType)) {
                type = createArrayType(type);
              }
              if (isNullableType(inputType)) {
                type = getUnionType([type, nullType]);
              }
              const symbol = createPropertySymbolWithType(variableName, type);
              values.push(type);
              variables.push(symbol);
            },
            Field: {
              enter(node2, _key, parent) {
                if (node2.selectionSet) {
                  symbolsMap.set(node2.selectionSet.selections, []);
                  return;
                }
                const parentSymbols = symbolsMap.get(parent) || symbols;
                const fieldName = (node2.alias || node2.name).value;
                const outputType = typeInfo.getType();
                const namedType = getNamedType(outputType);
                let type = getTypescriptType(namedType.name);
                if (isNullableType(outputType)) {
                  type = getUnionType([type, nullType]);
                }
                const symbol = createPropertySymbolWithType(fieldName, type);
                parentSymbols.push(symbol);
                return false;
              },
              leave(node2, _key, parent) {
                const parentSymbols = symbolsMap.get(parent) || symbols;
                const fieldName = (node2.alias || node2.name).value;
                const outputType = typeInfo.getType();
                const nullableType = getNullableType(outputType);
                const selectionSymbols = symbolsMap.get(node2.selectionSet.selections);
                const selectionSymbolTable = createSymbolTable(selectionSymbols);
                let type = createPropertiesType(selectionSymbolTable);
                if (isListType(nullableType)) {
                  type = createArrayType(type);
                }
                if (isNullableType(outputType)) {
                  type = getUnionType([type, nullType]);
                }
                const symbol = createPropertySymbolWithType(fieldName, type);
                parentSymbols.push(symbol);
              }
            }
          })
        );
        const valuesSymbol = createPropertySymbolWithType("values", createTupleType(values));
        const variablesSymbol = createPropertySymbolWithType(
          "variables",
          createPropertiesType(createSymbolTable(variables))
        );
        const dataSymbol = createPropertySymbolWithType("data", createPropertiesType(createSymbolTable(symbols)));
        const privateSymbol = createPropertySymbolWithType(
          "_",
          createPropertiesType(createSymbolTable([valuesSymbol, variablesSymbol, dataSymbol]))
        );
        const graphQLTemplateStringsArrayType = getIntersectionType([
          getGlobalTemplateStringsArrayType(),
          createPropertiesType(createSymbolTable([privateSymbol]))
        ]);
        const args = [createSyntheticExpression(template, graphQLTemplateStringsArrayType)];
        if (template.kind === SyntaxKind.TemplateExpression) {
          template.templateSpans.forEach((span) => {
            args.push(span.expression);
          });
        }
        return args;
      }
      "
  `);
});
