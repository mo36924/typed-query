import type ts from "typescript";
import type * as module from "./module";

declare const {
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  createSymbolTable,
  emptyArray,
  SymbolFlags,
  CheckFlags,
  SyntaxKind,
}: typeof ts;

declare const { createAnonymousType, createArrayType }: ts.TypeChecker;

declare function createSymbol(flags: ts.SymbolFlags, name: string, checkFlags?: ts.CheckFlags): ts.TransientSymbol;
declare function createTupleType(
  elementTypes: readonly ts.Type[],
  elementFlags?: readonly ts.ElementFlags[],
  readonly?: boolean,
  namedMemberDeclarations?: readonly (ts.NamedTupleMember | ts.ParameterDeclaration | undefined)[]
): ts.TypeReference;
declare function createSyntheticExpression(
  parent: ts.Node,
  type: ts.Type,
  isSpread?: boolean,
  tupleNameSource?: ts.ParameterDeclaration | ts.NamedTupleMember
): ts.Expression;
declare function getGlobalSymbol(
  name: string,
  meaning: ts.SymbolFlags,
  diagnostic: ts.DiagnosticMessage | undefined
): ts.Symbol | undefined;
declare function getExportsOfSymbol(symbol: ts.Symbol): ts.SymbolTable;
declare function getSymbol(symbols: ts.SymbolTable, name: string, meaning: ts.SymbolFlags): ts.Symbol | undefined;
declare function getDeclaredTypeOfSymbol(symbol: ts.Symbol): ts.Type;
declare function getGlobalType(name: string, arity: 0, reportErrors: true): ts.ObjectType;
declare function getUnionType(
  types: readonly ts.Type[],
  unionReduction?: ts.UnionReduction,
  aliasSymbol?: ts.Symbol,
  aliasTypeArguments?: readonly ts.Type[],
  origin?: ts.Type
): ts.Type;
declare function getGlobalTemplateStringsArrayType(): ts.ResolvedType;
declare function getIntersectionType(
  types: readonly ts.Type[],
  aliasSymbol?: ts.Symbol,
  aliasTypeArguments?: readonly ts.Type[],
  noSupertypeReduction?: boolean
): ts.Type;

declare const unknownType: ts.IntrinsicType;
declare const nullType: ts.IntrinsicType;
declare const stringType: ts.IntrinsicType;
declare const numberType: ts.IntrinsicType;
declare const booleanType: ts.IntrinsicType;
declare const emptyObjectType: ts.ResolvedType;

declare const __mod: typeof module;

declare function _getEffectiveCallArguments(node: ts.CallLikeExpression): readonly ts.Expression[];

const getEffectiveCallArgumentsFactory = () => {
  function getGlobalDateType() {
    return ((getGlobalDateType as any).__ ||= getGlobalType("Date", 0, true) || emptyObjectType);
  }

  function createPropertySymbolWithType(name: string, type: ts.Type, readonly?: boolean): ts.TransientSymbol {
    const symbol = createSymbol(SymbolFlags.Property, name, readonly ? CheckFlags.Readonly : undefined);
    symbol.links.type = type;
    return symbol;
  }

  function createPropertiesType(symbolTable: ts.SymbolTable): ts.Type {
    const type = createAnonymousType(undefined, symbolTable, emptyArray, emptyArray, emptyArray);
    return type;
  }

  // function getTypescriptType(typeName: string): ts.Type {
  //   const symbol = getGlobalSymbol("GraphQL", SymbolFlags.Namespace, undefined);
  //   const exportsSymbol = symbol && getExportsOfSymbol(symbol);
  //   const typeSymbol = exportsSymbol && getSymbol(exportsSymbol, typeName, SymbolFlags.Type);
  //   const type = typeSymbol && getDeclaredTypeOfSymbol(typeSymbol);
  //   return type || unknownType;
  // }

  function getTypescriptType(typeName: string): ts.Type {
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

  function getEffectiveCallArguments(node: ts.CallLikeExpression): readonly ts.Expression[] {
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
        isNullableType,
      },
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

      template.templateSpans.forEach((span, i) => {
        query += `$_${i}${span.literal.text}`;
      });
    }

    const schema = buildFile();
    let documentNode = parse(query);

    const errors = validate(schema, documentNode);

    if (errors.length) {
      return _getEffectiveCallArguments(node);
    }

    const typeInfo = new TypeInfo(schema);
    const values: ts.Type[] = [];
    const variables: ts.Symbol[] = [];
    const symbols: ts.Symbol[] = [];
    const symbolsMap = new Map<any, ts.Symbol[]>();
    let i = 0;

    visit(
      documentNode,
      visitWithTypeInfo(typeInfo, {
        Variable() {
          const variableName = `_${i++}`;
          const inputType = typeInfo.getInputType()!;
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
          enter(node, _key, parent) {
            if (node.selectionSet) {
              symbolsMap.set(node.selectionSet.selections, []);
              return;
            }

            const parentSymbols = symbolsMap.get(parent) || symbols;
            const fieldName = (node.alias || node.name).value;
            const outputType = typeInfo.getType()!;
            const namedType = getNamedType(outputType);
            let type = getTypescriptType(namedType.name);

            if (isNullableType(outputType)) {
              type = getUnionType([type, nullType]);
            }

            const symbol = createPropertySymbolWithType(fieldName, type);
            parentSymbols.push(symbol);
            return false;
          },
          leave(node, _key, parent) {
            const parentSymbols = symbolsMap.get(parent) || symbols;
            const fieldName = (node.alias || node.name).value;
            const outputType = typeInfo.getType()!;
            const nullableType = getNullableType(outputType);
            const selectionSymbols = symbolsMap.get(node.selectionSet!.selections);
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
          },
        },
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
      createPropertiesType(createSymbolTable([privateSymbol])),
    ]);

    const args: ts.Expression[] = [createSyntheticExpression(template, graphQLTemplateStringsArrayType)];

    if (template.kind === SyntaxKind.TemplateExpression) {
      template.templateSpans.forEach((span) => {
        args.push(span.expression);
      });
    }

    return args;
  }

  return getEffectiveCallArguments;
};

const getEffectiveCallArgumentsFactoryCode = getEffectiveCallArgumentsFactory.toString();

export const getEffectiveCallArgumentsCode = getEffectiveCallArgumentsFactoryCode.slice(
  getEffectiveCallArgumentsFactoryCode.indexOf("{") + 1,
  getEffectiveCallArgumentsFactoryCode.lastIndexOf("return")
);

export const replaceGetEffectiveCallArguments = (code: string) =>
  code.replace(
    "function getEffectiveCallArguments(",
    () => `${getEffectiveCallArgumentsCode}function _getEffectiveCallArguments(`
  );
