import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repositoryRoot = new URL('..', import.meta.url).pathname;
const consumerDirectory = mkdtempSync(join(tmpdir(), 'ankhorage-infra-k3s-consumer-'));
let archivePath: string | undefined;

try {
  const packOutput = execFileSync('bun', ['pm', 'pack'], { cwd: repositoryRoot, encoding: 'utf8' });
  const archiveName = /(?:^|\n)([^\n]+\.tgz)(?:\n|$)/.exec(packOutput)?.[1];
  if (archiveName === undefined)
    throw new Error('Packing @ankhorage/infra-k3s produced no archive.');

  archivePath = join(repositoryRoot, archiveName);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { '@ankhorage/infra-k3s': `file:${archivePath}` },
    }),
  );
  writeFileSync(
    join(consumerDirectory, 'consumer.ts'),
    "import type { K3sAdapterOptions } from '@ankhorage/infra-k3s';\nconst options: K3sAdapterOptions | undefined = undefined;\nvoid options;\n",
  );

  execFileSync(
    'bun',
    ['install', '--ignore-scripts', '--cache-dir', join(tmpdir(), 'infra-k3s-bun-cache')],
    {
      cwd: consumerDirectory,
      stdio: 'inherit',
    },
  );
  const adapterManifest = JSON.parse(
    readFileSync(join(consumerDirectory, 'node_modules/@ankhorage/infra-k3s/package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string> };
  if (
    Object.values(adapterManifest.dependencies ?? {}).some((dependency) =>
      /^(?:workspace:|file:|link:)/.test(dependency),
    )
  )
    throw new Error('Packed k3s adapter includes a non-public dependency reference.');
  const runtimeAssertion =
    "const contracts = await import('@ankhorage/contracts/infra'); const adapter = await import('@ankhorage/infra-k3s'); const runtime = adapter.createInfraAdapter(); const lifecycle = ['validateAsync', 'planAsync', 'ensureAsync', 'statusAsync', 'suspendAsync', 'destroyAsync']; if (typeof adapter.createInfraAdapter !== 'function' || adapter.infraAdapterDescriptor.id !== 'k3s' || adapter.infraAdapterDescriptor.package !== '@ankhorage/infra-k3s' || !contracts.isInfraAdapterDescriptor(adapter.infraAdapterDescriptor) || JSON.stringify(adapter.infraAdapterDescriptor) !== JSON.stringify(contracts.INFRA_ADAPTER_CATALOG.k3s) || runtime.descriptor !== adapter.infraAdapterDescriptor || lifecycle.some((method) => typeof runtime[method] !== 'function')) throw new Error('Invalid k3s public adapter boundary');";
  execFileSync('bun', ['--eval', runtimeAssertion], { cwd: consumerDirectory, stdio: 'inherit' });
  execFileSync('node', ['--input-type=module', '--eval', runtimeAssertion], {
    cwd: consumerDirectory,
    stdio: 'inherit',
  });
  execFileSync(
    join(repositoryRoot, 'node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      'consumer.ts',
    ],
    { cwd: consumerDirectory, stdio: 'inherit' },
  );
} finally {
  rmSync(consumerDirectory, { recursive: true, force: true });
  if (archivePath !== undefined) rmSync(archivePath, { force: true });
}
