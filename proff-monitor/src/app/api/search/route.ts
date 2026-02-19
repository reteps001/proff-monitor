import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.proff.dk/branches%C3%B8g?q=${encodedQuery}`;

        console.log(`Scraping Proff search: ${url}`);

        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        if (!response.ok) {
            console.error(`Proff search failed: ${response.status} ${response.statusText}`);
            return NextResponse.json({ error: "Upstream Proff error" }, { status: 502 });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const results: Array<{
            name: string;
            url: string;
            cvr?: string;
        }> = [];

        // Strategy: Find all anchor tags that link to /firma/
        // This is more robust than relying on generic MUI classes which might change
        $("a[href*='/firma/']").each((_, element) => {
            const el = $(element);
            const href = el.attr("return href") || el.attr("href");

            // Some links might be valid company links
            if (!href) return;

            // The Name is usually the text of the link
            const name = el.text().trim();

            // Proff often duplicates links or has small icon links.
            // We filter out empty names or very short ones unless we are sure.
            if (!name || name.length < 2) return;

            // To find CVR, we look at the container card.
            // Usually the link is inside a card div.
            // We look for a reliable parent container.
            const card = el.closest("div[class*='Card']");
            // If specific class not found, we just look at the parent or grandparent
            // But let's try to extract CVR from the surrounding text context if possible.

            let cvr: string | undefined = undefined;

            if (card.length > 0) {
                // Look for CVR within the card
                const cardText = card.text();
                const cvrMatch = cardText.match(/CVR-nr\s*:?\s*(\d{8})/i);
                if (cvrMatch) {
                    cvr = cvrMatch[1];
                }
            } else {
                // Fallback: Check sibling elements near the link
                const parentText = el.parent().parent().text();
                const cvrMatch = parentText.match(/CVR-nr\s*:?\s*(\d{8})/i);
                if (cvrMatch) {
                    cvr = cvrMatch[1];
                }
            }

            // Avoid duplicates
            if (results.some(r => r.url === href)) return;
            if (results.some(r => r.name === name)) return; // Avoid same company duplicate links

            // Construct full URL if relative
            const fullUrl = href.startsWith("http") ? href : `https://www.proff.dk${href}`;

            results.push({ name, url: fullUrl, cvr });
        });

        return NextResponse.json({ results: results.slice(0, 10) });

    } catch (error) {
        console.error("Search scraping error:", error);
        return NextResponse.json({ error: "Internal scraping error" }, { status: 500 });
    }
}
