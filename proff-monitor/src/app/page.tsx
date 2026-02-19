import { Button } from "@/components/ui/button"
import { CompanySearch } from "@/components/company-search"
import { createClient } from "@/lib/supabase/server"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { SubscriptionList } from "@/components/subscription-list"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let subscriptions: any[] = []
  let notifications: any[] = []

  if (user) {
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select(`
            id,
            companies (
                id,
                name,
                proff_url,
                last_known_statement_year,
                last_checked_at,
                latest_gross_profit,
                latest_annual_result,
                latest_currency
            )
        `)
      .eq('user_id', user.id)

    if (error) {
      console.error("Error fetching subscriptions:", error)
    }

    if (subs) subscriptions = subs

    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (notifs) notifications = notifs
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-8 md:p-24 bg-transparent text-foreground">
      <div className="z-10 w-full max-w-5xl flex items-center justify-between font-mono text-sm">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-playfair)] font-bold text-2xl tracking-tight">Finn<sup className="text-[8px] ml-0.5 align-super">TM</sup></span>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <NotificationsDropdown initialNotifications={notifications} />
              <form action={async () => {
                'use server'
                const sb = await createClient()
                await sb.auth.signOut()
              }}>
                <Button variant="outline" size="sm">Sign Out</Button>
              </form>
            </>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <a href="/login">Sign In</a>
            </Button>
          )}
        </div>
      </div>

      <div className="z-10 mt-16 flex flex-col items-center gap-6 text-center w-full">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
          Accounting Season? We got you
        </h1>
        <p className="text-lg text-muted-foreground max-w-[600px]">
          Get notified instantly when Danish companies publish their annual reports on Proff.dk.
        </p>

        <div className="flex w-full items-center justify-center mt-8">
          <CompanySearch />
        </div>

        {user && (
          <SubscriptionList subscriptions={subscriptions} />
        )}
      </div>
    </div>
  )
}
