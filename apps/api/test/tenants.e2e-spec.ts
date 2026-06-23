import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { TENANT_REPOSITORY } from "../src/tenants/tenant.repository";
import { PostgresTenantRepository } from "../src/tenants/postgres-tenant.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryTenantRepository } from "./in-memory-tenant.repository";

describe("TenantsController", () => {
  let app: INestApplication;
  let authRepository: InMemoryAuthRepository;
  let tenantRepository: InMemoryTenantRepository;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    tenantRepository = new InMemoryTenantRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(PostgresAuthRepository)
      .useValue({})
      .overrideProvider(TENANT_REPOSITORY)
      .useValue(tenantRepository)
      .overrideProvider(PostgresTenantRepository)
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
    await app?.close();
  });

  it("rejects unauthenticated tenant creation", async () => {
    await request(app.getHttpServer())
      .post("/tenants")
      .send({ businessType: "BARBER", name: "Ahmad Barber", timezone: "Asia/Amman" })
      .expect(401);
  });

  it("creates a tenant for an authenticated user", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");

    const response = await request(app.getHttpServer())
      .post("/tenants")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "BARBER", name: "Ahmad Barber", timezone: "Asia/Amman" })
      .expect(201);

    expect(response.body).toMatchObject({
      businessType: "BARBER",
      name: "Ahmad Barber",
      status: "PENDING_ONBOARDING",
      timezone: "Asia/Amman"
    });
    expect(response.body.initialOwnerUserId).toBeTruthy();
  });

  it("rejects invalid business types", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");

    await request(app.getHttpServer())
      .post("/tenants")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "UNAPPROVED_TYPE", name: "Ahmad Barber", timezone: "Asia/Amman" })
      .expect(400);
  });

  it("updates tenant metadata and preserves owner reference", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const createResponse = await request(app.getHttpServer())
      .post("/tenants")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "CLINIC", name: "Prime Therapy", timezone: "Asia/Amman" })
      .expect(201);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/tenants/${createResponse.body.id}`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "THERAPIST", name: "Prime Therapy Clinic", timezone: "Asia/Dubai" })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      businessType: "THERAPIST",
      initialOwnerUserId: createResponse.body.initialOwnerUserId,
      name: "Prime Therapy Clinic",
      timezone: "Asia/Dubai"
    });
  });

  it("deactivates a tenant without deleting it", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const createResponse = await request(app.getHttpServer())
      .post("/tenants")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "CONSULTANT", name: "Consulting Studio", timezone: "Asia/Amman" })
      .expect(201);

    const deactivateResponse = await request(app.getHttpServer())
      .post(`/tenants/${createResponse.body.id}/deactivate`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(201);

    expect(deactivateResponse.body.status).toBe("DEACTIVATED");
    expect(tenantRepository.getTenants()).toHaveLength(1);
  });
});

async function registerAndGetAccessToken(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/auth/register")
    .set("x-forwarded-for", email)
    .send({ email, password: "strong-password" })
    .expect(201);

  return response.body.accessToken;
}
