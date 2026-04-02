export interface BGSCertResult {
  certNumber: string;
  verificationUrl: string;
  imageUrl: string | null;
}

export async function lookupBGSCert(certNumber: string): Promise<BGSCertResult> {
  // BGS has no public API — return the verification URL
  return {
    certNumber,
    verificationUrl: `https://www.beckett.com/grading/card-lookup`,
    imageUrl: null,
  };
}
