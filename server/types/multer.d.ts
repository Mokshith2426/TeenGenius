declare module 'multer' {
  import { Request } from 'express';

  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
    path?: string;
    stream?: any;
    destination?: string;
    filename?: string;
  }

  export interface Multer {
    (options?: any): any;
    single(fieldname: string): any;
    array(fieldname: string, maxCount?: number): any;
    fields(fields: Array<{ name: string; maxCount?: number }>): any;
    none(): any;
    any(): any;
    memoryStorage(): any;
    diskStorage(opts: {
      destination?: string | ((req: Request, file: File, cb: (err: Error | null, destination: string) => void) => void);
      filename?: string | ((req: Request, file: File, cb: (err: Error | null, filename: string) => void) => void);
    }): any;
  }

  const multer: Multer;
  export default multer;
}