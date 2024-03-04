export const tq = <T>(
  strings: TemplateStringsArray & { _?: T },
  ...values: T extends { values: any[] } ? T["values"] : never[]
): T extends { values: any[]; data: any } ? { query: string; values: T["values"]; _: T["data"] } : never => {
  throw new Error("Failed to transform tq tag.");
};
