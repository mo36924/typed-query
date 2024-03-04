import { FieldDefinitionNode, GraphQLSchema, ObjectTypeDefinitionNode, getArgumentValues } from "graphql";

export type TypeDirectives = {
  join?: {};
};

export type FieldDirectives = {
  field?: { name: string; key: string };
  type?: { name: string; keys: [string, string] };
  key?: { name: string };
  ref?: { name: string };
  unique?: {};
};

export const modelDirectives = /* GraphQL */ `
  directive @field(name: String!) on FIELD_DEFINITION
  directive @type(name: String!) on FIELD_DEFINITION
`;

export const schemaDirectives = /* GraphQL */ `
  directive @join on OBJECT
  directive @unique on FIELD_DEFINITION
  directive @key(name: String!) on FIELD_DEFINITION
  directive @ref(name: String!) on FIELD_DEFINITION
  directive @field(name: String!, key: String!) on FIELD_DEFINITION
  directive @type(name: String!, keys: [String!]!) on FIELD_DEFINITION
`;

export const getDirectives = <T extends ObjectTypeDefinitionNode | FieldDefinitionNode>(
  schema: GraphQLSchema,
  node: T
): T extends ObjectTypeDefinitionNode ? TypeDirectives : FieldDirectives =>
  node.directives!.reduce((directives, directive) => {
    directives[directive.name.value] = getArgumentValues(schema.getDirective(directive.name.value)!, directive);
    return directives;
  }, Object.create(null));

export const printDirectives = (directives: TypeDirectives | FieldDirectives): string => {
  let _directives = "";

  for (const [name, args] of Object.entries(directives)) {
    if (args == null) {
      continue;
    }

    const entries = Object.entries(args);

    if (entries.length === 0) {
      _directives += `@${name}`;
      continue;
    }

    _directives += `@${name}(`;

    for (const [name, value] of entries) {
      _directives += `${name}:${JSON.stringify(value)} `;
    }

    _directives += `)`;
  }

  return _directives;
};
