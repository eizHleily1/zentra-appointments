import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";

describe("AuthController", () => {
  let app: INestApplication;
  let repository: InMemoryAuthRepository;

  beforeEach(async () => {
    repository = new InMemoryAuthRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(repository)
      .overrideProvider(PostgresAuthRepository)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers and logs in an active authentication account", async () => {
    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .set("x-forwarded-for", "203.0.113.1")
      .send({ email: "Person@Example.com", password: "strong-password" })
      .expect(201);

    expect(registerResponse.body).toMatchObject({
      tokenType: "Bearer"
    });
    expect(registerResponse.body.accessToken).toBeTruthy();
    expect(registerResponse.body.refreshToken).toBeTruthy();

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .set("x-forwarded-for", "203.0.113.2")
      .send({ email: "person@example.com", password: "strong-password" })
      .expect(201);

    expect(loginResponse.body).toMatchObject({
      tokenType: "Bearer"
    });
  });

  it("rotates refresh tokens and supports logout", async () => {
    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .set("x-forwarded-for", "203.0.113.3")
      .send({ email: "person@example.com", password: "strong-password" })
      .expect(201);

    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("x-forwarded-for", "203.0.113.4")
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(201);

    expect(refreshResponse.body.refreshToken).not.toBe(registerResponse.body.refreshToken);

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(201)
      .expect({ success: true });

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("x-forwarded-for", "203.0.113.5")
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(401);
  });

  it("rejects disabled accounts without exposing account status", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .set("x-forwarded-for", "203.0.113.6")
      .send({ email: "person@example.com", password: "strong-password" })
      .expect(201);

    const [account] = repository.getAccounts();
    repository.disableAccount(account.id);

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .set("x-forwarded-for", "203.0.113.7")
      .send({ email: "person@example.com", password: "strong-password" })
      .expect(401);

    expect(response.body.message).toBe("Invalid credentials");
  });

  it("rate limits registration, login, and refresh endpoints", async () => {
    for (const endpoint of ["register", "login", "refresh"]) {
      const ip = `203.0.113.${20 + endpoint.length}`;
      const body =
        endpoint === "refresh"
          ? { refreshToken: "invalid-refresh-token" }
          : { email: `${endpoint}@example.com`, password: "wrong-password" };

      await request(app.getHttpServer()).post(`/auth/${endpoint}`).set("x-forwarded-for", ip).send(body);
      await request(app.getHttpServer()).post(`/auth/${endpoint}`).set("x-forwarded-for", ip).send(body);
      await request(app.getHttpServer()).post(`/auth/${endpoint}`).set("x-forwarded-for", ip).send(body).expect(429);
    }
  });
});
