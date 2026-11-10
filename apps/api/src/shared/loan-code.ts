/**
 * Generates a unique loan code formatted as LN-YYYYMMDD-XXX
 * Example: LN-20261110-001
 */
export function generateLoanCode(sequenceNumber: number = 1, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const paddedSeq = String(sequenceNumber).padStart(3, '0');
  return `LN-${dateStr}-${paddedSeq}`;
}

/**
 * Validates whether a given code matches the standard loan code format
 */
export function isValidLoanCode(code: string): boolean {
  const loanCodeRegex = /^LN-\d{8}-\d{3,}$/;
  return loanCodeRegex.test(code);
}