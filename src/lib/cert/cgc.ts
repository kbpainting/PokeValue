export interface CGCCertResult {
  certNumber: string;
  verificationUrl: string;
  imageUrl: string | null;
}

export async function lookupCGCCert(certNumber: string): Promise<CGCCertResult> {
  // CGC has no public API — return the verification URL
  // The frontend can display this in an iframe or link
  return {
    certNumber,
    verificationUrl: `https://www.cgccards.com/certlookup/${certNumber}/`,
    imageUrl: null,
  };
}
