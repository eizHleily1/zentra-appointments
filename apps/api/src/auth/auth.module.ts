import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { AUTH_REPOSITORY } from "./auth.repository";
import { AuthController } from "./auth.controller";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordService } from "./password.service";
import { PostgresAuthRepository } from "./postgres-auth.repository";
import { TokenService } from "./token.service";

@Module({
  controllers: [AuthController],
  imports: [DatabaseModule, JwtModule.register({})],
  providers: [
    AuthRateLimitGuard,
    AuthService,
    JwtAuthGuard,
    PasswordService,
    PostgresAuthRepository,
    TokenService,
    {
      provide: AUTH_REPOSITORY,
      useExisting: PostgresAuthRepository
    }
  ],
  exports: [AUTH_REPOSITORY, JwtAuthGuard, JwtModule]
})
export class AuthModule {}
