import { expect, test } from "vitest";
import { formatDeclaration, formatGraphQL } from "./format";

test("formatGraphQL", () => {
  expect(formatGraphQL("type User{id:ID!}")).toMatchInlineSnapshot(`
    "type User {
      id: ID!
    }
    "
  `);
});

test("formatDeclaration", () => {
  expect(formatDeclaration("export declare type User={id:string}")).toMatchInlineSnapshot(`
    "export declare type User = { id: string };
    "
  `);
});
