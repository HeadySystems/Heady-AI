declare module 'winston' {
  interface Logger {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
  }

  interface FormatWrap {
    (): any;
    (opts: any): any;
  }

  interface Format {
    combine(...formats: any[]): any;
    timestamp(): any;
    errors(opts?: any): any;
    json(): any;
    colorize(): any;
    simple(): any;
  }

  interface Transports {
    Console: new (opts?: any) => any;
    File: new (opts?: any) => any;
  }

  const format: Format;
  const transports: Transports;
  function createLogger(opts: any): Logger;

  export { Logger, Format, Transports, format, transports, createLogger };
  export default { format, transports, createLogger };
}
