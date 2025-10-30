import chalk from "chalk";

/**
 * Logger utility for consistent, colored console output
 */
export class Logger {
  /**
   * Log a success message
   */
  static success(message: string): void {
    console.log(chalk.green("✓"), message);
  }

  /**
   * Log an error message
   */
  static error(message: string): void {
    console.log(chalk.red("✗"), message);
  }

  /**
   * Log a warning message
   */
  static warning(message: string): void {
    console.log(chalk.yellow("⚠"), message);
  }

  /**
   * Log an info message
   */
  static info(message: string): void {
    console.log(chalk.blue("ℹ"), message);
  }

  /**
   * Log a step/progress message
   */
  static step(message: string): void {
    console.log(chalk.cyan("→"), message);
  }

  /**
   * Log a header message
   */
  static header(message: string): void {
    console.log();
    console.log(chalk.bold.cyan(message));
    console.log();
  }

  /**
   * Log plain text without formatting
   */
  static log(message: string): void {
    console.log(message);
  }

  /**
   * Log an empty line
   */
  static newline(): void {
    console.log();
  }

  /**
   * Log a list item
   */
  static listItem(message: string, indent: number = 0): void {
    const indentation = "  ".repeat(indent);
    console.log(`${indentation}- ${message}`);
  }

  /**
   * Create a spinner-like effect for long operations
   */
  static loading(message: string): () => void {
    process.stdout.write(chalk.cyan("⠋") + " " + message);
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write("\r" + chalk.cyan(frames[i]) + " " + message);
      i = (i + 1) % frames.length;
    }, 80);

    return () => {
      clearInterval(interval);
      process.stdout.write("\r");
    };
  }

  /**
   * Format a file path for display
   */
  static formatPath(filePath: string): string {
    return chalk.cyan(filePath);
  }

  /**
   * Format a count/number for display
   */
  static formatCount(count: number): string {
    return chalk.bold.yellow(count.toString());
  }

  /**
   * Format a variable name for display
   */
  static formatVariable(name: string): string {
    return chalk.magenta(name);
  }
}
