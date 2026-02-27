"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink, RefreshCw, Trash2, Loader2, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { unsubscribeFromCompany, checkCompanyUpdate, bulkCheckCompanyUpdates, updateSubscriptionOrder } from "@/app/actions"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DotFlow, DotFlowProps } from "@/components/ui/dot-flow"
import { GripVertical } from "lucide-react"

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'

type Subscription = {
    id: string
    sort_order: number
    companies: {
        id: string
        name: string
        proff_url: string
        last_known_statement_year: number | null
        last_checked_at: string | null
        latest_gross_profit: number | null
        latest_annual_result: number | null
        latest_currency: string | null
    }
}

// 7x7 Grid Indices Helper:
// 0  1  2  3  4  5  6
// 7  8  9  10 11 12 13
// ...
// 42 43 44 45 46 47 48

const searchingFrames = [
    // Magnifying glass moving
    [10, 11, 12, 17, 19, 24, 25, 26, 32, 40], // Frame 1
    [11, 12, 13, 18, 20, 25, 26, 27, 33, 41], // Right
    [18, 19, 20, 25, 27, 32, 33, 34, 40, 48], // Down Right
    [17, 18, 19, 24, 26, 31, 32, 33, 39, 47], // Left
    [16, 17, 18, 23, 25, 30, 31, 32, 38, 46], // Left
    [9, 10, 11, 16, 18, 23, 24, 25, 31, 39], // Up Left
    [10, 11, 12, 17, 19, 24, 25, 26, 32, 40], // Center
    [10, 11, 12, 17, 19, 24, 25, 26, 32, 40], // Center pause
    [10, 11, 12, 17, 19, 24, 25, 26, 32, 40], // Center pause
    [10, 11, 12, 17, 19, 24, 25, 26, 32, 40],
    [10, 11, 12, 17, 19, 24, 25, 26, 32, 40],
];

const scanningFrames = [
    // Scan line down and text/code appearing
    [0, 1, 2, 3, 4, 5, 6], // Row 0
    [7, 8, 9, 10, 11, 12, 13], // Row 1
    [14, 15, 16, 17, 18, 19, 20], // Row 2
    [21, 22, 23, 24, 25, 26, 27], // Row 3
    [28, 29, 30, 31, 32, 33, 34], // Row 4
    [35, 36, 37, 38, 39, 40, 41], // Row 5
    [42, 43, 44, 45, 46, 47, 48], // Row 6
    [35, 36, 37, 38, 39, 40, 41], // Up
    [28, 29, 30, 31, 32, 33, 34], // Up
    [21, 22, 23, 24, 25, 26, 27], // Up
    [14, 15, 16, 17, 18, 19, 20], // Up
];

const analyzingFrames = [
    // Pulsing brain/network
    [24], // Center
    [24, 17, 23, 25, 31], // +
    [24, 17, 23, 25, 31, 10, 12, 22, 26, 36, 38], // X outer
    [24, 16, 17, 18, 23, 25, 30, 31, 32], // 3x3 Block
    [24, 8, 9, 10, 11, 12, 15, 20, 22, 26, 29, 34, 36, 37, 38, 39, 40], // Box ring
    [0, 6, 42, 48, 24], // Corners + Center
    [0, 1, 2, 3, 4, 5, 6, 42, 43, 44, 45, 46, 47, 48, 24], // Top/Bot rows + Center
    [24, 16, 17, 18, 23, 25, 30, 31, 32], // 3x3 Block
    [24, 17, 23, 25, 31, 10, 12, 22, 26, 36, 38], // X outer
    [24, 17, 23, 25, 31], // +
    [24], // Center
];

const updatingFrames = [
    // Spinner / Circular
    [3, 11, 19, 27, 35, 43, 44, 45, 46, 47, 48], // Right side & Bottom
    [45, 37, 29, 21, 13, 5, 4, 3, 2, 1, 0], // Left side & Top
    [3, 11, 19, 27, 35, 43, 44, 45, 46, 47, 48],
    [45, 37, 29, 21, 13, 5, 4, 3, 2, 1, 0],
    [3, 11, 19, 27, 35, 43, 44, 45, 46, 47, 48],
    [45, 37, 29, 21, 13, 5, 4, 3, 2, 1, 0],
    [3, 11, 19, 27, 35, 43, 44, 45, 46, 47, 48],
    [45, 37, 29, 21, 13, 5, 4, 3, 2, 1, 0],
    [3, 11, 19, 27, 35, 43, 44, 45, 46, 47, 48],
    [45, 37, 29, 21, 13, 5, 4, 3, 2, 1, 0],
    [24], // End
];

const formatCurrency = (amount: number, currency: string = 'DKK') => {
    return new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
    }).format(amount);
};

export function SubscriptionList({ subscriptions: initialSubscriptions }: { subscriptions: Subscription[] }) {
    const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [refreshingId, setRefreshingId] = useState<string | null>(null)
    const [isBulkRefreshing, setIsBulkRefreshing] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const router = useRouter()

    useEffect(() => {
        setSubscriptions(initialSubscriptions)
    }, [initialSubscriptions])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = subscriptions.findIndex((s) => s.id === active.id)
            const newIndex = subscriptions.findIndex((s) => s.id === over.id)

            const newOrderedSubscriptions = arrayMove(subscriptions, oldIndex, newIndex)
            setSubscriptions(newOrderedSubscriptions)

            // Persist to DB
            const orderedIds = newOrderedSubscriptions.map(s => s.id)
            try {
                await updateSubscriptionOrder(orderedIds)
            } catch (e) {
                console.error("Failed to update order in DB", e)
                // Optionally revert state if it fails
                setSubscriptions(subscriptions)
            }
        }
    }

    if (subscriptions.length === 0) return null

    const handleUnsubscribe = async (companyId: string) => {
        if (!confirm("Are you sure you want to stop tracking this company?")) return

        setDeletingId(companyId)
        try {
            await unsubscribeFromCompany(companyId)
            router.refresh()
        } catch (e) {
            console.error("Failed to delete", e)
            alert("Failed to delete")
        } finally {
            setDeletingId(null)
        }
    }

    const handleRefresh = async (companyId: string, url: string) => {
        setRefreshingId(companyId)
        try {
            await Promise.all([
                checkCompanyUpdate(companyId, url),
                new Promise(resolve => setTimeout(resolve, 8000))
            ])
            router.refresh()
        } catch (e) {
            console.error(e)
        } finally {
            setRefreshingId(null)
        }
    }

    const toggleSelection = (companyId: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(companyId)) {
            newSelected.delete(companyId)
        } else {
            newSelected.add(companyId)
        }
        setSelectedIds(newSelected)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === subscriptions.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(subscriptions.map(s => s.companies.id)))
        }
    }

    const handleBulkRefresh = async (subsetIds?: Set<string>) => {
        const idsToRefresh = subsetIds ? Array.from(subsetIds) : subscriptions.map(s => s.companies.id)
        if (idsToRefresh.length === 0) return

        setIsBulkRefreshing(true)

        // Find urls for these ids
        const companiesToUpdate = subscriptions
            .filter(s => idsToRefresh.includes(s.companies.id))
            .map(s => ({ id: s.companies.id, url: s.companies.proff_url }))

        try {
            await Promise.all([
                bulkCheckCompanyUpdates(companiesToUpdate),
                new Promise(resolve => setTimeout(resolve, 8000))
            ])
            router.refresh()
            // Clear selection after successful bulk refresh
            if (subsetIds) setSelectedIds(new Set())
        } catch (e) {
            console.error("Bulk refresh failed", e)
        } finally {
            setIsBulkRefreshing(false)
        }
    }

    const checkingItems: DotFlowProps["items"] = [
        {
            title: "Checking...",
            frames: searchingFrames,
            repeatCount: 1,
            duration: 180,
        },
        {
            title: "Scanning...",
            frames: scanningFrames,
            repeatCount: 1,
            duration: 180,
        },
        {
            title: "Analyzing...",
            frames: analyzingFrames,
            repeatCount: 1,
            duration: 180,
        },
        {
            title: "Updating...",
            frames: updatingFrames,
            repeatCount: 1,
            duration: 180,
        },
    ];

    return (
        <div className="w-full max-w-4xl mt-16 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">Your Watchlist</h2>

                <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-lg border border-white/5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="text-xs h-8 px-2"
                    >
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                        {selectedIds.size === subscriptions.length ? "Deselect All" : "Select All"}
                    </Button>

                    <div className="w-px h-4 bg-white/10 mx-1" />

                    {selectedIds.size > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleBulkRefresh(selectedIds)}
                            disabled={isBulkRefreshing}
                            className="text-xs h-8"
                        >
                            {isBulkRefreshing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                            Refresh Selected ({selectedIds.size})
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkRefresh()}
                        disabled={isBulkRefreshing}
                        className="text-xs h-8 hover:bg-zinc-800"
                    >
                        {isBulkRefreshing && selectedIds.size === 0 ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                        Refresh All
                    </Button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToWindowEdges]}
            >
                <SortableContext
                    items={subscriptions.map(s => s.id)}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subscriptions.map((sub) => (
                            <SortableCompanyCard
                                key={sub.id}
                                sub={sub}
                                isRefreshing={refreshingId === sub.companies.id || (isBulkRefreshing && (selectedIds.size === 0 || selectedIds.has(sub.companies.id)))}
                                isSelected={selectedIds.has(sub.companies.id)}
                                isDeleting={deletingId === sub.companies.id}
                                onToggleSelection={() => toggleSelection(sub.companies.id)}
                                onRefresh={() => handleRefresh(sub.companies.id, sub.companies.proff_url)}
                                onUnsubscribe={() => handleUnsubscribe(sub.companies.id)}
                                checkingItems={checkingItems}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}

function SortableCompanyCard({
    sub,
    isRefreshing,
    isSelected,
    isDeleting,
    onToggleSelection,
    onRefresh,
    onUnsubscribe,
    checkingItems
}: {
    sub: Subscription,
    isRefreshing: boolean,
    isSelected: boolean,
    isDeleting: boolean,
    onToggleSelection: () => void,
    onRefresh: () => void,
    onUnsubscribe: () => void,
    checkingItems: DotFlowProps["items"]
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sub.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : 1,
    }

    return (
        <Card
            ref={setNodeRef}
            style={style}
            className={`bg-zinc-900/50 border-zinc-800 bg-card group relative transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''} ${isDragging ? 'opacity-50 cursor-grabbing shadow-2xl' : ''}`}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-4 right-4 z-10 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-all"
            >
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Checkbox Overlay */}
            <div className="absolute top-4 left-4 z-10">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggleSelection}
                    className="data-[state=checked]:bg-primary border-white/20 data-[state=checked]:border-primary"
                />
            </div>

            <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-12">
                <h3 className="text-sm font-medium truncate flex-1 mr-2 text-left" title={sub.companies.name}>
                    {sub.companies.name}
                </h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        disabled={isRefreshing}
                        onClick={onRefresh}
                    >
                        {isRefreshing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={isDeleting}
                        onClick={onUnsubscribe}
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
            <CardContent>
                <div className="text-2xl font-bold min-h-[60px] flex flex-col justify-center">
                    {isRefreshing ? (
                        <DotFlow items={checkingItems} />
                    ) : sub.companies.last_known_statement_year ? (
                        <>
                            <span>{sub.companies.last_known_statement_year}</span>
                            {sub.companies.latest_gross_profit && (
                                <span className="text-xs font-normal mt-1 text-muted-foreground">
                                    Gross Profit: {formatCurrency(sub.companies.latest_gross_profit, sub.companies.latest_currency || 'DKK')}
                                </span>
                            )}
                            {sub.companies.latest_annual_result && (
                                <span className={`text-xs font-normal ${sub.companies.latest_gross_profit ? '' : 'mt-1'} ${sub.companies.latest_annual_result >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    Result: {formatCurrency(sub.companies.latest_annual_result, sub.companies.latest_currency || 'DKK')}
                                </span>
                            )}
                        </>
                    ) : sub.companies.last_checked_at ? (
                        <span className="text-lg text-muted-foreground font-normal">No reports yet</span>
                    ) : (
                        <DotFlow items={checkingItems} />
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                    Year of last statement
                </p>

                <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {sub.companies.last_checked_at
                            ? new Date(sub.companies.last_checked_at).toLocaleDateString('da-DK', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            })
                            : "Pending"
                        }
                    </span>
                    <a href={sub.companies.proff_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                        View on Proff <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </CardContent>
        </Card>
    )
}
