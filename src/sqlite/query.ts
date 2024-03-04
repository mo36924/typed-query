import { FieldNode, OperationDefinitionNode, getArgumentValues, valueFromAST, valueFromASTUntyped } from "graphql";
import { Context, buildContext, getFieldDefInfo, getFieldDefinition } from "../query";
import { Schema } from "../schema";

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const literal = (value: string | number | boolean | Date | null | undefined) => {
  if (value == null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return value.toString();
    case "object":
      if (value instanceof Date) {
        const iso = value.toISOString();
        return `'${iso.slice(0, 10)} ${iso.slice(11, 23)}'`;
      }

      value = String(value);
  }

  value = `'${value.replaceAll("'", "''")}'`;

  return value;
};

export const buildQuery = (schema: Schema, query: string) => {
  const context = buildContext(schema, query);
  if (context.query) {
    return createQuery(context, context.query);
  }

  if (context.mutation) {
    return createMutation(context);
  }
};

const createQuery = (context: Context, node: OperationDefinitionNode | FieldNode) => {
  const values: any[] = [];
  const sql = `select ${fields(context, "Query", node)} as ${identifier(
    node.kind === "OperationDefinition" ? "data" : (node.alias ?? node.name).value
  )};`;
  return [sql, values];
};

const fields = (context: Context, parent: string, node: OperationDefinitionNode | FieldNode) =>
  `jsonb_object(${(node.selectionSet!.selections as FieldNode[])
    .map((node) => `${literal((node.alias ?? node.name).value)},${field(context, parent, node)}`)
    .join()})`;

const field = (context: Context, parent: string, node: FieldNode) => {
  const { schema } = context;
  const name = node.name.value;
  const { scalar, type, directives, list, def } = getFieldDefinition(schema, parent, name);

  if (scalar) {
    switch (type) {
      case "Date":
        return `jsonb_array(0,${identifier(name)})`;
      default:
        return identifier(name);
    }
  }

  let query: string = `select ${fields(context, type, node)} as ${identifier("data")} from ${identifier(type)}`;
  const args: { [argument: string]: any } = getArgumentValues(def, node);
  const predicates: string[] = [];

  if (directives.type) {
    predicates.push(
      `id in (select ${identifier(directives.type.keys[1])} from ${identifier(directives.type.name)} where ${identifier(
        directives.type.keys[1]
      )} is not null and ${identifier(directives.type.keys[0])} = ${identifier(parent)}.${identifier("id")})`
    );
  } else if (directives.field) {
    predicates.push(`${identifier(directives.field.key)} = ${identifier(parent)}.${identifier("id")}`);
  } else if (directives.key) {
    predicates.push(`${identifier("id")} = ${identifier(parent)}.${identifier(directives.key.name)}`);
  }

  const _where = where(context, args.where);

  if (_where) {
    predicates.push(_where);
  }

  if (predicates.length) {
    query += ` where ${predicates.join(" and ")}`;
  }

  const _order = order(args.order);

  if (_order) {
    query += ` order by ${_order}`;
  }

  if (!list) {
    query += ` limit 1`;
  } else if (args.limit != null) {
    query += ` limit $${values.push(args.limit)}`;
  }

  if (args.offset != null) {
    query += ` offset $${values.push(args.offset)}`;
  }

  if (list) {
    query = `coalesce((select json_group_array(${identifier("data")}) from (${query}) as ${identifier(
      "t"
    )}),jsonb_array())`;
  } else {
    query = `(${query})`;
  }

  return query;
};

const where = (context: Context, args: { [key: string]: any } | null | undefined) => {
  if (!args) {
    return "";
  }

  const { not, and, or, ...fields } = args;
  const values = context.values;
  let predicates: string[] = [];

  for (const [field, operators] of Object.entries(fields)) {
    if (operators == null) {
      continue;
    }

    for (const [operator, value] of Object.entries(operators) as [ComparisonOperator, any][]) {
      if (value === null) {
        if (operator === "eq") {
          predicates.push(`${identifier(field)} is null`);
        } else if (operator === "ne") {
          predicates.push(`${identifier(field)} is not null`);
        }

        continue;
      }

      if (operator === "in") {
        predicates.push(`${identifier(field)} in (${value.map((value: any) => `$${values.push(value)}`).join()})`);
      } else if (operator in operators) {
        predicates.push(`${identifier(field)} ${operators[operator]} $${values.push(value)}`);
      }
    }
  }

  const _not = where(context, not);

  if (_not) {
    predicates.push(`not ${_not}`);
  }

  const _and = where(context, and);

  if (_and) {
    predicates.push(_and);
  }

  if (predicates.length) {
    predicates = [predicates.join(" and ")];
  }

  const _or = where(context, or);

  if (_or) {
    predicates.push(_or);
  }

  if (!predicates.length) {
    return "";
  }

  return `(${predicates.join(" or ")})`;
};

const order = (args: { [key: string]: string } | null | undefined) =>
  args
    ? Object.entries(args)
        .map(([field, order]) => `${identifier(field)} ${order}`)
        .join()
    : "";
