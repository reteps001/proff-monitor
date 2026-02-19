"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useDebounce } from "@/hooks/use-debounce" // We need to create this hook or implement inline
import { subscribeToCompany } from "../app/actions"
// We'll implement a simple debounce inside component for now to avoid extra files if not needed globally yet

type CompanyResult = {
    name: string
    url: string
    cvr?: string
}

export function CompanySearch() {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<CompanyResult[]>([])
    const [loading, setLoading] = React.useState(false)
    const [subscribing, setSubscribing] = React.useState<string | null>(null) // URL of company being subscribed to

    // Debounce logic
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                setLoading(true)
                fetch(`/api/search?q=${encodeURIComponent(query)}`)
                    .then((res) => res.json())
                    .then((data) => {
                        if (data.results) {
                            setResults(data.results)
                        }
                    })
                    .catch((err) => console.error(err))
                    .finally(() => setLoading(false))
            } else {
                setResults([])
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [query])

    const handleSelect = async (company: CompanyResult) => {
        setSubscribing(company.url)
        try {
            const result = await subscribeToCompany(company)
            if (result.success) {
                setOpen(false)
                setQuery("")
                // In a real app we'd show a toast here
                console.log("Subscribed!", result.message)
            } else {
                alert(result.message)
            }
        } catch (e) {
            console.error(e)
            alert("An error occurred")
        } finally {
            setSubscribing(null)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full max-w-md justify-between h-12 text-base px-4 bg-background/50 backdrop-blur-sm border-zinc-200 dark:border-zinc-800"
                >
                    {query ? query : "Search companies to watch..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Type company name..."
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && (
                            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching Proff...
                            </div>
                        )}
                        {!loading && results.length === 0 && query.length >= 2 && (
                            <CommandEmpty>No companies found.</CommandEmpty>
                        )}
                        {!loading && results.length === 0 && query.length < 2 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Type at least 2 characters
                            </div>
                        )}

                        <CommandGroup>
                            {results.map((company) => (
                                <CommandItem
                                    key={company.url}
                                    value={company.name} // This value is used for internal cmdk filtering if we enabled it, but we disable filter
                                    onSelect={() => handleSelect(company)}
                                    className="flex items-center justify-between py-3 cursor-pointer"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{company.name}</span>
                                        {company.cvr && <span className="text-xs text-muted-foreground">CVR: {company.cvr}</span>}
                                    </div>
                                    {subscribing === company.url ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 opacity-50" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {query.startsWith('http') && (
                            <CommandGroup heading="Manual Entry">
                                <CommandItem
                                    value={query}
                                    onSelect={() => handleSelect({ name: 'Custom URL', url: query, cvr: undefined })}
                                    className="cursor-pointer"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">Add via URL</span>
                                        <span className="text-xs text-muted-foreground">{query}</span>
                                    </div>
                                    <Plus className="h-4 w-4 opacity-50 ml-auto" />
                                </CommandItem>
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
