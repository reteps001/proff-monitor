'use server'

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { getLatestFinancialYear } from "@/lib/scraper"

export type SubscribeResult = {
    success: boolean
    message?: string
}

export async function subscribeToCompany(companyData: {
    name: string
    url: string
    cvr?: string
}): Promise<SubscribeResult> {
    const supabase = await createClient()

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { success: false, message: "You must be logged in to subscribe." }
    }

    // 2. Ensure company exists (Upsert based on proff_url)
    // We use the URL as the unique identifier for the company on Proff
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('proff_url', companyData.url)
        .single()

    let companyId = company?.id

    if (!companyId) {
        // Create company if it doesn't exist - Requires Admin Client to bypass RLS
        const adminSupabase = createAdminClient()
        const { data: newCompany, error: createError } = await adminSupabase
            .from('companies')
            .insert({
                name: companyData.name,
                proff_url: companyData.url,
                cv_number: companyData.cvr,
                last_known_statement_year: null // Will be populated by the scraper job later
            })
            .select('id')
            .single()

        if (createError) {
            console.error("Error creating company:", createError)
            return { success: false, message: "Failed to track company." }
        }
        companyId = newCompany.id
    }

    // 3. Create subscription
    const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
            user_id: user.id,
            company_id: companyId
        })

    if (subError) {
        if (subError.code === '23505') { // Unique violation
            return { success: true, message: "You are already subscribed to this company." }
        }
        console.error("Subscription error:", subError)
        return { success: false, message: "Failed to subscribe." }
    }

    revalidatePath('/')
    return { success: true }
}

export async function unsubscribeFromCompany(companyId: string): Promise<SubscribeResult> {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { success: false, message: "You must be logged in." }
    }

    const { error } = await supabase
        .from('subscriptions')
        .delete()
        .match({ user_id: user.id, company_id: companyId })

    if (error) {
        console.error("Unsubscribe error:", error)
        return { success: false, message: "Failed to unsubscribe." }
    }

    revalidatePath('/')
    return { success: true }
}

export async function markNotificationAsRead(notificationId: string): Promise<SubscribeResult> {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { success: false, message: "You must be logged in." }
    }

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .match({ id: notificationId, user_id: user.id })

    if (error) {
        console.error("Mark read error:", error)
        return { success: false, message: "Failed to mark as read." }
    }

    revalidatePath('/')
    return { success: true }
}


async function notifySubscribers(companyId: string, companyName: string | undefined, year: number) {
    const adminSupabase = createAdminClient();

    // 1. Get all subscribers
    const { data: subscriptions } = await adminSupabase
        .from('subscriptions')
        .select('user_id')
        .eq('company_id', companyId);

    if (!subscriptions || subscriptions.length === 0) return;

    // 2. Create notifications for each subscriber
    const notifications = subscriptions.map(sub => ({
        user_id: sub.user_id,
        company_id: companyId,
        message: `New financial report (${year}) available for ${companyName || 'a company you follow'}.`,
        read: false
    }));

    const { error } = await adminSupabase
        .from('notifications')
        .insert(notifications);

    if (error) {
        console.error("Failed to create notifications:", error);
    }
}


export async function checkCompanyUpdate(companyId: string, url: string): Promise<SubscribeResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: "Unauthorized" }

    try {
        console.log(`[Manual Check] Checking ${url} for company ${companyId}...`);
        const financialData = await getLatestFinancialYear(url);
        console.log(`[Manual Check] Scraper returned:`, financialData);

        const adminSupabase = createAdminClient();

        if (financialData) {
            const latestYear = financialData.year;

            // Get company name first for the notification
            const { data: company } = await adminSupabase
                .from('companies')
                .select('name, last_known_statement_year')
                .eq('id', companyId)
                .single();

            // Only update and notify if the year is actually new
            if (company && (!company.last_known_statement_year || latestYear > company.last_known_statement_year)) {
                await adminSupabase
                    .from('companies')
                    .update({
                        last_known_statement_year: latestYear,
                        latest_gross_profit: financialData.grossProfit,
                        latest_annual_result: financialData.annualResult,
                        latest_currency: financialData.currency,
                        last_checked_at: new Date().toISOString()
                    })
                    .eq('id', companyId)

                console.log(`[Manual Check] Updated DB with year ${latestYear}`);

                // Notify subscribers
                await notifySubscribers(companyId, company.name, latestYear);

                revalidatePath('/')
                return { success: true, message: `Updated! Latest year: ${latestYear}` }
            } else if (company && latestYear === company.last_known_statement_year) {
                // Year is same, but maybe we want to backfill data if missing?
                // For now, just update checked_at and data if it's the same year (in case we didn't have the numbers before)
                await adminSupabase
                    .from('companies')
                    .update({
                        latest_gross_profit: financialData.grossProfit,
                        latest_annual_result: financialData.annualResult,
                        latest_currency: financialData.currency,
                        last_checked_at: new Date().toISOString()
                    })
                    .eq('id', companyId)
                console.log(`[Manual Check] Year match. Updated details.`);
            } else {
                console.log(`[Manual Check] Year ${latestYear} is not newer than ${company?.last_known_statement_year}`);
            }
        }

        // Even if no new year, update checked_at
        await adminSupabase
            .from('companies')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', companyId)

        revalidatePath('/')
        return { success: true, message: "Checked. No new reports." }

    } catch (e) {
        console.error("Manual check failed:", e)
        return { success: false, message: "Failed to check Proff." }
    }
}

export async function bulkCheckCompanyUpdates(companies: { id: string, url: string }[]): Promise<SubscribeResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: "Unauthorized" }

    try {
        // Process in parallel
        const updates = companies.map(async (company) => {
            const adminSupabase = createAdminClient();
            try {
                const financialData = await getLatestFinancialYear(company.url);

                if (financialData) {
                    const latestYear = financialData.year;

                    // Get current state to compare
                    const { data: currentCompany } = await adminSupabase
                        .from('companies')
                        .select('name, last_known_statement_year')
                        .eq('id', company.id)
                        .single();

                    if (currentCompany && (!currentCompany.last_known_statement_year || latestYear > currentCompany.last_known_statement_year)) {
                        await adminSupabase
                            .from('companies')
                            .update({
                                last_known_statement_year: latestYear,
                                latest_gross_profit: financialData.grossProfit,
                                latest_annual_result: financialData.annualResult,
                                latest_currency: financialData.currency,
                                last_checked_at: new Date().toISOString()
                            })
                            .eq('id', company.id);

                        await notifySubscribers(company.id, currentCompany.name, latestYear);

                        return { id: company.id, success: true };
                    } else if (currentCompany && latestYear === currentCompany.last_known_statement_year) {
                        await adminSupabase
                            .from('companies')
                            .update({
                                latest_gross_profit: financialData.grossProfit,
                                latest_annual_result: financialData.annualResult,
                                latest_currency: financialData.currency,
                                last_checked_at: new Date().toISOString()
                            })
                            .eq('id', company.id);
                    }
                }

                // Update checked_at even if no new year
                await adminSupabase
                    .from('companies')
                    .update({ last_checked_at: new Date().toISOString() })
                    .eq('id', company.id);

                return { id: company.id, success: true };
            } catch (e) {
                console.error(`Bulk update failed for ${company.id}:`, e);
                return { id: company.id, success: false };
            }
        });

        await Promise.all(updates);

        revalidatePath('/')
        return { success: true, message: `Checked ${companies.length} companies.` }

    } catch (e) {
        console.error("Bulk check failed:", e)
        return { success: false, message: "Failed to bulk check." }
    }
}

