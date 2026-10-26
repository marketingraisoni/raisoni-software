import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import {
  getApiErrorMessage,
  removeCurrentUserPhoto,
  updateCurrentUserProfile,
  uploadCurrentUserPhoto,
} from '@/services/auth-service'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username cannot exceed 30 characters.')
    .regex(/^[a-z0-9._-]+$/, 'Use lowercase letters, numbers, and ._- only.'),
})

type ProfileValues = z.infer<typeof profileSchema>

type CropBox = {
  x: number
  y: number
  size: number
}

type DragType = 'move' | 'nw' | 'ne' | 'se' | 'sw' | null

export function ProfileSettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user, setUser } = useAuthStore((state) => state.auth)

  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name || '',
      username: user?.username || '',
    },
  })

  const profileMutation = useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: ({ message, user: updatedUser }) => {
      setUser(updatedUser)
      toast.success(message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const photoMutation = useMutation({
    mutationFn: uploadCurrentUserPhoto,
    onSuccess: ({ message, user: updatedUser }) => {
      setUser(updatedUser)
      setCropModalOpen(false)
      setSelectedImageSrc(null)
      setSelectedFile(null)
      toast.success(message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const removePhotoMutation = useMutation({
    mutationFn: removeCurrentUserPhoto,
    onSuccess: ({ message, user: updatedUser }) => {
      setUser(updatedUser)
      toast.success(message)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const isPhotoPending =
    photoMutation.isPending || removePhotoMutation.isPending

  const handleSelectFile = (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Profile picture cannot exceed 10 MB.')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const handleApplyCroppedPhoto = (croppedFile: File) => {
    photoMutation.mutate(croppedFile)
  }

  return (
    <>
      <Card className='max-w-3xl'>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your profile picture, name, and username.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
            <Avatar className='size-24 border'>
              <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || ''} />
              <AvatarFallback className='text-xl'>
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className='flex flex-wrap gap-2'>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/jpeg,image/png,image/webp'
                className='hidden'
                onChange={(event) => {
                  handleSelectFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button
                type='button'
                variant='outline'
                disabled={isPhotoPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoMutation.isPending ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <Camera />
                )}
                Change picture
              </Button>
              {user?.avatarUrl && (
                <Button
                  type='button'
                  variant='outline'
                  disabled={isPhotoPending}
                  onClick={() => removePhotoMutation.mutate()}
                >
                  {removePhotoMutation.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Trash2 />
                  )}
                  Remove
                </Button>
              )}
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                profileMutation.mutate(values)
              )}
              className='grid max-w-xl gap-5'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input autoComplete='name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='username'
                        {...field}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value.toLowerCase().replace(/\s+/g, '')
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='grid gap-2'>
                <Label htmlFor='profile-email'>Email</Label>
                <Input id='profile-email' value={user?.email || ''} disabled />
              </div>
              <div>
                <Button type='submit' disabled={profileMutation.isPending}>
                  {profileMutation.isPending && (
                    <Loader2 className='animate-spin' />
                  )}
                  Save profile
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ProfilePhotoCropDialog
        open={cropModalOpen}
        onOpenChange={(open) => {
          if (!open && !photoMutation.isPending) {
            setCropModalOpen(false)
            setSelectedImageSrc(null)
            setSelectedFile(null)
          }
        }}
        imageSrc={selectedImageSrc}
        sourceFile={selectedFile}
        isUploading={photoMutation.isPending}
        onConfirm={handleApplyCroppedPhoto}
      />
    </>
  )
}

interface ProfilePhotoCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string | null
  sourceFile: File | null
  isUploading: boolean
  onConfirm: (croppedFile: File) => void
}

function ProfilePhotoCropDialog({
  open,
  onOpenChange,
  imageSrc,
  sourceFile,
  isUploading,
  onConfirm,
}: ProfilePhotoCropDialogProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const [naturalDimensions, setNaturalDimensions] = useState({
    width: 0,
    height: 0,
  })
  const [renderedSize, setRenderedSize] = useState({
    width: 0,
    height: 0,
  })
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, size: 0 })

  const dragRef = useRef<{
    type: DragType
    startX: number
    startY: number
    initialCrop: CropBox
  }>({
    type: null,
    startX: 0,
    startY: 0,
    initialCrop: { x: 0, y: 0, size: 0 },
  })

  const updateRenderedDimensions = useCallback(() => {
    const img = imageRef.current
    if (img && img.clientWidth > 0 && img.clientHeight > 0) {
      setRenderedSize({
        width: img.clientWidth,
        height: img.clientHeight,
      })
    }
  }, [])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const nw = img.naturalWidth
    const nh = img.naturalHeight

    setNaturalDimensions({ width: nw, height: nh })
    updateRenderedDimensions()

    // 1:1 square crop default centered on the image
    const initialSize = Math.round(Math.min(nw, nh) * 0.85)
    setCrop({
      size: initialSize,
      x: Math.round((nw - initialSize) / 2),
      y: Math.round((nh - initialSize) / 2),
    })
  }

  // Monitor resize of the image to keep screen overlay perfectly mapped
  useEffect(() => {
    const img = imageRef.current
    if (!img) return

    const observer = new ResizeObserver(() => {
      updateRenderedDimensions()
    })
    observer.observe(img)
    return () => observer.disconnect()
  }, [updateRenderedDimensions, imageSrc])

  // Draw 1:1 live preview using exact natural coordinates
  useEffect(() => {
    const img = imageRef.current
    const canvas = previewCanvasRef.current
    if (!img || !canvas || naturalDimensions.width === 0 || crop.size === 0) {
      return
    }

    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, 100, 100)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      100,
      100
    )
  }, [crop, naturalDimensions, imageSrc])

  const startDrag = (e: React.PointerEvent, type: DragType) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...crop },
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const { type, startX, startY, initialCrop } = dragRef.current
    if (!type || renderedSize.width === 0 || naturalDimensions.width === 0) return

    const screenScaleX = naturalDimensions.width / renderedSize.width
    const screenScaleY = naturalDimensions.height / renderedSize.height

    const deltaX = (e.clientX - startX) * screenScaleX
    const deltaY = (e.clientY - startY) * screenScaleY

    const nw = naturalDimensions.width
    const nh = naturalDimensions.height
    const minSize = Math.round(Math.min(nw, nh) * 0.1)

    if (type === 'move') {
      const maxX = nw - initialCrop.size
      const maxY = nh - initialCrop.size
      const newX = Math.max(0, Math.min(maxX, Math.round(initialCrop.x + deltaX)))
      const newY = Math.max(0, Math.min(maxY, Math.round(initialCrop.y + deltaY)))
      setCrop({ ...initialCrop, x: newX, y: newY })
    } else if (type === 'se') {
      const delta = Math.round((deltaX + deltaY) / 2)
      const maxSize = Math.min(nw - initialCrop.x, nh - initialCrop.y)
      const newSize = Math.max(minSize, Math.min(maxSize, initialCrop.size + delta))
      setCrop({ ...initialCrop, size: newSize })
    } else if (type === 'sw') {
      const delta = Math.round((-deltaX + deltaY) / 2)
      const maxSize = Math.min(initialCrop.x + initialCrop.size, nh - initialCrop.y)
      const newSize = Math.max(minSize, Math.min(maxSize, initialCrop.size + delta))
      const newX = initialCrop.x + (initialCrop.size - newSize)
      setCrop({ x: newX, y: initialCrop.y, size: newSize })
    } else if (type === 'ne') {
      const delta = Math.round((deltaX - deltaY) / 2)
      const maxSize = Math.min(nw - initialCrop.x, initialCrop.y + initialCrop.size)
      const newSize = Math.max(minSize, Math.min(maxSize, initialCrop.size + delta))
      const newY = initialCrop.y + (initialCrop.size - newSize)
      setCrop({ x: initialCrop.x, y: newY, size: newSize })
    } else if (type === 'nw') {
      const delta = Math.round((-deltaX - deltaY) / 2)
      const maxSize = Math.min(
        initialCrop.x + initialCrop.size,
        initialCrop.y + initialCrop.size
      )
      const newSize = Math.max(minSize, Math.min(maxSize, initialCrop.size + delta))
      const newX = initialCrop.x + (initialCrop.size - newSize)
      const newY = initialCrop.y + (initialCrop.size - newSize)
      setCrop({ x: newX, y: newY, size: newSize })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.type) {
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      dragRef.current.type = null
    }
  }

  const handleConfirmCrop = () => {
    const img = imageRef.current
    if (!img || !sourceFile || naturalDimensions.width === 0) return

    const canvas = document.createElement('canvas')
    const targetDim = Math.min(crop.size, 800)
    canvas.width = targetDim
    canvas.height = targetDim

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      targetDim,
      targetDim
    )

    const outputMime =
      sourceFile.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const extension = outputMime === 'image/png' ? '.png' : '.jpg'
    const fileName = sourceFile.name.replace(/\.[^/.]+$/, '') + extension

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Failed to crop image.')
          return
        }
        const croppedFile = new File([blob], fileName, { type: outputMime })
        onConfirm(croppedFile)
      },
      outputMime,
      0.92
    )
  }

  const screenRatioX =
    naturalDimensions.width > 0 ? renderedSize.width / naturalDimensions.width : 0
  const screenRatioY =
    naturalDimensions.height > 0 ? renderedSize.height / naturalDimensions.height : 0

  const boxLeft = crop.x * screenRatioX
  const boxTop = crop.y * screenRatioY
  const boxWidth = crop.size * screenRatioX
  const boxHeight = crop.size * screenRatioY

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>Crop Profile Picture</DialogTitle>
          <DialogDescription>
            Drag and resize the 1:1 box to frame your picture.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Cropper Container */}
          <div className='flex items-center justify-center overflow-hidden rounded-md border bg-muted/20 p-2'>
            {imageSrc && (
              <div
                className='relative inline-block touch-none select-none overflow-hidden'
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt='Crop preview'
                  onLoad={handleImageLoad}
                  className='block max-h-[320px] max-w-full select-none'
                  draggable={false}
                />

                {renderedSize.width > 0 && crop.size > 0 && (
                  <div
                    className='absolute cursor-move border-2 border-primary touch-none select-none'
                    style={{
                      left: `${boxLeft}px`,
                      top: `${boxTop}px`,
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                    }}
                    onPointerDown={(e) => startDrag(e, 'move')}
                  >
                    {/* Circular guide */}
                    <div className='pointer-events-none absolute inset-0 rounded-full border border-dashed border-white/70' />

                    {/* 3x3 Grid */}
                    <div className='pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3'>
                      <div className='border-r border-b border-white/20' />
                      <div className='border-r border-b border-white/20' />
                      <div className='border-b border-white/20' />
                      <div className='border-r border-b border-white/20' />
                      <div className='border-r border-b border-white/20' />
                      <div className='border-b border-white/20' />
                      <div className='border-r border-b border-white/20' />
                      <div className='border-r border-b border-white/20' />
                      <div />
                    </div>

                    {/* Corner Handles */}
                    <div
                      className='absolute -top-1.5 -left-1.5 size-3 cursor-nwse-resize rounded-full border-2 border-primary bg-background shadow-xs'
                      onPointerDown={(e) => startDrag(e, 'nw')}
                    />
                    <div
                      className='absolute -top-1.5 -right-1.5 size-3 cursor-nesw-resize rounded-full border-2 border-primary bg-background shadow-xs'
                      onPointerDown={(e) => startDrag(e, 'ne')}
                    />
                    <div
                      className='absolute -bottom-1.5 -left-1.5 size-3 cursor-nesw-resize rounded-full border-2 border-primary bg-background shadow-xs'
                      onPointerDown={(e) => startDrag(e, 'sw')}
                    />
                    <div
                      className='absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-full border-2 border-primary bg-background shadow-xs'
                      onPointerDown={(e) => startDrag(e, 'se')}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Existing Theme Avatar Preview */}
          <div className='flex items-center gap-3 px-1'>
            <span className='text-sm text-muted-foreground'>Preview:</span>
            <Avatar className='size-14 border'>
              <canvas
                ref={previewCanvasRef}
                className='size-full object-cover'
              />
            </Avatar>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type='button'
            disabled={isUploading}
            onClick={handleConfirmCrop}
          >
            {isUploading && <Loader2 className='animate-spin' />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getInitials(name?: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'RU'
  )
}
