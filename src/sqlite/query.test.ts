import { expect, test } from "vitest";
import { buildSchema } from "../schema";
import { gql } from "../utils";
import { buildQuery } from "./query";
import Database from "better-sqlite3";

test("buildQuery", () => {
  const schema = buildSchema(gql`
    type User {
      name: String!
      posts: [Post!]!
    }

    type Post {
      message: String!
    }
  `);

  const query = gql`
    {
      user {
        name
        posts {
          message
        }
      }
    }
  `;

  const database = new Database(":memory:");
  const [sql, ...values] = buildQuery(schema, query);

  expect(sql).toMatchInlineSnapshot(
    `"select jsonb_object('user',(select jsonb_object('name',"name",'posts',coalesce((select json_group_array("data") from (select jsonb_object('message',"message") as "data" from "Post" where "userId" = "User"."id") as "t"),jsonb_array())) as "data" from "User" limit 1)) as "data";"`
  );

  const result = database.prepare(sql).get(...values);
  console.log(result);
});
