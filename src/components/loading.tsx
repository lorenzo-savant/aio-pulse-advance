import { Loader2 } from 'lucide-react'

export default function ApiLoading() {
  return (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="text-brand-400 h-6 w-6 animate-spin" />
    </div>
  )
}
