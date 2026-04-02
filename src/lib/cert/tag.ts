export interface TAGCertResult {
  certNumber: string;
  verificationUrl: string;
  digReportUrl: string;
  imageUrl: string | null;
}

export async function lookupTAGCert(certNumber: string): Promise<TAGCertResult> {
  // TAG uses tagd.co shortlinks for DIG reports
  return {
    certNumber,
    verificationUrl: `https://taggrading.com/pages/cert-search`,
    digReportUrl: `https://tagd.co/${certNumber}`,
    imageUrl: null,
  };
}
