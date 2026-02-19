import { SubscribeResult } from "./actions"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
