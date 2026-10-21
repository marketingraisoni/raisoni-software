import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { downloadLotAssortmentExcel } from '@/services/lots-service'
import { Button } from '@/components/ui/button'

type Props = {
  lotId: string
  kapanNo: string
  compact?: boolean
}

export function AssortmentExcelButton({ lotId, kapanNo, compact = false }: Props) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadLotAssortmentExcel(lotId, kapanNo)
      toast.success(`Lot ${kapanNo} Excel downloaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download the Excel file.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button
      type='button'
      size='sm'
      variant='outline'
      disabled={isDownloading}
      onClick={() => void handleDownload()}
      aria-label={`Download Lot ${kapanNo} packet assortment Excel`}
    >
      {isDownloading ? <Loader2 className='animate-spin' /> : <Download />}
      {compact ? 'Excel' : 'Download Excel'}
    </Button>
  )
}
