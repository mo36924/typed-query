export const createObject: {
  <T0 = any>(source0?: T0): T0;
  <T0, T1>(source0: T0, source1: T1): T0 & T1;
} = (...sources: any[]) => Object.assign(Object.create(null), ...sources);

export const gql = (strings: TemplateStringsArray) => strings[0];
export const isTypedQueryTag = (tag: string) => tag === "tq";
