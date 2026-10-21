import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Lot } from '../data/schema'

type LotsDialogType = 'add' | 'delete'

type LotsContextType = {
  open: LotsDialogType | null
  setOpen: (value: LotsDialogType | null) => void
  currentRow: Lot | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Lot | null>>
}

const LotsContext = React.createContext<LotsContextType | null>(null)

export function LotsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<LotsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Lot | null>(null)

  return (
    <LotsContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </LotsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLots() {
  const context = React.useContext(LotsContext)
  if (!context) throw new Error('useLots has to be used within <LotsProvider>')
  return context
}
