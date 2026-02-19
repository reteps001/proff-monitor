import * as cheerio from 'cheerio';

export type FinancialData = {
    year: number;
    grossProfit?: number | null;
    annualResult?: number | null;
    currency?: string | null;
}

export async function getLatestFinancialYear(companyUrl: string): Promise<FinancialData | null> {
    try {
        // Normalize URL: Ensure we are looking at the /regnskab/ page
        // Example: https://www.proff.dk/firma/lego-as/billund/hovedkontortjenester/0WHGPJI10NZ
        // Becomes: https://www.proff.dk/regnskab/lego-as/billund/hovedkontortjenester/0WHGPJI10NZ

        let targetUrl = companyUrl;
        if (companyUrl.includes('/firma/')) {
            targetUrl = companyUrl.replace('/firma/', '/regnskab/');
        }

        const fetchUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        console.log(`Checking for updates (cache-busted): ${fetchUrl}`);

        const response = await fetch(fetchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            next: { revalidate: 0 } // No cache for scraping
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.error(`Page not found: ${targetUrl}`);
                return null;
            }
            throw new Error(`Failed to fetch ${targetUrl}: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Strategy 0: Next.js Hydration Data (Most reliable for full data)
        try {
            const nextDataScript = $("#__NEXT_DATA__").html();
            if (nextDataScript) {
                const nextData = JSON.parse(nextDataScript);
                const accounts = nextData?.props?.pageProps?.company?.companyAccounts;

                if (Array.isArray(accounts)) {
                    // Find the latest account based on periodEnd
                    // Sort descending by year
                    const validAccounts = accounts.filter(a => {
                        if (!a.periodEnd) return false;
                        const year = parseInt(a.periodEnd.substring(0, 4), 10);
                        return !isNaN(year);
                    }).sort((a, b) => {
                        const yearA = parseInt(a.periodEnd.substring(0, 4), 10);
                        const yearB = parseInt(b.periodEnd.substring(0, 4), 10);
                        return yearB - yearA;
                    });

                    if (validAccounts.length > 0) {
                        const latest = validAccounts[0];
                        const year = parseInt(latest.periodEnd.substring(0, 4), 10);

                        // Extract fields
                        // bruttofort = Gross Profit
                        // AARS = Annual Result (Årets Resultat)

                        let grossProfit: number | null = null;
                        let annualResult: number | null = null;

                        if (Array.isArray(latest.accounts)) {
                            const gpObj = latest.accounts.find((x: any) => x.code === 'bruttofort');
                            if (gpObj?.amount) grossProfit = parseFloat(gpObj.amount);

                            const resObj = latest.accounts.find((x: any) => x.code === 'AARS');
                            if (resObj?.amount) annualResult = parseFloat(resObj.amount);
                        }

                        console.log(`[Scraper] Next.js data found: Year ${year}, GP: ${grossProfit}, Res: ${annualResult}`);

                        return {
                            year,
                            grossProfit,
                            annualResult,
                            currency: latest.currency || 'DKK'
                        };
                    }
                }
            }
        } catch (e) {
            console.warn("[Scraper] Strategy 0 failed to parse JSON", e);
        }

        // Fallback Strategy 1: Look for table headers (Only gets year)
        const years: number[] = [];
        $("th span").each((_, el) => {
            const text = $(el).text().trim();
            const match = text.match(/^(\d{4})-\d{2}$/);
            if (match) {
                years.push(parseInt(match[1], 10));
            }
        });

        if (years.length > 0) {
            const maxYear = Math.max(...years);
            console.log(`[Scraper] Fallback strategy found year: ${maxYear}`);
            return { year: maxYear };
        }

        // Strategy 2: Scan for date-like strings in the full raw HTML (including script tags)
        if (years.length === 0) {
            console.log("[Scraper] Strategy 1 failed, trying Strategy 2 (regex/json)...");
            const periodEndMatches = html.matchAll(/"periodEnd":"(\d{4})-\d{2}-\d{2}"/g);
            for (const match of periodEndMatches) {
                years.push(parseInt(match[1], 10));
            }
            if (years.length > 0) {
                const maxYear = Math.max(...years);
                console.log(`[Scraper] Strategy 2 found year: ${maxYear}`);
                return { year: maxYear };
            }
        }

        console.warn(`No years found for ${targetUrl}`);
        return null;

    } catch (error) {
        console.error(`Error scraping ${companyUrl}:`, error);
        return null;
    }
}
