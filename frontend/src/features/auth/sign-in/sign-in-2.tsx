import { useSearch } from '@tanstack/react-router'
import { Logo } from '@/assets/logo'
import { cn } from '@/lib/utils'
import DashboardImg from './assets/dashboard-light.webp'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn2() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  return (
    <div className='relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='lg:p-8 border border-secondary max-w-max mx-auto bg-secondary rounded-md'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8'>
          <div className='mb-4 flex flex-col items-center justify-center gap-2'>
            <Logo width={128} height={128} />
            <h1 className='text-xl font-medium'>Raisoni ERP</h1>
          </div>
        </div>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2'>
          <div className='flex flex-col space-y-2 text-start'>
            <h2 className='text-lg font-semibold tracking-tight'>Sign in</h2>
            <p className='text-sm text-muted-foreground'>
              Enter your Raisoni account credentials to continue.
            </p>
          </div>
          <UserAuthForm redirectTo={redirect} />
        </div>
      </div>

      <div
        className={cn(
          'relative h-full overflow-hidden flex items-center justify-center bg-muted max-lg:hidden',
          // '[&>img]:absolute [&>img]:top-[15%] [&>img]:left-20 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:object-top-left [&>img]:select-none'
        )}
      >
        <img
          src={DashboardImg}
          width={800}
          height={800}
          alt='Raisoni ERP dashboard'
        />
      </div>
    </div>
  )
}
