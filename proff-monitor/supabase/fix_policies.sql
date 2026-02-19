-- Allow authenticated users to insert new companies (when they search and add one)
create policy "Authenticated users can insert companies" on public.companies
  for insert with check (auth.role() = 'authenticated');

-- Subscriptions insert policy was already there ("Users can insert own subscriptions")
-- But let's verify if we need update (for cron? no cron uses service role)

-- Notification policies
-- "Users can view own notifications" exists
-- Note: Service Role (cron) bypasses RLS, so we don't need policies for the cron job to insert notifications.

-- Just in case, let's ensure companies update policy exists if we ever want users to update them (unlikely for now)
-- The cron job updates companies using service role, so no RLS needed there.
