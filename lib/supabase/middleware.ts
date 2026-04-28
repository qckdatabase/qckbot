import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isClientRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/seo') ||
    request.nextUrl.pathname.startsWith('/ranking') ||
    request.nextUrl.pathname.startsWith('/competitors') ||
    request.nextUrl.pathname.startsWith('/campaigns') ||
    request.nextUrl.pathname.startsWith('/guardrails') ||
    request.nextUrl.pathname.startsWith('/chat')

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/change-password')

  if (!user && (isAdminRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    const { data: userData } = await supabase
      .from('users')
      .select('role, needs_password_change')
      .eq('id', user.id)
      .single()

    if (userData?.needs_password_change) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }

    if (userData?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/clients', request.url))
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
