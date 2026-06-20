import { InitError, runInit } from './commands/init.js';
import { HookWiringError } from './hooks/hook-config-upsert.js';
import { BootFileError } from './hooks/boot-file-append.js';
import { PrerequisitesError } from './prerequisites.js';
import { runManifestScaffold } from './commands/manifest/scaffold.js';
import { PendingDagGuardError, runUpdate, UpdateError } from './commands/update.js';

const HELP = `dag-flow CLI — multi-runtime skill compiler

Usage:
  dag init [options]              Install compiled skill + project scaffold
  dag update [options]            Recompile skill and re-wire hooks
  dag manifest scaffold [options] Scaffold a custom runtime manifest

Options:
  -h, --help                      Show this help
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function main(argv: string[]): void {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const [command, subcommand, ...rest] = args;

  if (command === 'init') {
    try {
      runInit(args.slice(1));
    } catch (error) {
      if (
        error instanceof PrerequisitesError ||
        error instanceof InitError ||
        error instanceof HookWiringError ||
        error instanceof BootFileError
      ) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
    return;
  }
  if (command === 'update') {
    try {
      runUpdate(args.slice(1));
    } catch (error) {
      if (
        error instanceof PendingDagGuardError ||
        error instanceof UpdateError ||
        error instanceof HookWiringError ||
        error instanceof BootFileError
      ) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }
    return;
  }
  if (command === 'manifest' && subcommand === 'scaffold') {
    runManifestScaffold(rest);
    return;
  }

  console.error(`Unknown command: ${args.join(' ')}`);
  printHelp();
  process.exit(1);
}

main(process.argv);
