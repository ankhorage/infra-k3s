import type { InfraRuntimeAdapter } from '@ankhorage/contracts/infra';

import { infraAdapterDescriptor } from '../../../constants/infra.js';
import type { K3sAdapterOptions } from '../../../types/k3sRuntime.js';
import { createK3sCliControlPlane } from '../adapters/createK3sCliControlPlane.js';
import { destroyK3sRuntimeAsync } from '../application/use-cases/destroyK3sRuntimeAsync.js';
import { ensureK3sRuntimeAsync } from '../application/use-cases/ensureK3sRuntimeAsync.js';
import { getK3sStatusAsync } from '../application/use-cases/getK3sStatusAsync.js';
import { planK3sRuntimeAsync } from '../application/use-cases/planK3sRuntimeAsync.js';
import { suspendK3sRuntimeAsync } from '../application/use-cases/suspendK3sRuntimeAsync.js';
import { validateK3sRuntimeAsync } from '../application/use-cases/validateK3sRuntimeAsync.js';

/***
 * Create the canonical k3s runtime adapter entrypoint.
 *
 * The default composition bootstraps local Linux or host-key-pinned SSH nodes through the official
 * k3s installer. Standard workload projection and reconciliation are delegated to the published
 * Kubernetes driver. Canonical `networking.tls` ACME HTTP-01 intent is reconciled through an
 * Infra-owned Traefik HelmChartConfig without overwriting foreign Traefik configuration. Tests and
 * specialized hosts may inject the control-plane boundary.
 *
 * @readme
 */
export function createInfraAdapter(options: K3sAdapterOptions = {}): InfraRuntimeAdapter<'k3s'> {
  const dependencies = {
    controlPlane: options.controlPlane ?? createK3sCliControlPlane(options.cli),
  };
  return {
    descriptor: infraAdapterDescriptor,
    validateAsync: (context, desired) => validateK3sRuntimeAsync(dependencies, context, desired),
    planAsync: (context, desired) => planK3sRuntimeAsync(dependencies, context, desired),
    ensureAsync: (context, desired) => ensureK3sRuntimeAsync(dependencies, context, desired),
    statusAsync: (context, desired) => getK3sStatusAsync(dependencies, context, desired),
    suspendAsync: (context, desired) => suspendK3sRuntimeAsync(dependencies, context, desired),
    destroyAsync: (context, desired, request) =>
      destroyK3sRuntimeAsync(dependencies, context, desired, request),
  };
}
