import {
  GraphQLObjectType,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  assertValidSchema,
  getNamedType,
  getNullableType,
  isListType,
  isNullableType,
  isScalarType,
  parse,
  validate,
} from "graphql";
import { getDirectives } from "./directives";
import { isBaseFieldName } from "./fields";
import { Schema } from "./schema";

export type Context = {
  schema: Schema;
  query: OperationDefinitionNode | undefined;
  mutation: OperationDefinitionNode | undefined;
};

export const buildContext = (schema: Schema, query: string): Context => {
  assertValidSchema(schema);
  const document = parse(query);
  const validationErrors = validate(schema, document);

  if (validationErrors.length) {
    throw new Error(validationErrors.map((error) => error.message).join("\n\n"));
  }

  let operation;

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        operation = definition;
        break;
      default:
        throw new Error("Invalid definition.");
    }
  }

  let queryNode;
  let mutationNode;

  if (!operation) {
    throw new Error("Must provide an operation.");
  } else if (operation.operation === OperationTypeNode.QUERY) {
    queryNode = operation;
  } else if (operation.operation === OperationTypeNode.MUTATION) {
    mutationNode = operation;
  } else {
    throw new Error("Invalid operation.");
  }

  return {
    schema,
    query: queryNode,
    mutation: mutationNode,
  };
};

export const getFieldDefinition = (schema: Schema, parent: string, field: string) => {
  const def = (schema.getType(parent) as GraphQLObjectType).getFields()[field];
  const name = field;
  const fieldType = def.type;
  const nullable = isNullableType(fieldType);
  const nullableType = getNullableType(fieldType);
  const list = isListType(nullableType);
  const namedType = getNamedType(nullableType);
  const scalar = isScalarType(namedType);
  const type = namedType.name;
  const directives = getDirectives(schema, def.astNode!);
  const _isBaseFieldName = isBaseFieldName(name);
  return { schema, parent, def, name, type, scalar, list, nullable, directives, isBaseFieldName: _isBaseFieldName };
};
