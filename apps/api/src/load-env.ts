import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * Side-effect module imported before AppModule so the repository-root .env is in
 * process.env before @nestjs/config validates it (forRoot runs eagerly at import
 * time). In Docker the file is absent and the container environment is used.
 */
loadDotenv({ path: resolve(process.cwd(), "../../.env"), override: true });
loadDotenv({ override: true });
