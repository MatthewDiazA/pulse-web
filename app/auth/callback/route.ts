import { NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

**What this does:** When Supabase sends the user to `/auth/callback?code=abc123`, this file catches that request, takes the code, exchanges it with Supabase for a real login session, then redirects the user to the home page — all in under a second. The user never even sees this page, it just handles the handoff invisibly.

Now you need to tell Supabase to use this URL. Go to [supabase.com](https://supabase.com) → your project → **Authentication** → **URL Configuration** and set the **Site URL** to your Vercel URL:
```
https://pulse-one-hazel.vercel.app
```

And add this to **Redirect URLs**:
```
https://pulse-one-hazel.vercel.app/auth/callback