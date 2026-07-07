import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { BUSINESS_HOURS_REPOSITORY } from "../src/businesses/business-hours.repository";
import { PostgresBusinessHoursRepository } from "../src/businesses/postgres-business-hours.repository";
import { BUSINESS_REPOSITORY } from "../src/businesses/business.repository";
import { PostgresBusinessRepository } from "../src/businesses/postgres-business.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryBusinessHoursRepository } from "./in-memory-business-hours.repository";
import { InMemoryBusinessRepository } from "./in-memory-business.repository";

describe("BusinessesController", () => {
  let app: INestApplication;
  let businessRepository: InMemoryBusinessRepository;

  beforeEach(async () => {
    businessRepository = new InMemoryBusinessRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(new InMemoryAuthRepository())
      .overrideProvider(PostgresAuthRepository)
      .useValue({})
      .overrideProvider(BUSINESS_REPOSITORY)
      .useValue(businessRepository)
      .overrideProvider(PostgresBusinessRepository)
      .useValue({})
      .overrideProvider(BUSINESS_HOURS_REPOSITORY)
      .useValue(new InMemoryBusinessHoursRepository())
      .overrideProvider(PostgresBusinessHoursRepository)
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

  it("creates a business and owner membership for an authenticated user", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");

    const response = await request(app.getHttpServer())
      .post("/businesses")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "BARBER", name: "Ahmad Barber", timezone: "Asia/Amman" })
      .expect(201);

    expect(response.body).toMatchObject({
      businessType: "BARBER",
      name: "Ahmad Barber",
      status: "PENDING_ONBOARDING",
      timezone: "Asia/Amman"
    });
    expect(businessRepository.getMemberships()).toEqual([
      expect.objectContaining({
        businessId: response.body.id,
        role: "OWNER"
      })
    ]);
  });

  it("returns only businesses associated with the authenticated user's memberships", async () => {
    const firstToken = await registerAndGetAccessToken(app, "first@example.com");
    const secondToken = await registerAndGetAccessToken(app, "second@example.com");
    const firstBusiness = await createBusiness(app, firstToken, "First Business");
    await createBusiness(app, secondToken, "Second Business");

    const response = await request(app.getHttpServer())
      .get("/businesses")
      .set("authorization", `Bearer ${firstToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(firstBusiness.id);
  });

  it("protects details, updates, and deactivation with membership authorization", async () => {
    const ownerToken = await registerAndGetAccessToken(app, "owner@example.com");
    const otherToken = await registerAndGetAccessToken(app, "other@example.com");
    const business = await createBusiness(app, ownerToken, "Owner Business");

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}`)
      .set("authorization", `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}`)
      .set("authorization", `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/businesses/${business.id}`)
      .set("authorization", `Bearer ${otherToken}`)
      .send({ name: "Unauthorized Update" })
      .expect(404);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/businesses/${business.id}`)
      .set("authorization", `Bearer ${ownerToken}`)
      .send({ name: "Updated Business", businessType: "SALON", timezone: "Asia/Dubai" })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      businessType: "SALON",
      name: "Updated Business",
      timezone: "Asia/Dubai"
    });

    const deactivateResponse = await request(app.getHttpServer())
      .post(`/businesses/${business.id}/deactivate`)
      .set("authorization", `Bearer ${ownerToken}`)
      .expect(201);

    expect(deactivateResponse.body.status).toBe("DEACTIVATED");
  });

  it("rejects unauthenticated business creation and invalid business types", async () => {
    await request(app.getHttpServer())
      .post("/businesses")
      .send({ businessType: "BARBER", name: "No Auth", timezone: "Asia/Amman" })
      .expect(401);

    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");

    await request(app.getHttpServer())
      .post("/businesses")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "RESTAURANT", name: "Invalid Type", timezone: "Asia/Amman" })
      .expect(400);
  });

  it("rejects invalid IANA timezones and accepts Asia/Jerusalem", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");

    const invalidResponse = await request(app.getHttpServer())
      .post("/businesses")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "BARBER", name: "Bad Timezone", timezone: "Asia/Israel" })
      .expect(400);

    expect(invalidResponse.body.message).toContain("not a valid timezone");

    const validResponse = await request(app.getHttpServer())
      .post("/businesses")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ businessType: "BARBER", name: "Jerusalem Barber", timezone: "Asia/Jerusalem" })
      .expect(201);

    expect(validResponse.body.timezone).toBe("Asia/Jerusalem");
  });

  it("reports publish readiness and rejects publish until requirements are met", async () => {
    const ownerToken = await registerAndGetAccessToken(app, "publish@example.com");
    const business = await createBusiness(app, ownerToken, "Publish Barber");

    const readinessResponse = await request(app.getHttpServer())
      .get(`/businesses/${business.id}/publish-readiness`)
      .set("authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(readinessResponse.body.canPublish).toBe(false);
    expect(readinessResponse.body.missingSteps.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/businesses/${business.id}`)
      .set("authorization", `Bearer ${ownerToken}`)
      .send({ city: "Amman" })
      .expect(200);

    const publishResponse = await request(app.getHttpServer())
      .post(`/businesses/${business.id}/publish`)
      .set("authorization", `Bearer ${ownerToken}`)
      .expect(400);

    expect(String(publishResponse.body.message)).toMatch(/service|staff/i);
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

async function createBusiness(app: INestApplication, accessToken: string, name: string) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType: "BARBER", name, timezone: "Asia/Amman" })
    .expect(201);

  return response.body;
}
