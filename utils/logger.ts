export class Logger {
  static log(message: string, data?: any) {
    console.log(message, data);
  }

  static error(message: string, error?: any) {
    console.error(message, error);
  }

  static warn(message: string, warning?: any) {
    console.warn(message, warning);
  }

  static info(message: string, info?: any) {
    console.info(message, info);
  }
}