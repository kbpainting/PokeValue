export interface TAGCertResult {
  certNumber: string;
  verificationUrl: string;
  digReportUrl: string;
  imageUrl: string | null;
  valid: boolean;
  errorMessage: string | null;
}

/**
 * TAG Grading cert lookup.
 * TAG uses tagd.co shortlinks for DIG reports.
 * The DIG report contains high-res images and scoring details.
 */
export async function lookupTAGCert(certNumber: string): Promise<TAGCertResult> {
  const cleanCert = certNumber.trim();
  const digReportUrl = `https://tagd.co/${cleanCert}`;

  try {
    // Try to follow the tagd.co redirect to get the actual report URL
    const response = await fetch(digReportUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    return {
      certNumber: cleanCert,
      verificationUrl: response.url || digReportUrl,
      digReportUrl,
      imageUrl: null,
      valid: response.ok,
      errorMessage: response.ok ? null : `TAG returned ${response.status}`,
    };
  } catch {
    return {
      certNumber: cleanCert,
      verificationUrl: digReportUrl,
      digReportUrl,
      imageUrl: null,
      valid: true, // Still return the URL even if HEAD fails
      errorMessage: null,
    };
  }
}
