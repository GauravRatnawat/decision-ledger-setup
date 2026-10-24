import { handleMove, type ArchiveEnv } from "../../src/archive/handler";

export const onRequest = ({ env, request }: { env: ArchiveEnv; request: Request }) =>
  handleMove(request, env, "restore");
