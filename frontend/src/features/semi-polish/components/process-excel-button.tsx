import { useState } from 'react'
import { downloadSemiPolishExcel } from '@/services/semi-polish-service'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Props = {
  processId: string
  issueNo: string
}

export function ProcessExcelButton({ processId, issueNo }: Props) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadSemiPolishExcel(processId, issueNo)
      toast.success(`${issueNo} Excel downloaded`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to download the process Excel file.'
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button
      type='button'
      variant='outline'
      disabled={isDownloading}
      onClick={() => void handleDownload()}
      aria-label={`Download ${issueNo} process record Excel`}
    >
      {isDownloading ? (
        <Loader2 className='animate-spin' />
      ) : (
        <FileSpreadsheet />
      )}
      Download Excel
    </Button>
  )
}
