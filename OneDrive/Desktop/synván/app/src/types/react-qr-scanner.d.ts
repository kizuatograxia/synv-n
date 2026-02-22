declare module 'react-qr-scanner' {
  import { ComponentType } from 'react'

  export interface QrScannerProps {
    onScan: (data: string | null) => void
    constraints?: MediaTrackConstraints
  }

  export const QrScanner: ComponentType<QrScannerProps>
}
