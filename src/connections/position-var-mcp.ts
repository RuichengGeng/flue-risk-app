import { defineMcpConnection } from '@flue/runtime';

export const positionVarMcp = defineMcpConnection({
  name: 'position_var',
  url: 'https://var.hpapacvarserver.com/mcp',
  transport: 'streamable-http',
  optional: true,
  timeoutMs: 120_000,
});
