import type { K3sControlPlane } from '@ankhorage/infra-k3s';
import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/infra-k3s';

declare const controlPlane: K3sControlPlane;
const adapter = createInfraAdapter({ controlPlane });

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
