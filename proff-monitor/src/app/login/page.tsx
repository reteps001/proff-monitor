import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default function Login({
    searchParams,
}: {
    searchParams: { message: string }
}) {
    const signIn = async (formData: FormData) => {
        "use server"

        const email = formData.get("email") as string
        const password = formData.get("password") as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return redirect("/login?message=Could not authenticate user")
        }

        return redirect("/")
    }

    const signUp = async (formData: FormData) => {
        "use server"

        const origin = (await headers()).get("origin")
        const email = formData.get("email") as string
        const password = formData.get("password") as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${origin}/auth/callback`,
            },
        })

        if (error) {
            console.error(error)
            return redirect("/login?message=Could not authenticate user")
        }

        return redirect("/login?message=Check email to continue sign in process")
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-background">
            <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
                <div className="flex flex-col items-center justify-center text-center">
                    <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
                        Sign in to your account
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Or sign up to start tracking companies
                    </p>
                </div>

                <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground animate-in flex-1 flex-col w-full justify-center gap-2 text-foreground">
                    <label className="text-md" htmlFor="email">
                        Email
                    </label>
                    <Input
                        className="rounded-md px-4 py-2 bg-inherit border mb-2"
                        name="email"
                        placeholder="you@example.com"
                        required
                    />
                    <label className="text-md" htmlFor="password">
                        Password
                    </label>
                    <Input
                        className="rounded-md px-4 py-2 bg-inherit border mb-2"
                        type="password"
                        name="password"
                        placeholder="••••••••"
                        required
                    />
                    <Button formAction={signIn} className="bg-primary text-primary-foreground mb-2">
                        Sign In
                    </Button>
                    <Button
                        formAction={signUp}
                        variant="outline"
                        className="border-foreground/20 text-foreground mb-2"
                    >
                        Sign Up
                    </Button>

                    {searchParams?.message && (
                        <p className="mt-4 p-4 bg-foreground/10 text-foreground text-center text-sm rounded-md">
                            {searchParams.message}
                        </p>
                    )}
                </form>
            </div>
        </div>
    )
}
