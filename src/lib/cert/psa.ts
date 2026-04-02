interface PSACertResult {
  certNumber: string;
  grade: string;
  imageUrl: string | null;
  cardName: string | null;
  year: string | null;
  brand: string | null;
  valid: boolean;
}

export async function lookupPSACert(certNumber: string): Promise<PSACertResult | null> {
  const token = process.env.PSA_API_TOKEN;

  // Try API first if token available
  if (token) {
    try {
      const response = await fetch(
        `https://api.psacard.com/publicapi/cert/GetByCertNumber/${certNumber}`,
        {
          headers: {
            Authorization: `bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.PSACert) {
          return {
            certNumber: data.PSACert.CertNumber || certNumber,
            grade: data.PSACert.CardGrade || '',
            imageUrl: data.PSACert.ImageURL || null,
            cardName: data.PSACert.Subject || null,
            year: data.PSACert.Year || null,
            brand: data.PSACert.Brand || null,
            valid: true,
          };
        }
      }
    } catch (error) {
      console.error('PSA API error:', error);
    }
  }

  // Fallback: construct cert page URL for image
  return {
    certNumber,
    grade: '',
    imageUrl: `https://www.psacard.com/cert/${certNumber}`,
    cardName: null,
    year: null,
    brand: null,
    valid: false,
  };
}
