export function integrationState(env: Record<string, string | undefined>) {
  const supabase =
    !!env.NEXT_PUBLIC_SUPABASE_URL &&
    !!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const server = !!env.SUPABASE_SERVICE_ROLE_KEY;
  const network = env.GENLAYER_NETWORK || "localnet";
  const key = !!env.GENLAYER_PRIVATE_KEY?.match(/^0x[0-9a-fA-F]{64}$/);
  const contract =
    !!env.GENLAYER_CONTRACT_ADDRESS?.match(/^0x[0-9a-fA-F]{40}$/);
  const fees =
    network !== "bradbury" ||
    !!env.GENLAYER_FEE_PROFILE_JSON ||
    !!env.GENLAYER_FEE_PROFILE_PATH;
  return {
    supabaseConfigured: supabase,
    serverCredentialsConfigured: server,
    genlayerMode: env.GENLAYER_MODE === "genlayer" ? "genlayer" : "development",
    network,
    signerConfigured: key,
    contractConfigured: contract,
    feeConfigurationPresent: fees,
    readyForLiveRequests:
      supabase &&
      server &&
      key &&
      contract &&
      fees &&
      env.GENLAYER_MODE === "genlayer",
  };
}
