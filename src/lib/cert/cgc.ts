import * as cheerio from 'cheerio';

export interface CGCCertResult {
  certNumber: string;
  verificationUrl: string;
  imageUrl: string | null;
  grade: string | null;
  cardName: string | null;
  valid: boolean;
  errorMessage: string | null;
}

/**
 * Looks up a CGC cert by scraping their public cert lookup page.
 * CGC has no public API, so we scrape the verification page.
 */
export async function lookupCGCCert(certNumber: string): Promise<CGCCertResult> {
  const cleanCert = certNumber.replace(/[^0-9]/g, '');
  const verificationUrl = `https://www.cgccards.com/certlookup/${cleanCert}/`;

  try {
    const response = await fetch(verificationUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        certNumber: cleanCert,
        verificationUrl,
        imageUrl: null,
        grade: null,
        cardName: null,
        valid: false,
        errorMessage: `CGC returned ${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to find cert image
    const imageUrl =
      $('img.cert-image').attr('src') ||
      $('img[alt*="cert"]').attr('src') ||
      $('img[alt*="CGC"]').attr('src') ||
      $('.cert-details img').attr('src') ||
      $('img[src*="cert"]').attr('src') ||
      null;

    // Try to find grade
    const grade =
      $('.cert-grade').text().trim() ||
      $('[data-grade]').attr('data-grade') ||
      null;

    // Try to find card name
    const cardName =
      $('.cert-description').text().trim() ||
      $('h1.cert-title').text().trim() ||
      null;

    return {
      certNumber: cleanCert,
      verificationUrl,
      imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://www.cgccards.com${imageUrl}`) : null,
      grade,
      cardName,
      valid: true,
      errorMessage: null,
    };
  } catch (error) {
    console.error('CGC cert lookup error:', error);
    return {
      certNumber: cleanCert,
      verificationUrl,
      imageUrl: null,
      grade: null,
      cardName: null,
      valid: false,
      errorMessage: `Scraping error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}
