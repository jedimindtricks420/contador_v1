export function assertAccountingWriteRole(role: string) {
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("FORBIDDEN");
}

export function isSystemDocumentType(code: string) {
  return ["PERIOD_CLOSING", "YEAR_END_CLOSE", "SOLIQ_IMPORT", "OPENING_CAPITAL_DECLARATION"].includes(code);
}