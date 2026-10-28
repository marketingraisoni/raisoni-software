import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/services/auth-service'
import {
  getPublicBranding,
  publicBrandingQueryKey,
  resolveBrandingImageUrl,
  uploadLoginBrandingImage,
} from '@/services/branding-service'
import { ImageUp, Loader2, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import DefaultLoginImage from '@/features/auth/sign-in/assets/dashboard-light.webp'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function LoginBrandingSettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [failedImageUrl, setFailedImageUrl] = useState('')

  const brandingQuery = useQuery({
    queryKey: publicBrandingQueryKey,
    queryFn: getPublicBranding,
    staleTime: 30_000,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadLoginBrandingImage(file),
    onSuccess: ({ message, branding }) => {
      queryClient.setQueryData(publicBrandingQueryKey, branding)
      clearSelection()
      toast.success(message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const savedImageUrl = resolveBrandingImageUrl(
    brandingQuery.data?.loginImageUrl || ''
  )
  const customImageUrl = previewUrl || savedImageUrl
  const displayedImage =
    customImageUrl && customImageUrl !== failedImageUrl
      ? customImageUrl
      : DefaultLoginImage
  const hasCustomImage = Boolean(brandingQuery.data?.loginImageUrl)
  const isSaving = uploadMutation.isPending

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function clearSelection() {
    setSelectedFile(null)
    setPreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function selectImage(file?: File) {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Choose a JPG, PNG, or WebP image.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Login image cannot exceed 8 MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  return (
    <Card className='max-w-4xl'>
      <CardHeader>
        <CardTitle>Login Branding</CardTitle>
        <CardDescription>
          Manage the image shown on the right side of the sign-in page.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='overflow-hidden rounded-lg border bg-muted/30'>
          <div className='flex aspect-[16/10] max-h-[460px] items-center justify-center'>
            {brandingQuery.isPending ? (
              <Loader2 className='size-7 animate-spin text-muted-foreground' />
            ) : (
              <img
                src={displayedImage}
                alt='Login page preview'
                className='max-h-full max-w-full object-contain'
                onError={() => {
                  if (previewUrl) clearSelection()
                  else setFailedImageUrl(customImageUrl)
                }}
              />
            )}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <input
            ref={fileInputRef}
            type='file'
            aria-label='Login image file'
            accept='image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={(event) => selectImage(event.target.files?.[0])}
          />
          <Button
            type='button'
            variant='outline'
            disabled={isSaving}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageUp />
            {hasCustomImage ? 'Choose replacement' : 'Choose image'}
          </Button>
          {selectedFile && (
            <>
              <Button
                type='button'
                disabled={isSaving}
                onClick={() => uploadMutation.mutate(selectedFile)}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <Save />
                )}
                Save image
              </Button>
              <Button
                type='button'
                variant='ghost'
                disabled={isSaving}
                onClick={clearSelection}
              >
                <X />
                Cancel
              </Button>
            </>
          )}
        </div>

        <p className='text-sm text-muted-foreground'>
          JPG, PNG, or WebP up to 8 MB. A wide image works best.
        </p>
      </CardContent>
    </Card>
  )
}
