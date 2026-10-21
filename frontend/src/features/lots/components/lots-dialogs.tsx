import { LotsActionDialog } from './lots-action-dialog'
import { LotsDeleteDialog } from './lots-delete-dialog'
import { useLots } from './lots-provider'

export function LotsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useLots()

  return (
    <>
      <LotsActionDialog key='lot-add' open={open === 'add'} onOpenChange={() => setOpen('add')} />
      {currentRow && (
        <LotsDeleteDialog
          key={`lot-delete-${currentRow.id}`}
          currentRow={currentRow}
          open={open === 'delete'}
          onOpenChange={() => {
            setOpen('delete')
            setTimeout(() => setCurrentRow(null), 500)
          }}
        />
      )}
    </>
  )
}
