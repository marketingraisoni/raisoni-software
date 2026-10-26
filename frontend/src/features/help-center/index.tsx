import { useQuery } from '@tanstack/react-query'
import {
  getSupportContacts,
  supportContactsQueryKey,
} from '@/services/support-service'
import { Mail, Phone, ShieldCheck, Wrench } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'

export function HelpCenterPage() {
  const { data, isLoading } = useQuery({
    queryKey: supportContactsQueryKey,
    queryFn: getSupportContacts,
  })

  return (
    <>
      <AppHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Help Center
          </h1>
          <p className='text-muted-foreground'>
            Contact the right team when you need assistance.
          </p>
        </div>
        {isLoading || !data ? (
          <p className='text-sm text-muted-foreground'>
            Loading contact details...
          </p>
        ) : (
          <div className='grid max-w-4xl gap-5 md:grid-cols-2'>
            <ContactCard
              icon={ShieldCheck}
              title='Administrator'
              description='Account access, permissions, and operational assistance.'
              name={data.administratorName}
              email={data.administratorEmail}
              phone={data.administratorPhone}
            />
            <ContactCard
              icon={Wrench}
              title='Software department'
              description='Technical errors, software updates, installation, and device support.'
              name={data.softwareDepartmentName}
              email={data.softwareDepartmentEmail}
              phone={data.softwareDepartmentPhone}
            />
          </div>
        )}
      </Main>
    </>
  )
}

function ContactCard({
  icon: Icon,
  title,
  description,
  name,
  email,
  phone,
}: {
  icon: typeof ShieldCheck
  title: string
  description: string
  name: string
  email: string
  phone: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className='mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
          <Icon />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <p className='font-medium'>{name}</p>
        <ContactLink icon={Mail} href={`mailto:${email}`} label={email} />
        {phone ? (
          <ContactLink
            icon={Phone}
            href={`tel:${phone.replace(/\s+/g, '')}`}
            label={phone}
          />
        ) : (
          <div className='flex items-center gap-3 text-sm text-muted-foreground'>
            <Phone className='size-4' />
            Mobile number not configured
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ContactLink({
  icon: Icon,
  href,
  label,
}: {
  icon: typeof Mail
  href: string
  label: string
}) {
  return (
    <a
      className='flex items-center gap-3 text-sm text-primary hover:underline'
      href={href}
    >
      <Icon className='size-4' />
      {label}
    </a>
  )
}
