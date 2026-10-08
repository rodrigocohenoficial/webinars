import type { NextConfig } from "next";

/**
 * O rastreador de arquivos do Next copia o @prisma/client inteiro para cada
 * funcao: motores WASM de cinco bancos que nao usamos, edge, react-native e
 * mapas de debug. Sao ~60 MB de peso morto por funcao, multiplicados por
 * ~25 funcoes e por cada deploy guardado — e isso que estoura o "Functions
 * Storage" da Vercel. No Node, o cliente so precisa de runtime/library.js e
 * do motor nativo (libquery_engine-*.so.node).
 */
const PRISMA_PESO_MORTO = [
  "node_modules/@prisma/client/runtime/*.wasm-base64.*",
  "node_modules/@prisma/client/runtime/query_engine_bg.*",
  "node_modules/@prisma/client/runtime/query_compiler_bg.*",
  "node_modules/@prisma/client/runtime/*.map",
  "node_modules/@prisma/client/runtime/*.d.ts",
  "node_modules/@prisma/client/runtime/*.d.mts",
  "node_modules/@prisma/client/runtime/binary.*",
  "node_modules/@prisma/client/runtime/client.*",
  "node_modules/@prisma/client/runtime/edge*",
  "node_modules/@prisma/client/runtime/react-native.*",
  "node_modules/@prisma/client/runtime/wasm-*",
  "node_modules/@prisma/client/runtime/index-browser.*",
  "node_modules/.prisma/client/query_engine_bg.*",
  "node_modules/.prisma/client/edge.js",
  "node_modules/.prisma/client/wasm*",
  "node_modules/.prisma/client/*.d.ts",
];

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/**": PRISMA_PESO_MORTO,
  },
};

export default nextConfig;
