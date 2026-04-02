export interface PSACertResult {
  certNumber: string;
  grade: string;
  imageUrl: string | null;
  cardName: string | null;
  year: string | null;
  brand: string | null;
  category: string | null;
  valid: boolean;
  errorMessage: string | null;
}

/**
 * Looks up a PSA cert using the official PSA Public API.
 * Endpoint: GET /cert/GetByCertNumber/{certNumber}
 * Auth: bearer token in Authorization header
 * Rate limit: 100 calls/day (free tier)
 */
export async function lookupPSACert(certNumber: string): Promise<PSACertResult> {
  const token = process.env.PSA_API_TOKEN;

  if (!token) {
    return {
      certNumber,
      grade: '',
      imageUrl: null,
      cardName: null,
      year: null,
      brand: null,
      category: null,
      valid: false,
      errorMessage: 'PSA API token not configured',
    };
  }

  try {
    // Clean cert number - remove spaces, dashes, non-numeric chars
    const cleanCert = certNumber.replace(/[^0-9]/g, '');

    if (cleanCert.length < 5) {
      return {
        certNumber,
        grade: '',
        imageUrl: null,
        cardName: null,
        year: null,
        brand: null,
        category: null,
        valid: false,
        errorMessage: 'Cert number too short (must be at least 5 digits)',
      };
    }

    const response = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${cleanCert}`,
      {
        headers: {
          Authorization: `bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (response.status === 204) {
      return {
        certNumber: cleanCert,
        grade: '',
        imageUrl: null,
        cardName: null,
        year: null,
        brand: null,
        category: null,
        valid: false,
        errorMessage: 'Empty response - cert number may be missing',
      };
    }

    if (response.status === 500) {
      return {
        certNumber: cleanCert,
        grade: '',
        imageUrl: null,
        cardName: null,
        year: null,
        brand: null,
        category: null,
        valid: false,
        errorMessage: 'PSA API error - credentials may be invalid or rate limit exceeded',
      };
    }

    if (!response.ok) {
      return {
        certNumber: cleanCert,
        grade: '',
        imageUrl: null,
        cardName: null,
        year: null,
        brand: null,
        category: null,
        valid: false,
        errorMessage: `PSA API returned ${response.status}`,
      };
    }

    const data = await response.json();

    // Check for invalid request
    if (data.IsValidRequest === false) {
      return {
        certNumber: cleanCert,
        grade: '',
        imageUrl: null,
        cardName: null,
        year: null,
        brand: null,
        category: null,
        valid: false,
        errorMessage: data.ServerMessage || 'Invalid cert number',
      };
    }

    // Check for no data found
    if (data.ServerMessage === 'No data found') {
      return {
        certNumber: cleanCert,
        grade: '',
        imageUrl: null,
        cardName: null,
        year: null,
        brand: null,
        category: null,
        valid: false,
        errorMessage: 'No cert found with this number',
      };
    }

    // Successful lookup
    const cert = data.PSACert || data;
    return {
      certNumber: cert.CertNumber?.toString() || cleanCert,
      grade: cert.CardGrade || '',
      imageUrl: cert.ImageURL || null,
      cardName: cert.Subject || cert.CardDescription || null,
      year: cert.Year?.toString() || null,
      brand: cert.Brand || null,
      category: cert.Category || null,
      valid: true,
      errorMessage: null,
    };
  } catch (error) {
    console.error('PSA API error:', error);
    return {
      certNumber,
      grade: '',
      imageUrl: null,
      cardName: null,
      year: null,
      brand: null,
      category: null,
      valid: false,
      errorMessage: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}
