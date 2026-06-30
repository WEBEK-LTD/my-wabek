declare module 'busboy' {
  import { IncomingHttpHeaders } from 'http'
  import { Writable } from 'stream'

  interface BusboyConfig {
    headers: IncomingHttpHeaders
    limits?: { fileSize?: number; files?: number }
  }

  interface FileInfo {
    filename: string
    encoding: string
    mimeType: string
  }

  interface Busboy extends Writable {
    on(event: 'file', listener: (name: string, stream: NodeJS.ReadableStream, info: FileInfo) => void): this
    on(event: 'field', listener: (name: string, value: string) => void): this
    on(event: 'finish', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: string, listener: (...args: any[]) => void): this
  }

  function busboy(config: BusboyConfig): Busboy
  export default busboy
}
