import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/services/auth-service'
import { deleteLot, lotsQueryKey } from '@/services/lots-service'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type Lot } from '../data/schema'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Lot
}

export function LotsDeleteDialog({ open, onOpenChange, currentRow }: Props) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteLot(currentRow.id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: lotsQueryKey })
      toast.success(response.message)
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(state) => !mutation.isPending && onOpenChange(state)}
      handleConfirm={() => mutation.mutate()}
      isLoading={mutation.isPending}
      title={<span className='text-destructive'><AlertTriangle className='me-1 inline-block' size={18} /> Delete Lot</span>}
      desc={<>Delete lot <strong>{currentRow.kapanNo}</strong>? It will be removed from the list, and this Kapan No can be created again.</>}
      confirmText='Delete'
      destructive
    />
  )
}
