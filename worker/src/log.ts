/** Only primitive, non-sensitive fields are ever logged – never request text, responses or headers. */
export type LogFields = Record<string, string | number | boolean | undefined>;

/** The only sanctioned log sink in the Worker. */
export function log(fields: LogFields): void {
  // eslint-disable-next-line no-console -- structured operational logging is intentional here
  console.log(JSON.stringify(fields));
}
