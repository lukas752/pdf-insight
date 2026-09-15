export interface LogFields {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  code?: string;
}

/** The only sanctioned log sink. Fields never include request text, responses or secrets. */
export function log(fields: LogFields): void {
  // eslint-disable-next-line no-console -- structured operational logging is intentional here
  console.log(JSON.stringify(fields));
}
