import { parse, print, stripIgnoredCharacters } from "graphql";
import prettier from "prettier";

export const formatGraphQL = (graphql: string) =>
  prettier.format(print(parse(stripIgnoredCharacters(graphql))), {
    ...prettier.resolveConfig.sync("model.gql"),
    filepath: "model.gql",
  });

export const formatDeclaration = (declaration: string) =>
  prettier.format(declaration, {
    ...prettier.resolveConfig.sync("model.d.ts"),
    filepath: "model.d.ts",
  });
