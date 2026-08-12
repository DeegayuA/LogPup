'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { removeOwnAvatar, uploadOwnAvatar } from '@/features/auth/avatar-actions'

const OUTPUT_SIZE = 512

/**
 * Center-crops to a square and re-encodes at 512px WebP in the browser, so a
 * 6MB phone photo leaves as ~40KB. Keeps uploads well under both the server
 * action body limit and Vercel's request cap, and normalizes every avatar to
 * one format regardless of what the user picked.
 */
async function toSquareWebp(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  )
  if (!blob) throw new Error('Could not read that image')
  return new File([blob], 'avatar.webp', { type: 'image/webp' })
}

export function AvatarUpload({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<string | null>(null)

  const shown = preview ?? avatarUrl
  const initials = name.slice(0, 1).toUpperCase()

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file')
      return
    }
    startTransition(async () => {
      let resized: File
      try {
        resized = await toSquareWebp(file)
      } catch {
        toast.error('Could not read that image — try a PNG or JPEG')
        return
      }

      // Local preview so the new picture appears before the round trip; it is
      // dropped once the server value arrives. That arrival needs no
      // `router.refresh()`: `uploadOwnAvatar` revalidates `/profile` (and
      // `/people`, and the root layout the header avatar sits in), and Next
      // returns the re-rendered payload for this route in the action's own
      // response — the refresh that used to be here was a second render of a
      // page the server had already re-rendered.
      const objectUrl = URL.createObjectURL(resized)
      setPreview(objectUrl)

      try {
        const body = new FormData()
        body.append('avatar', resized)
        const res = await uploadOwnAvatar(body)
        if (!res.ok) {
          toast.error(res.error)
          setPreview(null)
          URL.revokeObjectURL(objectUrl)
          return
        }
        toast.success('Profile picture updated')
      } catch {
        toast.error('Something went wrong — try again')
        setPreview(null)
        URL.revokeObjectURL(objectUrl)
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        const res = await removeOwnAvatar()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setPreview(null)
        toast.success('Profile picture removed')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" className="size-14!">
        {shown ? <AvatarImage src={shown} alt="" /> : null}
        <AvatarFallback className="font-heading text-lg font-semibold">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              // Reset first so picking the same file twice still fires change.
              event.target.value = ''
              if (file) handleFile(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {avatarUrl ? 'Change picture' : 'Upload picture'}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleRemove}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Square crop, resized to 512px. Signing in with Google keeps this in sync until you
          upload your own.
        </p>
      </div>
    </div>
  )
}
