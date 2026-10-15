declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GENLAYER_PRIVATE_KEY?: string;
    GENLAYER_CONTRACT_ADDRESS?: string;
    GENLAYER_NETWORK?: string;
    SITEPROOF_PUBLIC_ORIGIN?: string;
  }
}
