import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestFinancialYear } from "@/lib/scraper";

// Vercel Cron will hit this endpoint
export async function GET(request: NextRequest) {
    // 1. Security Check
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Fetch all companies
    // In a real production app, we would paginate this or use a queue.
    const { data: companies, error } = await supabase
        .from("companies")
        .select("*");

    if (error || !companies) {
        return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    const results = [];

    for (const company of companies) {
        try {
            const latestYear = await getLatestFinancialYear(company.proff_url);

            if (latestYear && (!company.last_known_statement_year || latestYear > company.last_known_statement_year)) {
                // NEW UPDATE FOUND!
                results.push({ name: company.name, newYear: latestYear });

                // Update company
                await supabase
                    .from("companies")
                    .update({
                        last_known_statement_year: latestYear,
                        last_checked_at: new Date().toISOString()
                    })
                    .eq("id", company.id);

                // Notify subscribers
                const { data: subscriptions } = await supabase
                    .from("subscriptions")
                    .select("user_id")
                    .eq("company_id", company.id);

                if (subscriptions) {
                    const notifications = subscriptions.map(sub => ({
                        user_id: sub.user_id,
                        company_id: company.id,
                        message: `New financial statement for ${company.name} (${latestYear}) is now available.`,
                        read: false
                    }));

                    if (notifications.length > 0) {
                        await supabase.from("notifications").insert(notifications);
                        // Here we would also trigger Email sending
                        console.log(`[MOCK EMAIL] Sending emails to ${notifications.length} users for ${company.name}`);
                    }
                }
            } else {
                // No update, just touch last_checked_at
                await supabase
                    .from("companies")
                    .update({ last_checked_at: new Date().toISOString() })
                    .eq("id", company.id);
            }

        } catch (e) {
            console.error(`Failed to process company ${company.name}`, e);
        }
    }

    return NextResponse.json({
        success: true,
        checked: companies.length,
        updates: results
    });
}
