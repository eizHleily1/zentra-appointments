import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { validateEnvironment } from "../config/environment";
import { InMemoryAuthRepository } from "../../test/in-memory-auth.repository";
import { AUTH_REPOSITORY } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

describe("AuthService", () => {
  let authService: AuthService;
  let repository: InMemoryAuthRepository;

  beforeEach(async () => {
    repository = new InMemoryAuthRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          validate: validateEnvironment
        }),
        JwtModule.register({})
      ],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        {
          provide: AUTH_REPOSITORY,
          useValue: repository
        }
      ]
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it("registers an active account and stores a password hash", async () => {
    const response = await authService.register("Person@Example.com", "strong-password");
    const [account] = repository.getAccounts();

    expect(response.accessToken).toBeTruthy();
    expect(response.refreshToken).toBeTruthy();
    expect(response.tokenType).toBe("Bearer");
    expect(account.email).toBe("person@example.com");
    expect(account.status).toBe("ACTIVE");
    expect(account.passwordHash).not.toBe("strong-password");
  });

  it("rejects duplicate email registration safely", async () => {
    await authService.register("person@example.com", "strong-password");

    await expect(authService.register("PERSON@example.com", "strong-password")).rejects.toThrow(
      "Registration could not be completed"
    );
  });

  it("logs in active accounts with valid credentials", async () => {
    await authService.register("person@example.com", "strong-password");

    await expect(authService.login("person@example.com", "strong-password")).resolves.toMatchObject({
      tokenType: "Bearer"
    });
  });

  it("rejects invalid credentials", async () => {
    await authService.register("person@example.com", "strong-password");

    await expect(authService.login("person@example.com", "wrong-password")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects disabled accounts for login and refresh", async () => {
    const response = await authService.register("person@example.com", "strong-password");
    const [account] = repository.getAccounts();

    repository.disableAccount(account.id);

    await expect(authService.login("person@example.com", "strong-password")).rejects.toThrow(UnauthorizedException);
    await expect(authService.refresh(response.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it("rotates refresh tokens and rejects reuse", async () => {
    const initial = await authService.register("person@example.com", "strong-password");
    const refreshed = await authService.refresh(initial.refreshToken);
    const refreshTokens = repository.getRefreshTokens();

    expect(refreshed.refreshToken).not.toBe(initial.refreshToken);
    expect(refreshTokens).toHaveLength(2);
    expect(refreshTokens[0].revokedAt).toBeInstanceOf(Date);
    await expect(authService.refresh(initial.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it("logs out by invalidating the refresh token", async () => {
    const response = await authService.register("person@example.com", "strong-password");

    await expect(authService.logout(response.refreshToken)).resolves.toEqual({ success: true });
    await expect(authService.refresh(response.refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
