"use client"

import * as React from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

type Notification = {
    id: string
    message: string
    read: boolean
    created_at: string
}

import { markNotificationAsRead } from "@/app/actions"

export function NotificationsDropdown({ initialNotifications }: { initialNotifications: Notification[] }) {
    // In a real app, uses a realtime subscription or SWR
    const [notifications, setNotifications] = React.useState(initialNotifications)

    // Sync with prop updates
    React.useEffect(() => {
        setNotifications(initialNotifications)
    }, [initialNotifications])

    const unreadCount = notifications.filter(n => !n.read).length

    const handleRead = async (id: string) => {
        // Optimistic update
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))

        await markNotificationAsRead(id)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px]">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                        No notifications
                    </div>
                ) : (
                    notifications.map((n) => (
                        <DropdownMenuItem
                            key={n.id}
                            className="flex flex-col items-start p-3 gap-1 cursor-pointer"
                            onClick={(e) => {
                                if (!n.read) {
                                    e.preventDefault() // Keep menu open if marking as read
                                    handleRead(n.id)
                                }
                            }}
                        >
                            <div className="flex w-full justify-between items-start">
                                <span className={n.read ? "text-muted-foreground" : "font-medium"}>
                                    {n.message}
                                </span>
                                {!n.read && (
                                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {new Date(n.created_at).toLocaleDateString()}
                            </span>
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
