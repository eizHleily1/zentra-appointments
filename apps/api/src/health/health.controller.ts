import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/environment";

const FOUNDATION_PHASE = "Phase 1 - Foundation & Project Setup" as const;

interface HealthResponse {
  databaseConfigured: boolean;
  environment: AppConfig["NODE_ENV"];
  phase: typeof FOUNDATION_PHASE;
  status: "ok";
}

@Controller("health")
export class HealthController {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      databaseConfigured: this.configService.get("DATABASE_URL", { infer: true }).length > 0,
      environment: this.configService.get("NODE_ENV", { infer: true }),
      phase: FOUNDATION_PHASE,
      status: "ok"
    };
  }
}
