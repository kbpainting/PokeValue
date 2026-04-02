export interface BGSCertResult {
  certNumber: string;
  verificationUrl: string;
  imageUrl: string | null;
  valid: boolean;
  errorMessage: string | null;
}

/**
 * BGS/Beckett cert lookup.
 * Beckett's cert verification requires form submission (not a simple GET),
 * so we return the verification URL for the user to check.
 */
export async function lookupBGSCert(certNumber: string): Promise<BGSCertResult> {
  const cleanCert = certNumber.trim();

  return {
    certNumber: cleanCert,
    verificationUrl: `https://www.beckett.com/grading/card-lookup?search_type=cert&search_value=${encodeURIComponent(cleanCert)}`,
    imageUrl: null,
    valid: true,
    errorMessage: null,
  };
}
