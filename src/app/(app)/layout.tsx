import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <Sidebar userName={user.name} userEmail={user.email} />
        <main className="lg:pl-64 pt-14 lg:pt-0">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
