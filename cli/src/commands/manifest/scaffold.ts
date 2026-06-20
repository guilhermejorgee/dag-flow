import { BUILT_IN_RUNTIMES } from '../../compiler/manifest-resolver.js';

export function runManifestScaffold(args: string[]): void {
  const extendsFlag = args.find((a) => a.startsWith('--extends='));
  if (!extendsFlag) {
    console.error(
      `Error: --extends is required. Built-in runtimes: ${BUILT_IN_RUNTIMES.join(', ')}`,
    );
    process.exit(1);
  }
  console.error('dag manifest scaffold: not implemented yet (stub)');
  process.exit(1);
}
